import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { traiterRelance } from "@/lib/dormance";
import { RegleMetierError } from "@/lib/tickets";
import { RESULTATS_RELANCE_DORMANCE } from "@/config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ASSOCIATION_TIERCE");
    const formData = await req.formData();
    const resultat = String(formData.get("resultat") ?? "");

    if (!RESULTATS_RELANCE_DORMANCE.includes(resultat as (typeof RESULTATS_RELANCE_DORMANCE)[number])) {
      return NextResponse.redirect(
        new URL("/association?error=resultat_relance_invalide", req.url),
        { status: 303 }
      );
    }

    await traiterRelance({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      role: identity.role,
      resultat: resultat as (typeof RESULTATS_RELANCE_DORMANCE)[number],
    });

    return NextResponse.redirect(new URL("/association?success=relance_traitee", req.url), {
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
