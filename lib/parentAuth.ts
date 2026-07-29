import { randomUUID, randomInt } from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { RegleMetierError } from "./tickets";

function genererCode(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Crée un compte parent. L'email et le téléphone doivent tous les deux être
 * vérifiés avant qu'un signalement puisse être déposé — voir
 * app/api/signalement/route.ts — pour que l'association tierce puisse
 * effectivement recontacter le parent si besoin.
 *
 * TODO: intégration réelle (envoi d'un email et d'un SMS de vérification).
 * Pour cette démo, aucun message n'est réellement envoyé : les codes
 * générés sont retournés à l'appelant, qui les affiche directement à
 * l'écran (voir /inscription et /verification-compte), clairement
 * labellisé comme une simulation.
 */
export async function inscrireParent(params: {
  displayName: string;
  email: string;
  password: string;
  telephone: string;
}): Promise<{ identityId: string; codeEmail: string; codeTelephone: string }> {
  const existant = await prisma.identity.findUnique({ where: { email: params.email } });
  if (existant) {
    throw new RegleMetierError("Un compte existe déjà avec cet email.");
  }
  if (!params.telephone.trim()) {
    throw new RegleMetierError("Le téléphone est requis.");
  }

  const passwordHash = await hashPassword(params.password);
  const codeEmail = genererCode();
  const codeTelephone = genererCode();

  const identity = await prisma.identity.create({
    data: {
      pseudoId: `parent-${randomUUID()}`,
      role: "PARENT",
      displayName: params.displayName,
      email: params.email,
      passwordHash,
      telephone: params.telephone.trim(),
      codeVerificationEmail: codeEmail,
      codeVerificationTelephone: codeTelephone,
    },
  });

  return { identityId: identity.id, codeEmail, codeTelephone };
}

/**
 * Coordonnées du parent auteur d'un signalement précis, scopées à un seul
 * pseudoId — jamais une recherche/liste (pas d'index ni de fonction de
 * recherche par nom exposés ici). Destinée à l'association tierce pour
 * pouvoir recontacter le parent dans le cadre de l'évaluation d'un
 * signalement qu'elle traite déjà — c'est précisément pour permettre ce
 * contact que l'email et le téléphone du parent sont vérifiés obligatoirement
 * à l'inscription (voir inscrireParent ci-dessus).
 */
export async function recupererContactParent(parentPseudoId: string): Promise<{
  email: string;
  telephone: string | null;
  emailVerifie: boolean;
  telephoneVerifie: boolean;
} | null> {
  const identity = await prisma.identity.findUnique({ where: { pseudoId: parentPseudoId } });
  if (!identity) return null;
  return {
    email: identity.email,
    telephone: identity.telephone,
    emailVerifie: identity.emailVerifie,
    telephoneVerifie: identity.telephoneVerifie,
  };
}

export async function verifierCodeContact(params: {
  identityId: string;
  canal: "email" | "telephone";
  code: string;
}): Promise<boolean> {
  const identity = await prisma.identity.findUnique({ where: { id: params.identityId } });
  if (!identity) return false;

  const codeAttendu =
    params.canal === "email" ? identity.codeVerificationEmail : identity.codeVerificationTelephone;
  if (!codeAttendu || codeAttendu !== params.code.trim()) return false;

  await prisma.identity.update({
    where: { id: params.identityId },
    data:
      params.canal === "email"
        ? { emailVerifie: true, codeVerificationEmail: null }
        : { telephoneVerifie: true, codeVerificationTelephone: null },
  });
  return true;
}
