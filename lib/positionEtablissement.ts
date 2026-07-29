import { prisma } from "./prisma";
import { appendAuditLog } from "./hashchain";
import { RegleMetierError } from "./tickets";
import { DELAI_CLOTURE_PARENT_JOURS, type PositionEtablissement } from "@/config";

/**
 * Enregistre la prise de position structurée de l'établissement sur un
 * signalement — remplace l'ancienne étape unique de "réponse" libre
 * (lib/tickets.ts -> repondreSignalement, retirée). Objectif : éviter que
 * tout signalement non contesté passe systématiquement par l'association
 * tierce (charge de travail inutile sur les cas simples), sans jamais
 * permettre à l'établissement d'éteindre seul une affaire.
 *
 * Routage après enregistrement :
 * - position "conteste" OU gravite "grave" (quelle que soit la position) :
 *   statut "triangulation_requise", visible dans la file de l'association
 *   tierce ;
 * - position "non_conteste" ET gravite standard (pas "grave") : statut
 *   "attente_cloture_parent" — voir verifierClotureParent ci-dessous pour
 *   la suite si le parent ne clôture pas.
 *
 * Aucune de ces deux branches ne mène à un statut de clôture : seule
 * cloturerParAccordMutuel (lib/tickets.ts, accessible au seul rôle PARENT)
 * ou un verdict de l'association tierce (lib/tickets.ts -> trianguler)
 * peuvent clore un ticket.
 *
 * Une seule position par ticket : aucun changement rétroactif n'est permis
 * ici sans passer par une procédure de contestation dédiée et tracée
 * séparément (hors périmètre de ce MVP).
 */
export async function enregistrerPosition(params: {
  ticketId: string;
  acteurPseudo: string;
  role: string;
  position: PositionEtablissement;
  commentaire?: string | null;
}) {
  if (params.role !== "ETABLISSEMENT") {
    throw new RegleMetierError(
      "Seul un compte établissement peut prendre position sur un signalement."
    );
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");
  if (ticket.positionEtablissement) {
    throw new RegleMetierError(
      "Une position a déjà été enregistrée pour ce signalement : aucun changement rétroactif sans procédure de contestation dédiée."
    );
  }

  const maintenant = new Date();
  const versTriangulation = params.position === "conteste" || ticket.gravite === "grave";

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      positionEtablissement: params.position,
      // reponduAt fige, au même instant, le délai "établissement" déjà lu
      // par lib/dashboardStats.ts et lib/exemplarite.ts — jamais remodifié
      // ensuite, quelle que soit la durée de l'instruction qui suit.
      positionEtablissementDate: maintenant,
      reponduAt: maintenant,
      reponseContenu: params.commentaire?.trim() || null,
      statut: versTriangulation ? "triangulation_requise" : "attente_cloture_parent",
    },
  });

  await appendAuditLog({
    ticketId: params.ticketId,
    action: `position_etablissement_${params.position}`,
    acteurPseudo: params.acteurPseudo,
  });

  return updated;
}

/**
 * Job périodique (même mécanisme que lib/tickets.ts -> escaladerSiSilence,
 * appliqué ici au silence du PARENT plutôt qu'à celui de l'établissement) :
 * si un ticket non contesté (statut "attente_cloture_parent") n'a pas été
 * clôturé par le parent après DELAI_CLOTURE_PARENT_JOURS, il est transmis
 * automatiquement au rectorat plutôt que de rester sans suite indéfiniment.
 */
export async function verifierClotureParent(acteurPseudo = "system:cron") {
  const seuil = new Date(Date.now() - DELAI_CLOTURE_PARENT_JOURS * 24 * 60 * 60 * 1000);
  const aTransmettre = await prisma.ticket.findMany({
    where: { statut: "attente_cloture_parent", positionEtablissementDate: { lt: seuil } },
  });

  const transmis = [];
  for (const ticket of aTransmettre) {
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { statut: "escaladé_rectorat", escaladeAt: new Date() },
    });
    await appendAuditLog({
      ticketId: ticket.id,
      action: "escalade_silence_parent",
      acteurPseudo,
    });
    transmis.push(updated);
  }
  return transmis;
}
