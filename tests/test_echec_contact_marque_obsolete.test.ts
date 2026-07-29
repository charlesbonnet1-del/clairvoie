import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { signalerEchecContact, getContactEscalade } from "@/lib/rectoratContacts";

describe("Échec d'escalade réelle -> 'obsolete_suspecte', jamais de correction automatique", () => {
  let etablissementId: string;
  let ticketId: string;

  beforeAll(async () => {
    await prisma.rectoratContact.deleteMany({ where: { academie: "Académie de TestEchec" } });
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestEchec",
        typeContactPrefere: "mediateur_academique",
        medieurEmail: "mediateur@ac-testechec.demo.fr",
        medieurTelephone: "01 02 03 04 05",
        secretariatEmail: "secretariat@ac-testechec.demo.fr",
        standardTelephone: "01 00 00 00 00",
        source: "verification_manuelle",
        statutVerification: "verifie",
        derniereVerification: new Date(),
      },
    });

    const commune = await prisma.commune.create({
      data: {
        nom: "CommuneTestEchec",
        epci: "EPCI-TestEchec",
        departement: "Dept-TestEchec",
        academie: "Académie de TestEchec",
      },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-TestEchec", communeId: commune.id },
    });
    etablissementId = etablissement.id;

    const ticket = await creerSignalement({
      parentPseudoId: "parent-echec-contact",
      etablissementId,
      categorie: "Test",
      contenu: "Ticket pour test d'échec de contact rectorat",
      gravite: "legere",
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.rectoratContact.deleteMany({ where: { academie: "Académie de TestEchec" } });
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("marque l'entrée 'obsolete_suspecte' sans modifier les autres champs de contact", async () => {
    const avant = await prisma.rectoratContact.findUniqueOrThrow({
      where: { academie: "Académie de TestEchec" },
    });

    const apres = await signalerEchecContact({ academie: "Académie de TestEchec", ticketId });

    expect(apres.statutVerification).toBe("obsolete_suspecte");
    // Aucune correction automatique des coordonnées elles-mêmes.
    expect(apres.medieurEmail).toBe(avant.medieurEmail);
    expect(apres.medieurTelephone).toBe(avant.medieurTelephone);
    expect(apres.secretariatEmail).toBe(avant.secretariatEmail);
    expect(apres.standardTelephone).toBe(avant.standardTelephone);
    expect(apres.typeContactPrefere).toBe(avant.typeContactPrefere);
  });

  it("getContactEscalade accompagne toujours d'un avertissement explicite une fois l'entrée obsolète suspectée", async () => {
    const resultat = await getContactEscalade("Académie de TestEchec");
    expect(resultat).not.toBeNull();
    expect(resultat!.avertissement).toBeDefined();
    expect(resultat!.avertissement).toMatch(/obsolète|vérification manuelle/i);
    // Le médiateur, bien que renseigné, n'est plus utilisé une fois l'entrée
    // suspectée obsolète : repli sur le standard.
    expect(resultat!.typeUtilise).toBe("standard_rectorat");
  });
});
