import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { repondreSignalement, RegleMetierError } from "@/lib/tickets";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("ETABLISSEMENT");
    const formData = await req.formData();
    const reponseContenu = String(formData.get("reponseContenu") ?? "");

    if (!reponseContenu.trim()) {
      return NextResponse.redirect(
        new URL("/etablissement?error=reponse_vide", req.url),
        { status: 303 }
      );
    }

    await repondreSignalement({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      reponseContenu,
    });

    return NextResponse.redirect(new URL("/etablissement?success=repondu", req.url), {
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
