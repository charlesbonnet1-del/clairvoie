import { cookies } from "next/headers";
import { createHmac } from "crypto";
import type { Identity } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, type Role } from "@/config";

export { hashPassword, verifyPassword } from "./password";

// Démo uniquement : signature HMAC maison sur un cookie httpOnly. Pas de
// FranceConnect/EduConnect réel, pas de JWT tiers — volontairement simple
// pour un MVP non destiné à traiter de vraies données sensibles.
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "clairvoie-demo-secret-change-in-prod";

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function createSessionToken(identityId: string): string {
  return `${identityId}.${sign(identityId)}`;
}

export function parseSessionToken(token: string): string | null {
  const [identityId, signature] = token.split(".");
  if (!identityId || !signature) return null;
  if (sign(identityId) !== signature) return null;
  return identityId;
}

export async function getSession(): Promise<Identity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const identityId = parseSessionToken(token);
  if (!identityId) return null;
  return prisma.identity.findUnique({ where: { id: identityId } });
}

export function roleHome(role: string): string {
  switch (role) {
    case "PARENT":
      return "/parent";
    case "ETABLISSEMENT":
      return "/etablissement";
    case "ASSOCIATION_TIERCE":
      return "/association";
    case "RECTORAT":
      return "/rectorat";
    default:
      return "/dashboard";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Non autorisé") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireRole(...roles: Role[]): Promise<Identity> {
  const identity = await getSession();
  if (!identity || !roles.includes(identity.role as Role)) {
    throw new UnauthorizedError();
  }
  return identity;
}
