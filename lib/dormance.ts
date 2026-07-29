import { prisma } from "./prisma";
import { appendAuditLog } from "./hashchain";
import { RegleMetierError } from "./tickets";
import { statutNormalDuTicket } from "./positionEtablissement";
import { DELAI_PLANCHER_DORMANCE_JOURS, type ResultatRelanceDormance } from "@/config";

/**
 * Signalement, par l'établissement, d'un ticket dormant (parent ne donnant
 * plus signe de vie) — étend le mécanisme de relance déjà en place pour
 * l'association tierce (section 4.4 du PRD). Objectif : éviter
 * l'accumulation de tickets ouverts sans jamais donner à l'établissement le
 * pouvoir de les faire disparaître de ses propres statistiques.
 *
 * N'agit JAMAIS directement sur le statut du ticket : se contente de créer
 * une entrée SignalementDormance et d'alimenter la file de relance de
 * l'association tierce, distincte de la file de triangulation existante.
 * Seule traiterRelance ci-dessous (rôle ASSOCIATION_TIERCE exclusivement)
 * peut ensuite faire évoluer ce statut.
 *
 * Refuse tout signalement précoce (ticket créé il y a moins de
 * DELAI_PLANCHER_DORMANCE_JOURS) et toute relance déjà en attente de
 * traitement pour ce ticket (pas de doublon de tâche).
 */
export async function signalerDormance(params: {
  ticketId: string;
  acteurPseudo: string;
  role: string;
}) {
  if (params.role !== "ETABLISSEMENT") {
    throw new RegleMetierError(
      "Seul un compte établissement peut signaler un ticket comme dormant."
    );
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  const seuil = new Date(Date.now() - DELAI_PLANCHER_DORMANCE_JOURS * 24 * 60 * 60 * 1000);
  if (ticket.createdAt > seuil) {
    throw new RegleMetierError(
      `Un signalement ne peut être signalé comme dormant que ${DELAI_PLANCHER_DORMANCE_JOURS} jours après son dépôt.`
    );
  }

  const dejaSignale = await prisma.signalementDormance.findFirst({
    where: { ticketId: params.ticketId, relanceEffectuee: false },
  });
  if (dejaSignale) {
    throw new RegleMetierError(
      "Une relance est déjà en attente de traitement par l'association tierce pour ce signalement."
    );
  }

  const signalement = await prisma.signalementDormance.create({
    data: { ticketId: params.ticketId, signalePar: params.acteurPseudo },
  });

  await appendAuditLog({
    ticketId: params.ticketId,
    action: "dormance_signalee",
    acteurPseudo: params.acteurPseudo,
  });

  return signalement;
}

/**
 * Traitement de la relance par l'association tierce — seule fonction
 * habilitée à faire évoluer le statut d'un ticket suite à un signalement de
 * dormance.
 * - "reponse_obtenue" : le ticket reprend son cours normal avec les
 *   nouvelles informations du parent (statutNormalDuTicket, même règle de
 *   routage que lib/positionEtablissement.ts -> enregistrerPosition).
 * - "sans_nouvelle" : statut dédié "sans_nouvelle" — jamais un statut de
 *   clôture ("clôturé_accord_mutuel", "trianguléfondé", "trianguléinfondé")
 *   déguisé. Alimente les statistiques agrégées comme une catégorie à
 *   part, cohérente avec le taux de complétude (section 4.4 du PRD).
 */
export async function traiterRelance(params: {
  ticketId: string;
  acteurPseudo: string;
  role: string;
  resultat: ResultatRelanceDormance;
}) {
  if (params.role !== "ASSOCIATION_TIERCE") {
    throw new RegleMetierError(
      "Seule l'association tierce peut traiter une relance de ticket dormant."
    );
  }

  const signalement = await prisma.signalementDormance.findFirst({
    where: { ticketId: params.ticketId, relanceEffectuee: false },
    orderBy: { signaleLe: "desc" },
  });
  if (!signalement) {
    throw new RegleMetierError("Aucune relance en attente de traitement pour ce signalement.");
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  await prisma.signalementDormance.update({
    where: { id: signalement.id },
    data: { relanceEffectuee: true, resultatRelance: params.resultat },
  });

  const nouveauStatut =
    params.resultat === "reponse_obtenue" ? statutNormalDuTicket(ticket) : "sans_nouvelle";

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: { statut: nouveauStatut },
  });

  await appendAuditLog({
    ticketId: params.ticketId,
    action: `relance_traitee_${params.resultat}`,
    acteurPseudo: params.acteurPseudo,
  });

  return updated;
}
