import { prisma } from "./prisma";
import {
  K_ANONYMITY_THRESHOLD,
  RESPONSE_DEADLINE_HOURS,
  BADGE_STALENESS_DAYS,
  EXEMPLARITE_PERIODE_JOURS,
  type EntiteExemplarite,
} from "@/config";

export interface Periode {
  debut: Date;
  fin: Date;
}

/**
 * Période glissante "courante" utilisée à la fois par le job de calcul
 * (lib/exemplarite.ts -> calculerScores, déclenché par le cron) et par la
 * lecture (getClassement) : bornée à des horodatages de début de journée
 * (UTC) pour que plusieurs appels le même jour désignent exactement la même
 * période, sans avoir à faire communiquer les deux appelants.
 */
export function periodeCourante(maintenant: Date = new Date()): Periode {
  const fin = new Date(maintenant);
  fin.setUTCHours(0, 0, 0, 0);
  const debut = new Date(fin.getTime() - EXEMPLARITE_PERIODE_JOURS * 24 * 60 * 60 * 1000);
  return { debut, fin };
}

interface MetriquesProcess {
  delaiMoyenReponse: number;
  tauxReponseDelai: number;
  tauxSansBlocage: number;
  nombreCasEligibles: number;
}

/**
 * Score comparable dérivé UNIQUEMENT des trois métriques de process — jamais
 * du volume de cas (nombreCasEligibles n'est délibérément pas un paramètre
 * de cette fonction). Le délai est normalisé sur l'échelle du délai officiel
 * de réponse (config.ts -> RESPONSE_DEADLINE_HOURS) pour rester comparable
 * aux deux taux, déjà entre 0 et 1.
 */
