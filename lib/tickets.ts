import { prisma } from "./prisma";
import { appendAuditLog } from "./hashchain";
import { RESPONSE_DEADLINE_HOURS, RETRACTION_WINDOW_HOURS } from "@/config";

export class RegleMetierError extends Error {}

export async function creerSignalement(params: {
  parentPseudoId: string;
  etablissementId: string;
  categorie: string;
  contenu: string;
  gravite: string;
  dateFaits?: Date | null;
  horaireFaits?: string | null;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      parentPseudoId: params.parentPseudoId,
      etablissementId: params.etablissementId,
      categorie: params.categorie,
      contenu: params.contenu,
      gravite: params.gravite,
      statut: "ouvert",
      dateFaits: params.dateFaits ?? null,
      horaireFaits: params.horaireFaits ?? null,
    },
  });
  await appendAuditLog({
    ticketId: ticket.id,
    action: "creation",
    acteurPseudo: params.parentPseudoId,
  });
  return ticket;
}

/**
 * Escalade automatiquement (silence de l'établissement) les tickets ouverts
 * depuis plus de RESPONSE_DEADLINE_HOURS sans réponse. Appelé par le cron.
 *
 * Le délai se compte depuis receptionConfirmeeAt, jamais depuis createdAt :
 * tant qu'aucun canal de contact n'a été confirmé, le ticket ne relève pas
 * du silence de l'établissement mais du parcours de vérification de contact
 * (voir lib/contactVerification.ts -> evaluerEchecsGracePeriod).
 */
export async function escaladerSiSilence(acteurPseudo = "system:cron") {
  const seuil = new Date(Date.now() - RESPONSE_DEADLINE_HOURS * 60 * 60 * 1000);
  const aEscalader = await prisma.ticket.findMany({
    where: { statut: "ouvert", receptionConfirmeeAt: { not: null, lt: seuil } },
  });

  const escalades = [];
  for (const ticket of aEscalader) {
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { statut: "escaladé", escaladeAt: new Date() },
    });
    await appendAuditLog({
      ticketId: ticket.id,
      action: "escalade_silence",
      acteurPseudo,
    });
    escalades.push(updated);
  }
  return escalades;
}

export async function trianguler(params: {
  ticketId: string;
  acteurPseudo: string;
  verdict: "fondé" | "à_investiguer" | "infondé";
}) {
  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  const statutParVerdict: Record<string, string> = {
    fondé: "trianguléfondé",
    à_investiguer: "escaladé",
    infondé: "trianguléinfondé",
  };

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      verdict: params.verdict,
      verdictAt: new Date(),
      statut: statutParVerdict[params.verdict],
    },
  });
  await appendAuditLog({
    ticketId: params.ticketId,
    action: `verdict_${params.verdict}`,
    acteurPseudo: params.acteurPseudo,
  });
  return updated;
}

/**
 * Clôture par accord mutuel (principe 8). Si le signalement est classé
 * "grave", la clôture directe est refusée : elle doit passer par la
 * validation de l'association tierce (triangulation -> verdict). Sinon, le
 * statut reste révocable pendant RETRACTION_WINDOW_HOURS.
 */
export async function cloturerParAccordMutuel(params: {
  ticketId: string;
  acteurPseudo: string;
}) {
  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  if (ticket.gravite === "grave") {
    throw new RegleMetierError(
      "Clôture directe refusée pour un signalement grave : la validation de l'association tierce est requise."
    );
  }

  const now = new Date();
  const revocableJusqua = new Date(now.getTime() + RETRACTION_WINDOW_HOURS * 60 * 60 * 1000);

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: {
      statut: "clôturé_accord_mutuel",
      clotureAt: now,
      clotureRevocableJusqua: revocableJusqua,
    },
  });
  await appendAuditLog({
    ticketId: params.ticketId,
    action: "cloture_accord_mutuel",
    acteurPseudo: params.acteurPseudo,
  });
  return updated;
}

/** Révocation de la clôture par accord mutuel, tant que la fenêtre de
 * rétractation n'est pas dépassée. */
