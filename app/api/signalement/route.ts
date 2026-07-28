import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { creerSignalement } from "@/lib/tickets";
import { GRAVITES } from "@/config";

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();
    const etablissementId = String(formData.get("etablissementId") ?? "");
    const categorie = String(formData.get("categorie") ?? "");
    const contenu = String(formData.get("contenu") ?? "");
    const gravite = String(formData.get("gravite") ?? "");

    if (!etablissementId || !categorie || !contenu.trim()) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=champs_manquants", req.url),
        { status: 303 }
      );
    }
    if (!GRAVITES.includes(gravite as (typeof GRAVITES)[number])) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=gravite_invalide", req.url),
        { status: 303 }
      );
    }

    await creerSignalement({
      parentPseudoId: identity.pseudoId,
      etablissementId,
      categorie,
      contenu,
      gravite,
    });

    return NextResponse.redirect(new URL("/parent?success=cree", req.url), { status: 303 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    throw err;
  }
}
