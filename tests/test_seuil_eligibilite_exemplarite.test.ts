import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { calculerScores, getClassement, periodeCourante } from "@/lib/exemplarite";
import { K_ANONYMITY_THRESHOLD } from "@/config";

/**
 * Principe non négociable n°2 : une entité dont le nombre de cas clos sur la
 * période est inférieur à K_ANONYMITY_THRESHOLD n'apparaît dans AUCUN
 * classement — ni bon ni mauvais — quelle que soit la qualité (ou
 * l'absence de qualité) de son traitement. Elle ne doit pas non plus
 * apparaître comme "exemplaire par défaut" faute de signalements.
 */
describe("Exemplarité — seuil d'éligibilité minimum", () => {
  let etablissementSousSeuilId: string;
  const periode = periodeCourante();
  const nombreCasSousSeuil = K_ANONYMITY_THRESHOLD - 1;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneSeuil", epci: "EPCI-Seuil", departement: "Dept-Seuil" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-SousSeuil", communeId: commune.id },
    });
    etablissementSousSeuilId = etablissement.id;

    // Volontairement en dessous du seuil, mais avec un excellent process
    // (réponses rapides, aucun blocage) — pour vérifier que même une
    // performance irréprochable n'est jamais publiée sous le seuil.
    const receptionConfirmeeAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < nombreCasSousSeuil; i++) {
      await prisma.ticket.create({
        data: {
          parentPseudoId: `parent-seuil-${i}`,
          etablissementId: etablissementSousSeuilId,
          categorie: "Test",
          contenu: "Cas traité rapidement",
          gravite: "legere",
          statut: "trianguléfondé",
          receptionConfirmeeAt,
          reponduAt: new Date(receptionConfirmeeAt.getTime() + 2 * 60 * 60 * 1000),
          verdictAt: new Date(receptionConfirmeeAt.getTime() + 10 * 60 * 60 * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("aucun ExemplariteScore n'est créé pour une entité sous le seuil, même avec un excellent process", async () => {
    await calculerScores(periode);

    const score = await prisma.exemplariteScore.findFirst({
      where: { entiteType: "etablissement", entiteId: etablissementSousSeuilId },
    });
    expect(score).toBeNull();
  });

  it("l'entité sous le seuil n'apparaît jamais dans getClassement", async () => {
    const classement = await getClassement("etablissement", periode);
    expect(classement.some((c) => c.entiteId === etablissementSousSeuilId)).toBe(false);
  });
});
