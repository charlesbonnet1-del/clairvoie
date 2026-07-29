import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { trianguler } from "@/lib/tickets";
import { enregistrerPosition, verifierClotureParent } from "@/lib/positionEtablissement";
import { computeDashboardStats } from "@/lib/dashboardStats";

/**
 * Principe non négociable : le délai "établissement" affiché dans les
 * statistiques publiques est figé au moment de la prise de position
 * (contester ou ne pas contester), et ne varie jamais selon ce qui se passe
 * ensuite dans le dossier (instruction longue, escalade...). Chaque test
 * isole un seul ticket en base pour que la moyenne globale de
 * computeDashboardStats corresponde exactement au délai de CE ticket.
 */
describe("Le délai établissement est figé à la prise de position", () => {
  async function nettoyer() {
    await prisma.auditLog.deleteMany();
    await prisma.exemplariteScore.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  }

  beforeEach(nettoyer);
  afterAll(nettoyer);

  async function creerCommuneEtEtablissement(suffixe: string) {
    const commune = await prisma.commune.create({
      data: { nom: `CommuneDelai-${suffixe}`, epci: "EPCI-Delai", departement: "Dept-Delai" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: `Etab-Delai-${suffixe}`, communeId: commune.id },
    });
    return etablissement.id;
  }

  it("ticket contesté puis instruit longuement par l'association : le délai affiché ne bouge pas", async () => {
    const etablissementId = await creerCommuneEtEtablissement("conteste");
    const receptionConfirmeeAt = new Date(Date.now() - 10 * 60 * 60 * 1000); // il y a 10h

    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-delai-conteste",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket pour test de délai figé (contesté)",
        gravite: "moderee",
        statut: "ouvert",
        receptionConfirmeeAt,
      },
    });

    await enregistrerPosition({
      ticketId: ticket.id,
      acteurPseudo: "etab-delai-1",
      role: "ETABLISSEMENT",
      position: "conteste",
    });

    const statsAvant = await computeDashboardStats();
    const delaiAvant = statsAvant.global.delaiMoyenReponseHeures;
    expect(delaiAvant).not.toBeNull();

    // Instruction par l'association tierce : simule plusieurs mois avant le
    // verdict final. Le verdict et son horodatage changent, jamais reponduAt
    // ni positionEtablissementDate.
    await trianguler({ ticketId: ticket.id, acteurPseudo: "asso-delai-1", verdict: "fondé" });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { verdictAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    });

    const statsApres = await computeDashboardStats();
    expect(statsApres.global.delaiMoyenReponseHeures).toBe(delaiAvant);
  });

  it("ticket non contesté puis escaladé au rectorat après silence du parent : le délai affiché ne bouge pas", async () => {
    const etablissementId = await creerCommuneEtEtablissement("non-conteste");
    // Position prise il y a 40 jours (au-delà de DELAI_CLOTURE_PARENT_JOURS),
    // 5h après la réception confirmée : le "délai établissement" est donc
    // figé à 5h depuis 40 jours, avant même que verifierClotureParent ne
    // transmette le ticket au rectorat pour silence du parent.
    const positionEtablissementDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const receptionConfirmeeAt = new Date(positionEtablissementDate.getTime() - 5 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-delai-non-conteste",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket pour test de délai figé (non contesté)",
        gravite: "legere",
        statut: "attente_cloture_parent",
        receptionConfirmeeAt,
        positionEtablissement: "non_conteste",
        positionEtablissementDate,
        reponduAt: positionEtablissementDate,
      },
    });

    const statsAvant = await computeDashboardStats();
    const delaiAvant = statsAvant.global.delaiMoyenReponseHeures;
    expect(delaiAvant).not.toBeNull();
    expect(delaiAvant).toBeCloseTo(5, 1);

    await verifierClotureParent();

    const ticketFinal = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketFinal.statut).toBe("escaladé_rectorat");

    const statsApres = await computeDashboardStats();
    expect(statsApres.global.delaiMoyenReponseHeures).toBe(delaiAvant);
  });
});
