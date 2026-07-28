import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getClassement, periodeCourante } from "@/lib/exemplarite";
import { BADGE_STALENESS_DAYS } from "@/config";

/**
 * Principe non négociable n°3 : aucun badge permanent. Un score calculé il
 * y a plus de BADGE_STALENESS_DAYS jours sans nouveau calcul n'apparaît
 * plus dans getClassement, même s'il n'a jamais été explicitement invalidé
 * autrement (pas de suspension, pas de ticket en retard).
 */
describe("Exemplarité — péremption du badge sans recalcul", () => {
  let etablissementPerimeId: string;
  let etablissementFraisId: string;
  const periode = periodeCourante();

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommunePeremption", epci: "EPCI-Peremption", departement: "Dept-Peremption" },
    });
    const etablissementPerime = await prisma.etablissement.create({
      data: { nom: "Etab-Perime", communeId: commune.id },
    });
    const etablissementFrais = await prisma.etablissement.create({
      data: { nom: "Etab-Frais", communeId: commune.id },
    });
    etablissementPerimeId = etablissementPerime.id;
    etablissementFraisId = etablissementFrais.id;

    const calculeLePerime = new Date(
      Date.now() - (BADGE_STALENESS_DAYS + 5) * 24 * 60 * 60 * 1000
    );
    const calculeLeFrais = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const donneesCommunes = {
      periodeDebut: periode.debut,
      periodeFin: periode.fin,
      delaiMoyenReponse: 5,
      tauxReponseDelai: 1,
      tauxSansBlocage: 1,
      nombreCasEligibles: 10,
    };

    await prisma.exemplariteScore.create({
      data: {
        entiteType: "etablissement",
        entiteId: etablissementPerimeId,
        calculeLe: calculeLePerime,
        ...donneesCommunes,
      },
    });
    await prisma.exemplariteScore.create({
      data: {
        entiteType: "etablissement",
        entiteId: etablissementFraisId,
        calculeLe: calculeLeFrais,
        ...donneesCommunes,
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

  it("un score de plus de BADGE_STALENESS_DAYS jours n'apparaît plus dans getClassement", async () => {
    const classement = await getClassement("etablissement", periode);
    expect(classement.some((c) => c.entiteId === etablissementPerimeId)).toBe(false);
  });

  it("un score encore frais (moins de BADGE_STALENESS_DAYS jours) apparaît normalement", async () => {
    const classement = await getClassement("etablissement", periode);
    expect(classement.some((c) => c.entiteId === etablissementFraisId)).toBe(true);
  });
});
