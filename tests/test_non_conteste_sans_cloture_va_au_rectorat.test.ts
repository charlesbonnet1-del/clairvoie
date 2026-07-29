import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifierClotureParent } from "@/lib/positionEtablissement";
import { DELAI_CLOTURE_PARENT_JOURS } from "@/config";

/**
 * Un ticket non contesté (statut "attente_cloture_parent") sans clôture par
 * le parent après DELAI_CLOTURE_PARENT_JOURS passe automatiquement à
 * "escaladé_rectorat" — même mécanisme que l'escalade pour silence total de
 * l'établissement (escaladerSiSilence), appliqué ici au silence du parent.
 */
describe("Non contesté sans clôture parent -> escaladé au rectorat", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneClotureParent", epci: "EPCI-CP", departement: "Dept-CP" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-ClotureParent", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("un ticket non contesté au-delà de DELAI_CLOTURE_PARENT_JOURS passe à 'escaladé_rectorat'", async () => {
    const positionEtablissementDate = new Date(
      Date.now() - (DELAI_CLOTURE_PARENT_JOURS + 5) * 24 * 60 * 60 * 1000
    );
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-cp-en-retard",
        etablissementId,
        categorie: "Test",
        contenu: "Non contesté, parent silencieux au-delà du délai",
        gravite: "legere",
        statut: "attente_cloture_parent",
        receptionConfirmeeAt: new Date(positionEtablissementDate.getTime() - 60 * 60 * 1000),
        positionEtablissement: "non_conteste",
        positionEtablissementDate,
        reponduAt: positionEtablissementDate,
      },
    });

    const transmis = await verifierClotureParent();

    expect(transmis.map((t) => t.id)).toContain(ticket.id);

    const ticketFinal = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketFinal.statut).toBe("escaladé_rectorat");
    expect(ticketFinal.escaladeAt).not.toBeNull();
  });

  it("un ticket non contesté encore dans le délai n'est PAS escaladé", async () => {
    const positionEtablissementDate = new Date(
      Date.now() - (DELAI_CLOTURE_PARENT_JOURS - 5) * 24 * 60 * 60 * 1000
    );
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-cp-dans-les-temps",
        etablissementId,
        categorie: "Test",
        contenu: "Non contesté, encore dans le délai laissé au parent",
        gravite: "legere",
        statut: "attente_cloture_parent",
        receptionConfirmeeAt: new Date(positionEtablissementDate.getTime() - 60 * 60 * 1000),
        positionEtablissement: "non_conteste",
        positionEtablissementDate,
        reponduAt: positionEtablissementDate,
      },
    });

    const transmis = await verifierClotureParent();

    expect(transmis.map((t) => t.id)).not.toContain(ticket.id);

    const ticketFinal = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketFinal.statut).toBe("attente_cloture_parent");
  });

  it("un ticket déjà clôturé par accord mutuel n'est jamais escaladé, même longtemps après", async () => {
    const positionEtablissementDate = new Date(
      Date.now() - (DELAI_CLOTURE_PARENT_JOURS + 20) * 24 * 60 * 60 * 1000
    );
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-cp-cloture",
        etablissementId,
        categorie: "Test",
        contenu: "Non contesté puis clôturé par le parent avant le délai",
        gravite: "legere",
        statut: "clôturé_accord_mutuel",
        receptionConfirmeeAt: new Date(positionEtablissementDate.getTime() - 60 * 60 * 1000),
        positionEtablissement: "non_conteste",
        positionEtablissementDate,
        reponduAt: positionEtablissementDate,
        clotureAt: new Date(positionEtablissementDate.getTime() + 60 * 60 * 1000),
      },
    });

    const transmis = await verifierClotureParent();

    expect(transmis.map((t) => t.id)).not.toContain(ticket.id);

    const ticketFinal = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketFinal.statut).toBe("clôturé_accord_mutuel");
  });
});
