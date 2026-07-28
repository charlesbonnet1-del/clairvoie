import { prisma } from "./prisma";
import { applyKAnonymity, type AggregatedGroup } from "./kAnonymity";
import { K_ANONYMITY_THRESHOLD } from "@/config";

export interface DashboardStats {
  generatedAt: string;
  kAnonymityThreshold: number;
  global: {
    totalSignalements: number;
    tauxReponseDansLesDelais: number | null;
    delaiMoyenReponseHeures: number | null;
    delaiMoyenTriangulationHeures: number | null;
    tauxEscalade: number | null;
    repartitionStatuts: Record<string, number>;
  };
  suiteJudiciaire: {
    tauxCompletudeDeclaratif: number;
    repartition: Record<string, number>;
    avertissement: string;
  };
  parGeographie: AggregatedGroup[];
}

/**
 * Calcule les statistiques agrégées du tableau de bord public. Ne renvoie
 * jamais de statut individuel ni d'identifiant de ticket (principe 6) : tout
 * ce qui touche à la géographie passe par le seuil de k-anonymité (principe
 * 4), appliqué ici côté API — jamais laissé à la seule discrétion de l'UI.
 */
export async function computeDashboardStats(): Promise<DashboardStats> {
  const tickets = await prisma.ticket.findMany({
    include: {
      etablissement: { include: { commune: true } },
      suitesJudiciaires: true,
    },
  });

  const total = tickets.length;

  const repondus = tickets.filter((t) => t.reponduAt);
  const delaisReponseHeures = repondus.map(
    (t) => (t.reponduAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const delaiMoyenReponseHeures =
    delaisReponseHeures.length > 0
      ? delaisReponseHeures.reduce((a, b) => a + b, 0) / delaisReponseHeures.length
      : null;

  const triangules = tickets.filter((t) => t.verdictAt);
  const delaisTriangulationHeures = triangules.map(
    (t) => (t.verdictAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
  );
  const delaiMoyenTriangulationHeures =
    delaisTriangulationHeures.length > 0
      ? delaisTriangulationHeures.reduce((a, b) => a + b, 0) / delaisTriangulationHeures.length
      : null;

  const escalades = tickets.filter((t) => t.escaladeAt);
  const tauxEscalade = total > 0 ? escalades.length / total : null;

  const traites = tickets.filter((t) => t.statut !== "ouvert");
  const traitesDansLesDelais = traites.filter((t) => t.statut !== "escaladé");
  const tauxReponseDansLesDelais =
    traites.length > 0 ? traitesDansLesDelais.length / traites.length : null;

  const repartitionStatuts: Record<string, number> = {};
  for (const t of tickets) {
    repartitionStatuts[t.statut] = (repartitionStatuts[t.statut] ?? 0) + 1;
  }

  // Suite judiciaire : purement auto-déclarative, jamais rattachée à un
  // ticket identifiable ici — uniquement des compteurs agrégés, avec le
  // taux de complétude affiché en regard (principe 6).
  const avecSuiteDeclaree = tickets.filter((t) => t.suitesJudiciaires.length > 0);
  const tauxCompletudeDeclaratif = total > 0 ? avecSuiteDeclaree.length / total : 0;
  const repartitionSuiteJudiciaire: Record<string, number> = {};
  for (const t of tickets) {
    for (const s of t.suitesJudiciaires) {
      repartitionSuiteJudiciaire[s.statut] = (repartitionSuiteJudiciaire[s.statut] ?? 0) + 1;
    }
  }

  const geoItems = tickets.map((t) => ({
    commune: t.etablissement.commune.nom,
    epci: t.etablissement.commune.epci,
    departement: t.etablissement.commune.departement,
  }));
  const parGeographie = applyKAnonymity(geoItems, K_ANONYMITY_THRESHOLD);

  return {
    generatedAt: new Date().toISOString(),
    kAnonymityThreshold: K_ANONYMITY_THRESHOLD,
    global: {
      totalSignalements: total,
      tauxReponseDansLesDelais,
      delaiMoyenReponseHeures,
      delaiMoyenTriangulationHeures,
      tauxEscalade,
      repartitionStatuts,
    },
    suiteJudiciaire: {
      tauxCompletudeDeclaratif,
      repartition: repartitionSuiteJudiciaire,
      avertissement:
        "Statistiques auto-déclaratives par les parents, non vérifiées auprès des institutions judiciaires.",
    },
    parGeographie,
  };
}
