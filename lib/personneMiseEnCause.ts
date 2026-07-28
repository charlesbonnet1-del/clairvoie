import type { Identity } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Cadre légal (article 46 loi Informatique et Libertés) : un particulier ne
 * peut traiter une donnée relative à une infraction que pour préparer ou
 * suivre sa propre action de victime — jamais pour constituer un fichier
 * consultable au-delà de son propre dossier. En conséquence, ce module est
 * l'UNIQUE point d'accès en lecture à PersonneMiseEnCause dans tout le
 * code : il ne fait jamais de findMany/groupBy/aggregate sur cette table
 * (voir tests/test_personne_mise_en_cause_non_agregable.test.ts), et
 * n'accepte qu'un ticketId précis — jamais un critère de recherche sur
 * nom/fonction/contexte.
 *
 * Accès autorisé :
 * - ETABLISSEMENT : uniquement s'il instruit ce ticket précis
 *   (identity.etablissementId === ticket.etablissementId).
 * - ASSOCIATION_TIERCE : oui, en charge de la triangulation.
 * - RECTORAT : uniquement si ce ticket précis est explicitement escaladé
 *   (statut "escaladé") — jamais pour un ticket non escaladé, jamais sous
 *   forme de vue consolidée.
 * - PARENT, ADMIN, dashboard public : jamais.
 */
export async function recupererPersonneMiseEnCause(params: {
  ticketId: string;
  identity: Pick<Identity, "role" | "etablissementId">;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    select: { etablissementId: true, statut: true },
  });
  if (!ticket) return null;

  const autorise =
    (params.identity.role === "ETABLISSEMENT" &&
      params.identity.etablissementId === ticket.etablissementId) ||
    params.identity.role === "ASSOCIATION_TIERCE" ||
    (params.identity.role === "RECTORAT" && ticket.statut === "escaladé");

  if (!autorise) return null;

  return prisma.personneMiseEnCause.findUnique({ where: { ticketId: params.ticketId } });
}

/**
 * Enregistre l'identification de la personne mise en cause au dépôt du
 * signalement. Champ entièrement optionnel côté parent : n'écrit rien si
 * aucune des trois valeurs n'est renseignée.
 */
export async function enregistrerPersonneMiseEnCause(params: {
  ticketId: string;
  nom?: string;
  fonction?: string;
  contexte?: string;
}): Promise<void> {
  const nom = params.nom?.trim() || null;
  const fonction = params.fonction?.trim() || null;
  const contexte = params.contexte?.trim() || null;
  if (!nom && !fonction && !contexte) return;

  await prisma.personneMiseEnCause.create({
    data: { ticketId: params.ticketId, nom, fonction, contexte },
  });
}
