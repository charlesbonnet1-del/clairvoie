import { createHash } from "crypto";
import { prisma } from "./prisma";

/** Hash "genèse" pour la première entrée de la chaîne d'un ticket. */
export const GENESIS_HASH = "0".repeat(64);

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function computeEntryHash(params: {
  ticketId: string;
  action: string;
  acteurPseudo: string;
  hashPrecedent: string;
  timestamp: string;
}): string {
  return sha256(
    [
      params.ticketId,
      params.action,
      params.acteurPseudo,
      params.hashPrecedent,
      params.timestamp,
    ].join("|")
  );
}

/**
 * Ajoute une entrée au journal d'audit d'un ticket, chaînée par hash sur
 * l'entrée précédente. `acteurPseudo` doit être l'identifiant pseudonyme du
 * compte authentifié à l'origine de l'action (provenance, principe 7).
 */
export async function appendAuditLog(params: {
  ticketId: string;
  action: string;
  acteurPseudo: string;
}) {
  const last = await prisma.auditLog.findFirst({
    where: { ticketId: params.ticketId },
    orderBy: { timestamp: "desc" },
  });
  const hashPrecedent = last ? last.hashCourant : GENESIS_HASH;
  const timestamp = new Date();
  const hashCourant = computeEntryHash({
    ticketId: params.ticketId,
    action: params.action,
    acteurPseudo: params.acteurPseudo,
    hashPrecedent,
    timestamp: timestamp.toISOString(),
  });

  return prisma.auditLog.create({
    data: {
      ticketId: params.ticketId,
      action: params.action,
      acteurPseudo: params.acteurPseudo,
      hashPrecedent,
      hashCourant,
      timestamp,
    },
  });
}

export interface ChainIntegrityResult {
  valid: boolean;
  /** id de la première entrée dont le chaînage ou le hash ne correspond plus. */
  brokenAtEntryId?: string;
  entriesChecked: number;
}

/**
 * Recalcule intégralement la chaîne de hash d'un ticket et vérifie qu'aucun
 * maillon n'a été altéré depuis sa création.
 */
export async function verifyChainIntegrity(
  ticketId: string
): Promise<ChainIntegrityResult> {
  const entries = await prisma.auditLog.findMany({
    where: { ticketId },
    orderBy: { timestamp: "asc" },
  });

  let expectedPrecedent = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.hashPrecedent !== expectedPrecedent) {
      return { valid: false, brokenAtEntryId: entry.id, entriesChecked: entries.length };
    }
    const recomputed = computeEntryHash({
      ticketId: entry.ticketId,
      action: entry.action,
      acteurPseudo: entry.acteurPseudo,
      hashPrecedent: entry.hashPrecedent,
      timestamp: entry.timestamp.toISOString(),
    });
    if (recomputed !== entry.hashCourant) {
      return { valid: false, brokenAtEntryId: entry.id, entriesChecked: entries.length };
    }
    expectedPrecedent = entry.hashCourant;
  }

  return { valid: true, entriesChecked: entries.length };
}
