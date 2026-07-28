import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { declarerSuiteJudiciaire, RegleMetierError } from "@/lib/tickets";
import { STATUTS_SUITE_JUDICIAIRE } from "@/config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();
    const statut = String(formData.get("statut") ?? "");

    if (!STATUTS_SUITE_JUDICIAIRE.includes(statut as (typeof STATUTS_SUITE_JUDICIAIRE)[number])) {
      return NextResponse.redirect(
        new URL("/parent?error=statut_judiciaire_invalide", req.url),
        { status: 303 }
      );
    }

    await declarerSuiteJudiciaire({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      statut,
    });

    return NextResponse.redirect(
      new URL("/parent?success=suite_judiciaire_declaree", req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
