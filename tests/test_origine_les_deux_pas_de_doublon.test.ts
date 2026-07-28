import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement, declarerSuiteJudiciaire, declarerPlainteDirecte } from "@/lib/tickets";

describe("SuiteJudiciaire — origine 'les_deux' sans doublon", () => {
  let etablissementId: string;
  let ticketId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneOrigine", epci: "EPCI-Origine", departement: "Dept-Origine" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Origine", communeId: commune.id },
    });
    etablissementId = etablissement.id;

    const ticket = await creerSignalement({
      parentPseudoId: "parent-origine-1",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement pour test origine",
      gravite: "moderee",
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("une plainte directe déclarée sur un ticket déjà transmis par l'établissement met à jour l'origine existante plutôt que de créer un doublon", async () => {
    await declarerSuiteJudiciaire({
      ticketId,
      acteurPseudo: "parent-origine-1",
      statut: "transmis",
    });

    let suites = await prisma.suiteJudiciaire.findMany({ where: { ticketId } });
    expect(suites).toHaveLength(1);
    expect(suites[0].origine).toBe("transmission_etablissement");

    await declarerPlainteDirecte({
      ticketId,
      acteurPseudo: "parent-origine-1",
      documentRef: "recepisse-plainte.pdf",
    });

    suites = await prisma.suiteJudiciaire.findMany({ where: { ticketId } });
    expect(suites).toHaveLength(1);
    expect(suites[0].origine).toBe("les_deux");
    expect(suites[0].documentRef).toBe("recepisse-plainte.pdf");
    expect(suites[0].statut).toBe("transmis");
  });

  it("une déclaration de plainte directe répétée ne crée pas de second enregistrement", async () => {
    await declarerPlainteDirecte({
      ticketId,
      acteurPseudo: "parent-origine-1",
      documentRef: "recepisse-plainte-bis.pdf",
    });

    const suites = await prisma.suiteJudiciaire.findMany({ where: { ticketId } });
    expect(suites).toHaveLength(1);
    expect(suites[0].origine).toBe("les_deux");
  });

  it("une plainte directe déclarée seule (sans transmission établissement préalable) ne crée qu'un seul enregistrement, même répétée", async () => {
    const commune = await prisma.commune.create({
      data: { nom: "CommuneOrigine2", epci: "EPCI-Origine2", departement: "Dept-Origine2" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Origine2", communeId: commune.id },
    });
    const ticket = await creerSignalement({
      parentPseudoId: "parent-origine-2",
      etablissementId: etablissement.id,
      categorie: "Test",
      contenu: "Signalement pour test origine seule",
      gravite: "legere",
    });

    await declarerPlainteDirecte({
      ticketId: ticket.id,
      acteurPseudo: "parent-origine-2",
      documentRef: "recepisse.pdf",
    });
    await declarerPlainteDirecte({
      ticketId: ticket.id,
      acteurPseudo: "parent-origine-2",
      documentRef: "recepisse.pdf",
    });

    const suites = await prisma.suiteJudiciaire.findMany({ where: { ticketId: ticket.id } });
    expect(suites).toHaveLength(1);
    expect(suites[0].origine).toBe("plainte_directe_parent");
  });

  it("une plainte directe sans document justificatif est refusée : aucun enregistrement n'est créé", async () => {
    const commune = await prisma.commune.create({
      data: { nom: "CommuneOrigine3", epci: "EPCI-Origine3", departement: "Dept-Origine3" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Origine3", communeId: commune.id },
    });
    const ticket = await creerSignalement({
      parentPseudoId: "parent-origine-3",
      etablissementId: etablissement.id,
      categorie: "Test",
      contenu: "Signalement pour test document obligatoire",
      gravite: "legere",
    });

    await expect(
      declarerPlainteDirecte({ ticketId: ticket.id, acteurPseudo: "parent-origine-3", documentRef: "" })
    ).rejects.toThrow();

    const suites = await prisma.suiteJudiciaire.findMany({ where: { ticketId: ticket.id } });
    expect(suites).toHaveLength(0);
  });
});
