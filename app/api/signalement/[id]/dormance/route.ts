import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { signalerDormance } from "@/lib/dormance";
import { RegleMetierError } from "@/lib/tickets";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ETABLISSEMENT");

    await signalerDormance({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      role: identity.role,
    });

    return NextResponse.redirect(
      new URL(`/etablissement/${params.id}?success=dormance_signalee`, req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/etablissement/${params.id}?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
