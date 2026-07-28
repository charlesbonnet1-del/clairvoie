import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { calculerScores, calculerScoreProcess, periodeCourante } from "@/lib/exemplarite";

/**
 * Principe non négociable n°1 : le volume brut de signalements ne doit
 * jamais entrer dans le calcul du score d'exemplarité. Deux entités avec
 * exactement la même performance de process (même délai moyen, même taux de
 * réponse dans les délais, même taux de dossiers résolus sans blocage) mais
 * un volume de cas différent (10 vs 40) doivent obtenir un score strictement
 * identique.
 */
describe("Exemplarité — le volume est neutre dans le score", () => {
  let etablissementPetitVolumeId: string;
  let etablissementGrandVolumeId: string;
  const periode = periodeCourante();

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneVolume", epci: "EPCI-Volume", departement: "Dept-Volume" },
    });
    const etablissementPetitVolume = await prisma.etablissement.create({
      data: { nom: "Etab-PetitVolume", communeId: commune.id },
    });
    const etablissementGrandVolume = await prisma.etablissement.create({
      data: { nom: "Etab-GrandVolume", communeId: commune.id },
    });
    etablissementPetitVolumeId = etablissementPetitVolume.id;
    etablissementGrandVolumeId = etablissementGrandVolume.id;

    // Même composition (80 % traités sans blocage et dans les délais, délai
    // moyen de 5h), répétée x1 (10 cas) et x4 (40 cas).
    await creerLotTickets(etablissementPetitVolumeId, 1);
    await creerLotTickets(etablissementGrandVolumeId, 4);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  async function creerLotTickets(etablissementId: string, repetitions: number) {
    const receptionConfirmeeAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    for (let r = 0; r < repetitions; r++) {
      for (let i = 0; i < 8; i++) {
        await prisma.ticket.create({
          data: {
            parentPseudoId: `parent-volume-${etablissementId}-${r}-${i}`,
            etablissementId,
            categorie: "Test",
            contenu: "Cas traité sans blocage, dans les délais",
            gravite: "legere",
            statut: "trianguléfondé",
            receptionConfirmeeAt,
            reponduAt: new Date(receptionConfirmeeAt.getTime() + 5 * 60 * 60 * 1000),
            verdictAt: new Date(receptionConfirmeeAt.getTime() + 20 * 60 * 60 * 1000),
          },
        });
      }
      for (let i = 0; i < 2; i++) {
        await prisma.ticket.create({
          data: {
            parentPseudoId: `parent-volume-escalade-${etablissementId}-${r}-${i}`,
            etablissementId,
            categorie: "Test",
            contenu: "Cas escaladé, hors délai",
            gravite: "legere",
            statut: "escaladé",
            receptionConfirmeeAt,
            escaladeAt: new Date(receptionConfirmeeAt.getTime() + 130 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  it("deux entités à performance de process identique mais volumes différents (10 vs 40) obtiennent un score strictement identique", async () => {
    await calculerScores(periode);

    const scorePetitVolume = await prisma.exemplariteScore.findFirst({
      where: { entiteType: "etablissement", entiteId: etablissementPetitVolumeId },
    });
    const scoreGrandVolume = await prisma.exemplariteScore.findFirst({
      where: { entiteType: "etablissement", entiteId: etablissementGrandVolumeId },
    });

    expect(scorePetitVolume).not.toBeNull();
    expect(scoreGrandVolume).not.toBeNull();

    // Les volumes bruts sont bien différents...
    expect(scorePetitVolume!.nombreCasEligibles).toBe(10);
    expect(scoreGrandVolume!.nombreCasEligibles).toBe(40);

    // ...mais les métriques de process, elles, sont identiques...
    expect(scorePetitVolume!.delaiMoyenReponse).toBeCloseTo(scoreGrandVolume!.delaiMoyenReponse, 10);
    expect(scorePetitVolume!.tauxReponseDelai).toBeCloseTo(scoreGrandVolume!.tauxReponseDelai, 10);
    expect(scorePetitVolume!.tauxSansBlocage).toBeCloseTo(scoreGrandVolume!.tauxSansBlocage, 10);

    // ...et donc le score dérivé est strictement identique, quel que soit
    // le volume : c'est cette égalité stricte que le principe non
    // négociable n°1 exige.
    expect(calculerScoreProcess(scorePetitVolume!)).toBe(calculerScoreProcess(scoreGrandVolume!));
  });
});
