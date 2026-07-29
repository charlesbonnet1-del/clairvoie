import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { marquerVerifie } from "@/lib/rectoratContacts";
import { RegleMetierError } from "@/lib/errors";
import { TYPES_CONTACT_RECTORAT } from "@/config";

function champTexte(formData: FormData, nom: string): string | null {
  const valeur = String(formData.get(nom) ?? "").trim();
  return valeur || null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { academie: string } }
) {
  const academie = decodeURIComponent(params.academie);
  try {
    const identity = await requireRole("ADMIN");
    const formData = await req.formData();
    const typeContactPrefere = String(formData.get("typeContactPrefere") ?? "");

    if (
      !TYPES_CONTACT_RECTORAT.includes(typeContactPrefere as (typeof TYPES_CONTACT_RECTORAT)[number])
    ) {
      return NextResponse.redirect(
        new URL("/admin/rectorats?error=type_contact_invalide", req.url),
        { status: 303 }
      );
    }

    await marquerVerifie({
      academie,
      compteAdminId: identity.pseudoId,
      champsMisAJour: {
        typeContactPrefere: typeContactPrefere as (typeof TYPES_CONTACT_RECTORAT)[number],
        medieurEmail: champTexte(formData, "medieurEmail"),
        medieurTelephone: champTexte(formData, "medieurTelephone"),
        secretariatEmail: champTexte(formData, "secretariatEmail"),
        secretariatTelephone: champTexte(formData, "secretariatTelephone"),
        standardTelephone: champTexte(formData, "standardTelephone"),
        standardAdresse: champTexte(formData, "standardAdresse"),
      },
    });

    return NextResponse.redirect(new URL("/admin/rectorats?success=1", req.url), {
      status: 303,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/admin/rectorats?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
