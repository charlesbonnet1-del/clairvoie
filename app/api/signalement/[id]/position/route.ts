import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { enregistrerPosition } from "@/lib/positionEtablissement";
import { RegleMetierError } from "@/lib/tickets";
import { POSITIONS_ETABLISSEMENT } from "@/config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ETABLISSEMENT");
    const formData = await req.formData();
    const position = String(formData.get("position") ?? "");
    const commentaire = String(formData.get("commentaire") ?? "");

    if (!POSITIONS_ETABLISSEMENT.includes(position as (typeof POSITIONS_ETABLISSEMENT)[number])) {
      return NextResponse.redirect(
        new URL("/etablissement?error=position_invalide", req.url),
        { status: 303 }
      );
    }

    await enregistrerPosition({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      role: identity.role,
      position: position as (typeof POSITIONS_ETABLISSEMENT)[number],
      commentaire,
    });

    return NextResponse.redirect(new URL("/etablissement?success=position_enregistree", req.url), {
      status: 303,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/etablissement?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
