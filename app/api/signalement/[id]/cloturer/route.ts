import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { cloturerParAccordMutuel, retracterCloture, RegleMetierError } from "@/lib/tickets";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();
    const action = String(formData.get("action") ?? "cloturer");

    if (action === "retracter") {
      await retracterCloture({ ticketId: params.id, acteurPseudo: identity.pseudoId });
    } else {
      await cloturerParAccordMutuel({ ticketId: params.id, acteurPseudo: identity.pseudoId });
    }

    return NextResponse.redirect(new URL(`/parent/${params.id}?success=cloture`, req.url), {
      status: 303,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent/${params.id}?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
