import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import {
  recupererPersonneMiseEnCause,
  enregistrerPersonneMiseEnCause,
} from "@/lib/personneMiseEnCause";
import { GET as getDashboardStats } from "@/app/api/dashboard/stats/route";

describe("Accès restreint à PersonneMiseEnCause", () => {
  let etablissementIdA: string;
  let etablissementIdB: string;
  let ticketOuvertId: string;
  let ticketEscaladeId: string;

  beforeAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneAccesPMEC", epci: "EPCI-PMEC", departement: "Dept-PMEC" },
    });
    const etablissementA = await prisma.etablissement.create({
      data: { nom: "Etab-A-PMEC", communeId: commune.id },
    });
    const etablissementB = await prisma.etablissement.create({
      data: { nom: "Etab-B-PMEC", communeId: commune.id },
    });
    etablissementIdA = etablissementA.id;
    etablissementIdB = etablissementB.id;

    const ticketOuvert = await creerSignalement({
      parentPseudoId: "parent-pmec-1",
      etablissementId: etablissementIdA,
      categorie: "Test",
      contenu: "Signalement ouvert, non escaladé",
      gravite: "legere",
    });
    ticketOuvertId = ticketOuvert.id;
    await enregistrerPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      nom: "Jean Dupont",
      fonction: "animateur périscolaire",
      contexte: "Sortie scolaire du 12 mars",
    });

    const ticketEscalade = await creerSignalement({
      parentPseudoId: "parent-pmec-2",
      etablissementId: etablissementIdA,
      categorie: "Test",
      contenu: "Signalement escaladé",
      gravite: "moderee",
    });
    ticketEscaladeId = ticketEscalade.id;
    await prisma.ticket.update({
      where: { id: ticketEscaladeId },
      data: { statut: "escaladé", escaladeAt: new Date() },
    });
    await enregistrerPersonneMiseEnCause({
      ticketId: ticketEscaladeId,
      nom: "Marie Martin",
      fonction: "enseignante",
    });
  });

  afterAll(async () => {
    await prisma.personneMiseEnCause.deleteMany({
      where: { ticketId: { in: [ticketOuvertId, ticketEscaladeId] } },
    });
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("l'établissement instructeur du ticket peut le lire", async () => {
    const resultat = await recupererPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      identity: { role: "ETABLISSEMENT", etablissementId: etablissementIdA },
    });
    expect(resultat?.nom).toBe("Jean Dupont");
  });

  it("un autre établissement (non instructeur de ce ticket) ne peut pas le lire", async () => {
    const resultat = await recupererPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      identity: { role: "ETABLISSEMENT", etablissementId: etablissementIdB },
    });
    expect(resultat).toBeNull();
  });

  it("l'association tierce peut le lire", async () => {
    const resultat = await recupererPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      identity: { role: "ASSOCIATION_TIERCE", etablissementId: null },
    });
    expect(resultat?.nom).toBe("Jean Dupont");
  });

  it("le rectorat ne peut PAS lire ce champ pour un ticket non escaladé", async () => {
    const resultat = await recupererPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      identity: { role: "RECTORAT", etablissementId: null },
    });
    expect(resultat).toBeNull();
  });

  it("le rectorat PEUT lire ce champ pour un ticket explicitement escaladé, et uniquement celui-ci", async () => {
    const resultatEscalade = await recupererPersonneMiseEnCause({
      ticketId: ticketEscaladeId,
      identity: { role: "RECTORAT", etablissementId: null },
    });
    expect(resultatEscalade?.nom).toBe("Marie Martin");

    // Toujours refusé pour le ticket non escaladé, même pour le même compte.
    const resultatOuvert = await recupererPersonneMiseEnCause({
      ticketId: ticketOuvertId,
      identity: { role: "RECTORAT", etablissementId: null },
    });
    expect(resultatOuvert).toBeNull();
  });

  it("le dashboard public n'expose jamais ce champ, même avec des paramètres non documentés", async () => {
    const response = await getDashboardStats();
    const raw = await response.text();

    expect(raw).not.toContain("Jean Dupont");
    expect(raw).not.toContain("Marie Martin");
    expect(raw).not.toContain("animateur périscolaire");
    expect(raw).not.toContain("PersonneMiseEnCause");

    const body = JSON.parse(raw);
    expect(body).not.toHaveProperty("personneMiseEnCause");
    expect(body).not.toHaveProperty("personnesMiseEnCause");
  });
});
