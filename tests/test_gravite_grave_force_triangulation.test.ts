import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { enregistrerPosition } from "@/lib/positionEtablissement";

/**
 * Un signalement classé "grave" passe toujours par la triangulation de
 * l'association tierce, quelle que soit la position prise par
 * l'établissement — y compris quand il ne conteste pas.
 */
describe("Gravité 'grave' force la triangulation, quelle que soit la position", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneGrave", epci: "EPCI-Grave", departement: "Dept-Grave" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Grave", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("un ticket grave et NON contesté passe quand même par 'triangulation_requise'", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-grave-non-conteste",
      etablissementId,
      categorie: "Violence physique",
      contenu: "Signalement grave, non contesté",
      gravite: "grave",
    });

    const updated = await enregistrerPosition({
      ticketId: ticket.id,
      acteurPseudo: "etab-grave-1",
      role: "ETABLISSEMENT",
      position: "non_conteste",
    });

    expect(updated.statut).toBe("triangulation_requise");
    expect(updated.statut).not.toBe("attente_cloture_parent");
  });

  it("un ticket grave et contesté passe aussi par 'triangulation_requise'", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-grave-conteste",
      etablissementId,
      categorie: "Violence physique",
      contenu: "Signalement grave, contesté",
      gravite: "grave",
    });

    const updated = await enregistrerPosition({
      ticketId: ticket.id,
      acteurPseudo: "etab-grave-2",
      role: "ETABLISSEMENT",
      position: "conteste",
    });

    expect(updated.statut).toBe("triangulation_requise");
  });

  it("un ticket standard (non grave) ET non contesté ne passe PAS par la triangulation", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-standard-non-conteste",
      etablissementId,
      categorie: "Négligence de surveillance",
      contenu: "Signalement standard, non contesté",
      gravite: "legere",
    });

    const updated = await enregistrerPosition({
      ticketId: ticket.id,
      acteurPseudo: "etab-grave-3",
      role: "ETABLISSEMENT",
      position: "non_conteste",
    });

    expect(updated.statut).toBe("attente_cloture_parent");
  });
});
