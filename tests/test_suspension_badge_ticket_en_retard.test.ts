import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { calculerScores, estExemplaireSuspendu, getClassement, periodeCourante } from "@/lib/exemplarite";
import { RESPONSE_DEADLINE_HOURS } from "@/config";

/**
 * Principe non négociable n°4 : avant tout affichage d'un badge
 * d'exemplarité, une vérification en temps réel doit confirmer qu'aucun
 * ticket actif de l'entité n'est actuellement au-delà de son délai de
 * réponse. Un excellent score historique ne doit jamais suffire à afficher
 * le badge si c'est le cas.
 */
describe("Exemplarité — suspension immédiate en cas de ticket actif en retard", () => {
  let etablissementId: string;
  const periode = periodeCourante();

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneSuspension", epci: "EPCI-Suspension", departement: "Dept-Suspension" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Suspension", communeId: commune.id },
    });
    etablissementId = etablissement.id;

    // Historique irréprochable : 8 cas traités rapidement, sans blocage.
    const receptionConfirmeeAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 8; i++) {
      await prisma.ticket.create({
        data: {
          parentPseudoId: `parent-suspension-${i}`,
          etablissementId,
          categorie: "Test",
          contenu: "Cas traité rapidement, historique excellent",
          gravite: "legere",
          statut: "trianguléfondé",
          receptionConfirmeeAt,
          reponduAt: new Date(receptionConfirmeeAt.getTime() + 2 * 60 * 60 * 1000),
          verdictAt: new Date(receptionConfirmeeAt.getTime() + 10 * 60 * 60 * 1000),
        },
      });
    }

    await calculerScores(periode);

    // Un ticket actuellement actif et en dépassement de délai : jamais
    // répondu, réception confirmée bien au-delà de RESPONSE_DEADLINE_HOURS.
    await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-suspension-en-retard",
        etablissementId,
        categorie: "Test",
        contenu: "Cas actuellement en dépassement de délai",
        gravite: "legere",
        statut: "ouvert",
        receptionConfirmeeAt: new Date(
          Date.now() - (RESPONSE_DEADLINE_HOURS + 24) * 60 * 60 * 1000
        ),
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("un score historique excellent a bien été calculé avant l'apparition du ticket en retard", async () => {
    const score = await prisma.exemplariteScore.findFirst({
      where: { entiteType: "etablissement", entiteId: etablissementId },
    });
    expect(score).not.toBeNull();
    expect(score!.tauxReponseDelai).toBe(1);
    expect(score!.tauxSansBlocage).toBe(1);
  });

  it("estExemplaireSuspendu retourne true tant qu'un ticket actif est en retard", async () => {
    const suspendu = await estExemplaireSuspendu("etablissement", etablissementId);
    expect(suspendu).toBe(true);
  });

  it("getClassement n'affiche jamais le badge de cette entité tant qu'un ticket est en retard", async () => {
    const classement = await getClassement("etablissement", periode);
    expect(classement.some((c) => c.entiteId === etablissementId)).toBe(false);
  });
});
