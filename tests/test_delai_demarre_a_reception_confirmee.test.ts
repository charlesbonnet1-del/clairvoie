import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { enregistrerTentativeContact } from "@/lib/contactVerification";

describe("Le délai officiel démarre à la réception confirmée, pas au dépôt", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneDelaiReception", epci: "EPCI-DR", departement: "Dept-DR" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-DelaiReception", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("l'email rebondi n'affecte pas receptionConfirmeeAt, seul le recommandé livré 3 jours plus tard le fait", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-delai-reception",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement de test pour le délai officiel",
      gravite: "legere",
    });

    const emailCanal = await prisma.contactCanal.create({
      data: {
        etablissementId,
        type: "email",
        valeur: "ecole@example.fr",
        source: "annuaire_education_nationale",
      },
    });

    const t0 = new Date();
    await enregistrerTentativeContact({
      ticketId: ticket.id,
      contactCanalId: emailCanal.id,
      methode: "email",
      statut: "echec_rebond",
      timestamp: t0,
    });

    const apresEchec = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(apresEchec.receptionConfirmeeAt).toBeNull();

    const recommandeCanal = await prisma.contactCanal.create({
      data: {
        etablissementId,
        type: "courrier_recommande_electronique",
        valeur: "adresse-ar24@example.fr",
        source: "annuaire_education_nationale",
      },
    });

    const troisJoursPlusTard = new Date(t0.getTime() + 3 * 24 * 60 * 60 * 1000);
    await enregistrerTentativeContact({
      ticketId: ticket.id,
      contactCanalId: recommandeCanal.id,
      methode: "recommande_electronique",
      statut: "livre",
      timestamp: troisJoursPlusTard,
    });

    const apresSucces = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(apresSucces.receptionConfirmeeAt).not.toBeNull();
    expect(apresSucces.receptionConfirmeeAt!.getTime()).toBe(troisJoursPlusTard.getTime());
    expect(apresSucces.receptionConfirmeeAt!.getTime()).not.toBe(apresSucces.createdAt.getTime());
    expect(apresSucces.receptionConfirmeeAt!.getTime()).not.toBe(t0.getTime());
  });
});
