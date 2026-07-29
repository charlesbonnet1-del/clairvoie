import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { trianguler, RegleMetierError } from "@/lib/tickets";
import { VERDICTS } from "@/config";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ASSOCIATION_TIERCE");
    const formData = await req.formData();
    const verdict = String(formData.get("verdict") ?? "");

    if (!VERDICTS.includes(verdict as (typeof VERDICTS)[number])) {
      return NextResponse.redirect(
        new URL(`/association/${params.id}?error=verdict_invalide`, req.url),
        { status: 303 }
      );
    }

    await trianguler({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      verdict: verdict as "fondé" | "à_investiguer" | "infondé",
    });

    return NextResponse.redirect(
      new URL(`/association/${params.id}?success=verdict_rendu`, req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/association/${params.id}?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