export async function retracterCloture(params: {
  ticketId: string;
  acteurPseudo: string;
}) {
  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");
  if (ticket.statut !== "clôturé_accord_mutuel") {
    throw new RegleMetierError("Ce signalement n'est pas clôturé par accord mutuel.");
  }
  if (!ticket.clotureRevocableJusqua || ticket.clotureRevocableJusqua < new Date()) {
    throw new RegleMetierError("La fenêtre de rétractation est dépassée.");
  }

  const updated = await prisma.ticket.update({
    where: { id: params.ticketId },
    data: { statut: "escaladé", clotureAt: null, clotureRevocableJusqua: null },
  });
  await appendAuditLog({
    ticketId: params.ticketId,
    action: "retractation_cloture",
    acteurPseudo: params.acteurPseudo,
  });
  return updated;
}

export async function declarerSuiteJudiciaire(params: {
  ticketId: string;
  acteurPseudo: string;
  statut: string;
  documentRef?: string | null;
}) {
  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  // origine par défaut ("transmission_etablissement", cf. schema.prisma) :
  // ce parcours générique préexiste à la distinction des deux origines et
  // reste rattaché à la voie établissement -> rectorat.
  const suite = await prisma.suiteJudiciaire.create({
    data: {
      ticketId: params.ticketId,
      statut: params.statut,
      documentRef: params.documentRef ?? null,
    },
  });
  await appendAuditLog({
    ticketId: params.ticketId,
    action: "suite_judiciaire_declaree",
    acteurPseudo: params.acteurPseudo,
  });
  return suite;
}

/**
 * Déclaration par le parent d'une plainte déposée directement auprès de la
 * police/gendarmerie — indépendante du statut d'escalade établissement ->
 * rectorat du ticket. N'est jamais enregistrée sans document justificatif
 * (récépissé de dépôt de plainte) : la fiabilité de cette déclaration en
 * dépend, contrairement au reste de SuiteJudiciaire qui reste purement
 * auto-déclaratif. Cette information n'est jamais transmise à
 * l'établissement (seul un fait informatif l'est, voir le bandeau côté
 * etablissement/page.tsx — jamais le document lui-même).
 *
 * Si une SuiteJudiciaire existe déjà pour ce ticket avec origine
 * "transmission_etablissement", elle est mise à jour vers "les_deux" plutôt
 * que de créer un second enregistrement ; une déclaration répétée est elle
 * aussi idempotente (aucun doublon).
 */
export async function declarerPlainteDirecte(params: {
  ticketId: string;
  acteurPseudo: string;
  documentRef: string;
}) {
  if (!params.documentRef.trim()) {
    throw new RegleMetierError(
      "Le document justificatif (récépissé de dépôt de plainte) est obligatoire pour enregistrer une plainte directe."
    );
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) throw new RegleMetierError("Signalement introuvable.");

  const transmissionExistante = await prisma.suiteJudiciaire.findFirst({
    where: { ticketId: params.ticketId, origine: "transmission_etablissement" },
    orderBy: { declaredAt: "desc" },
  });

  let suite;
  if (transmissionExistante) {
    suite = await prisma.suiteJudiciaire.update({
      where: { id: transmissionExistante.id },
      data: { origine: "les_deux", documentRef: params.documentRef },
    });
  } else {
    const plainteExistante = await prisma.suiteJudiciaire.findFirst({
      where: { ticketId: params.ticketId, origine: { in: ["plainte_directe_parent", "les_deux"] } },
      orderBy: { declaredAt: "desc" },
    });

    suite = plainteExistante
      ? await prisma.suiteJudiciaire.update({
          where: { id: plainteExistante.id },
          data: { documentRef: params.documentRef },
        })
      : await prisma.suiteJudiciaire.create({
          data: {
            ticketId: params.ticketId,
            origine: "plainte_directe_parent",
            statut: "transmis",
            documentRef: params.documentRef,
          },
        });
  }

  await appendAuditLog({
    ticketId: params.ticketId,
    action: "plainte_directe_declaree",
    acteurPseudo: params.acteurPseudo,
  });
  return suite;
}