export function calculerScoreProcess(metriques: {
  delaiMoyenReponse: number;
  tauxReponseDelai: number;
  tauxSansBlocage: number;
}): number {
  const delaiNormalise =
    1 - Math.min(metriques.delaiMoyenReponse, RESPONSE_DEADLINE_HOURS) / RESPONSE_DEADLINE_HOURS;
  return (delaiNormalise + metriques.tauxReponseDelai + metriques.tauxSansBlocage) / 3;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

const STATUTS_RESOLUS_SANS_BLOCAGE = [
  "clôturé_accord_mutuel",
  "trianguléfondé",
  "trianguléinfondé",
];

/**
 * Calcule les trois métriques de process pour un groupe de tickets "clos"
 * (déjà filtrés en amont sur la période et sur le fait d'avoir quitté les
 * statuts "ouvert"/"verification_contact_requise" — voir ticketsEligibles).
 * nombreCasEligibles n'est renvoyé ici que pour la vérification du seuil
 * dans calculerScores, jamais consommé par calculerScoreProcess ci-dessus.
 */
function calculerMetriques(tickets: TicketPourExemplarite[]): MetriquesProcess {
  const avecReponse = tickets.filter((t) => t.reponduAt && t.receptionConfirmeeAt);
  const delaiMoyenReponse =
    avecReponse.length > 0
      ? avecReponse.reduce(
          (somme, t) =>
            somme + (t.reponduAt!.getTime() - t.receptionConfirmeeAt!.getTime()) / (1000 * 60 * 60),
          0
        ) / avecReponse.length
      : 0;

  const dansLesDelais = tickets.filter((t) => t.statut !== "escaladé");
  const tauxReponseDelai = tickets.length > 0 ? dansLesDelais.length / tickets.length : 0;

  const resolusSansBlocage = tickets.filter((t) =>
    STATUTS_RESOLUS_SANS_BLOCAGE.includes(t.statut)
  );
  const tauxSansBlocage = tickets.length > 0 ? resolusSansBlocage.length / tickets.length : 0;

  return { delaiMoyenReponse, tauxReponseDelai, tauxSansBlocage, nombreCasEligibles: tickets.length };
}

async function ticketsEligibles(periode: Periode) {
  return prisma.ticket.findMany({
    where: {
      receptionConfirmeeAt: { not: null, gte: periode.debut, lt: periode.fin },
      statut: { notIn: ["ouvert", "verification_contact_requise"] },
    },
    include: { etablissement: { include: { commune: true } } },
  });
}

type TicketPourExemplarite = Awaited<ReturnType<typeof ticketsEligibles>>[number];

/**
 * Parcourt chaque entité (établissement, commune, EPCI, département,
 * académie) et n'écrit un ExemplariteScore que si son nombre de cas clos
 * sur la période atteint K_ANONYMITY_THRESHOLD — en dessous, l'entité
 * n'apparaît dans aucun classement (principe 2), ni en positif ni en
 * négatif. Remplace les scores déjà calculés pour la même (entiteType,
 * entiteId, période) plutôt que d'en accumuler des doublons ; le job
 * périodique (voir app/api/cron/exemplarite/route.ts) est la seule source
 * d'appel prévue — jamais un recalcul à la volée sur une requête
 * utilisateur.
 */
export async function calculerScores(periode: Periode = periodeCourante()): Promise<number> {
  const tickets = await ticketsEligibles(periode);

  const groupes: Array<{ entiteType: EntiteExemplarite; entiteId: string; tickets: TicketPourExemplarite[] }> =
    [];

  for (const [entiteId, groupe] of groupBy(tickets, (t) => t.etablissementId)) {
    groupes.push({ entiteType: "etablissement", entiteId, tickets: groupe });
  }
  for (const [entiteId, groupe] of groupBy(tickets, (t) => t.etablissement.commune.id)) {
    groupes.push({ entiteType: "commune", entiteId, tickets: groupe });
  }
  for (const [entiteId, groupe] of groupBy(tickets, (t) => t.etablissement.commune.epci)) {
    groupes.push({ entiteType: "epci", entiteId, tickets: groupe });
  }
  for (const [entiteId, groupe] of groupBy(tickets, (t) => t.etablissement.commune.departement)) {
    groupes.push({ entiteType: "departement", entiteId, tickets: groupe });
  }
  for (const [entiteId, groupe] of groupBy(tickets, (t) => t.etablissement.commune.academie)) {
    groupes.push({ entiteType: "academie", entiteId, tickets: groupe });
  }

  let ecrits = 0;
  for (const { entiteType, entiteId, tickets: ticketsGroupe } of groupes) {
    const metriques = calculerMetriques(ticketsGroupe);
    if (metriques.nombreCasEligibles < K_ANONYMITY_THRESHOLD) continue;

    await prisma.exemplariteScore.deleteMany({
      where: {
        entiteType,
        entiteId,
        periodeDebut: periode.debut,
        periodeFin: periode.fin,
      },
    });
    await prisma.exemplariteScore.create({
      data: {
        entiteType,
        entiteId,
        periodeDebut: periode.debut,
        periodeFin: periode.fin,
        delaiMoyenReponse: metriques.delaiMoyenReponse,
        tauxReponseDelai: metriques.tauxReponseDelai,
        tauxSansBlocage: metriques.tauxSansBlocage,
        nombreCasEligibles: metriques.nombreCasEligibles,
      },
    });
    ecrits += 1;
  }

  return ecrits;
}

function whereTicketsEnRetard(entiteType: EntiteExemplarite, entiteId: string) {
  const seuil = new Date(Date.now() - RESPONSE_DEADLINE_HOURS * 60 * 60 * 1000);
  const base = { receptionConfirmeeAt: { not: null, lt: seuil }, reponduAt: null } as const;

  switch (entiteType) {
    case "etablissement":
      return { ...base, etablissementId: entiteId };
    case "commune":
      return { ...base, etablissement: { communeId: entiteId } };
    case "epci":
      return { ...base, etablissement: { commune: { epci: entiteId } } };
    case "departement":
      return { ...base, etablissement: { commune: { departement: entiteId } } };
    case "academie":
      return { ...base, etablissement: { commune: { academie: entiteId } } };
  }
}

/**
 * Vérification en temps réel (jamais mise en cache, appelée à chaque
 * affichage) : une entité dont un ticket actif est actuellement au-delà de
 * son délai de réponse ne doit jamais afficher un badge d'exemplarité,
 * quel que soit son score historique (principe 4). "Actif et en retard" =
 * réception confirmée depuis plus de RESPONSE_DEADLINE_HOURS et toujours
 * sans réponse — couvre aussi bien un ticket pas encore escaladé par le cron
 * qu'un ticket déjà escaladé et toujours non résolu.
 */
export async function estExemplaireSuspendu(
  entiteType: EntiteExemplarite,
  entiteId: string
): Promise<boolean> {
  const ticketEnRetard = await prisma.ticket.findFirst({
    where: whereTicketsEnRetard(entiteType, entiteId),
  });
  return ticketEnRetard !== null;
}

export interface EntreeClassement {
  entiteType: EntiteExemplarite;
  entiteId: string;
  delaiMoyenReponse: number;
  tauxReponseDelai: number;
  tauxSansBlocage: number;
  calculeLe: Date;
  scoreProcess: number;
}

/**
 * Classement d'exemplarité pour un type d'entité et une période donnés,
 * triés par score de process décroissant. Exclut automatiquement :
 * - tout score de plus de BADGE_STALENESS_DAYS (principe 3, aucun badge
 *   permanent) ;
 * - toute entité pour laquelle estExemplaireSuspendu retourne true
 *   (principe 4, vérifié à chaque appel, jamais mis en cache).
 * Ne renvoie jamais nombreCasEligibles ni aucune valeur brute de volume —
 * uniquement les métriques de process et le score qui en dérive.
 */
export async function getClassement(
  entiteType: EntiteExemplarite,
  periode: Periode = periodeCourante()
): Promise<EntreeClassement[]> {
  const scores = await prisma.exemplariteScore.findMany({
    where: { entiteType, periodeDebut: periode.debut, periodeFin: periode.fin },
  });

  const seuilPeremption = new Date(Date.now() - BADGE_STALENESS_DAYS * 24 * 60 * 60 * 1000);
  const encoreValides = scores.filter((s) => s.calculeLe >= seuilPeremption);

  const resultat: EntreeClassement[] = [];
  for (const score of encoreValides) {
    if (await estExemplaireSuspendu(entiteType, score.entiteId)) continue;
    resultat.push({
      entiteType: score.entiteType as EntiteExemplarite,
      entiteId: score.entiteId,
      delaiMoyenReponse: score.delaiMoyenReponse,
      tauxReponseDelai: score.tauxReponseDelai,
      tauxSansBlocage: score.tauxSansBlocage,
      calculeLe: score.calculeLe,
      scoreProcess: calculerScoreProcess(score),
    });
  }

  return resultat.sort((a, b) => b.scoreProcess - a.scoreProcess);
}
