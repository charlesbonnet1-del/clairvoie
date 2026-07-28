import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proposerContactVerifie } from "@/lib/contactVerification";
import { RegleMetierError } from "@/lib/tickets";
import { TYPES_CONTACT } from "@/config";

// Dernier recours : l'association tierce a retrouvé une coordonnée
// fonctionnelle (recherche manuelle, appel direct) pour l'établissement
// d'un ticket resté en "verification_contact_requise", et la soumet une
// fois qu'elle a déjà fonctionné.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ASSOCIATION_TIERCE");
    const formData = await req.formData();
    const type = String(formData.get("type") ?? "");
    const valeur = String(formData.get("valeur") ?? "");
    const porteur = String(formData.get("porteur") ?? "");

    if (!TYPES_CONTACT.includes(type as (typeof TYPES_CONTACT)[number]) || !valeur.trim()) {
      return NextResponse.redirect(
        new URL("/association?error=contact_invalide", req.url),
        { status: 303 }
      );
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
    if (!ticket) throw new RegleMetierError("Signalement introuvable.");

    await proposerContactVerifie({
      etablissementId: ticket.etablissementId,
      type,
      valeur,
      porteur: porteur || undefined,
      acteurPseudo: identity.pseudoId,
    });

    return NextResponse.redirect(new URL("/association?success=contact_verifie", req.url), {
      status: 303,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/association?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
