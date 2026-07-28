import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  creerSignalement,
  repondreSignalement,
  trianguler,
  cloturerParAccordMutuel,
} from "@/lib/tickets";

describe("Principe 7 — provenance de chaque mise à jour", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneProvenance", epci: "EPCI-P", departement: "Dept-P" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Provenance", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("chaque entrée d'audit porte l'identifiant pseudonyme du compte authentifié à l'origine de l'action", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-provenance",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement pour test de provenance",
      gravite: "legere",
    });

    await repondreSignalement({
      ticketId: ticket.id,
      acteurPseudo: "etab-provenance",
      reponseContenu: "Réponse de test",
    });

    await cloturerParAccordMutuel({
      ticketId: ticket.id,
      acteurPseudo: "parent-provenance",
    });

    const entries = await prisma.auditLog.findMany({
      where: { ticketId: ticket.id },
      orderBy: { timestamp: "asc" },
    });

    expect(entries.map((e) => e.action)).toEqual([
      "creation",
      "reponse",
      "cloture_accord_mutuel",
    ]);
    expect(entries.every((e) => Boolean(e.acteurPseudo))).toBe(true);
    expect(entries[0].acteurPseudo).toBe("parent-provenance");
    expect(entries[1].acteurPseudo).toBe("etab-provenance");
    expect(entries[2].acteurPseudo).toBe("parent-provenance");
  });

  it("le verdict de l'association tierce porte bien l'acteur de l'association, pas le parent", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-provenance-2",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement grave pour test de provenance",
      gravite: "grave",
    });

    await trianguler({
      ticketId: ticket.id,
      acteurPseudo: "asso-provenance",
      verdict: "fondé",
    });

    const verdictEntry = await prisma.auditLog.findFirst({
      where: { ticketId: ticket.id, action: "verdict_fondé" },
    });
    expect(verdictEntry?.acteurPseudo).toBe("asso-provenance");
  });
});
