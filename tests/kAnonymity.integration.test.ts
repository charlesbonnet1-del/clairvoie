import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/dashboard/stats/route";
import { K_ANONYMITY_THRESHOLD } from "@/config";

describe("Principe 4 — seuil de k-anonymité appliqué côté API (intégration)", () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: {
        nom: "PetiteCommuneIntegration",
        epci: "EPCI-Integration",
        departement: "Departement-Integration",
      },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Integration", communeId: commune.id },
    });

    // Volontairement 3 cas < K_ANONYMITY_THRESHOLD (8 par défaut) dans cette
    // commune, pour vérifier qu'elle n'est jamais affichée telle quelle.
    for (let i = 0; i < 3; i++) {
      await prisma.ticket.create({
        data: {
          parentPseudoId: `parent-integration-${i}`,
          etablissementId: etablissement.id,
          categorie: "Test",
          contenu: "Signalement de test pour l'intégration k-anonymité",
          gravite: "legere",
          statut: "ouvert",
        },
      });
    }

    // Une commune voisine du même EPCI apporte les cas manquants pour que la
    // maille EPCI atteigne le seuil (8) — sans quoi l'agrégat continuerait
    // de remonter jusqu'au département, ce que ce test ne vise pas à vérifier.
    const communeVoisine = await prisma.commune.create({
      data: {
        nom: "CommuneVoisineIntegration",
        epci: "EPCI-Integration",
        departement: "Departement-Integration",
      },
    });
    const etablissementVoisin = await prisma.etablissement.create({
      data: { nom: "Etab-Voisin-Integration", communeId: communeVoisine.id },
    });
    for (let i = 0; i < 5; i++) {
      await prisma.ticket.create({
        data: {
          parentPseudoId: `parent-integration-voisin-${i}`,
          etablissementId: etablissementVoisin.id,
          categorie: "Test",
          contenu: "Signalement de test pour l'intégration k-anonymité (commune voisine)",
          gravite: "legere",
          statut: "ouvert",
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("remonte la maille commune -> EPCI quand seuls 3 cas existent dans la commune", async () => {
    expect(K_ANONYMITY_THRESHOLD).toBeGreaterThan(3);

    const response = await GET();
    const body = await response.json();

    const communeGroup = body.parGeographie.find(
      (g: { maille: string; label: string }) =>
        g.maille === "commune" && g.label === "PetiteCommuneIntegration"
    );
    expect(communeGroup).toBeUndefined();

    const epciGroup = body.parGeographie.find(
      (g: { maille: string; label: string; count: number }) =>
        g.maille === "epci" && g.label === "EPCI-Integration"
    );
    expect(epciGroup).toBeDefined();
    expect(epciGroup.count).toBe(8);

    const communeVoisineGroup = body.parGeographie.find(
      (g: { maille: string; label: string }) =>
        g.maille === "commune" && g.label === "CommuneVoisineIntegration"
    );
    expect(communeVoisineGroup).toBeUndefined();
  });
});
