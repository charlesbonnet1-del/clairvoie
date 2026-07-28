import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { verifierCodeContact } from "@/lib/parentAuth";

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();
    const canal = String(formData.get("canal") ?? "");
    const code = String(formData.get("code") ?? "");

    if (canal !== "email" && canal !== "telephone") {
      return NextResponse.redirect(new URL("/verification-compte?error=canal_invalide", req.url), {
        status: 303,
      });
    }

    const succes = await verifierCodeContact({ identityId: identity.id, canal, code });
    if (!succes) {
      return NextResponse.redirect(
        new URL(`/verification-compte?error=code_invalide_${canal}`, req.url),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      new URL(`/verification-compte?success=${canal}_verifie`, req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    throw err;
  }
}
