import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { creerSignalement, RegleMetierError } from "@/lib/tickets";
import { resoudreEtablissement } from "@/lib/etablissements";
import { CATEGORIES, deriverGraviteDepuisCategorie } from "@/config";

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();
    const communeCodeInsee = String(formData.get("communeCodeInsee") ?? "");
    const communeNom = String(formData.get("communeNom") ?? "");
    const communeEpci = String(formData.get("communeEpci") ?? "");
    const communeDepartement = String(formData.get("communeDepartement") ?? "");
    const etablissementUai = String(formData.get("etablissementUai") ?? "");
    const etablissementNom = String(formData.get("etablissementNom") ?? "");
    const etablissementAdresse = String(formData.get("etablissementAdresse") ?? "");
    const categorie = String(formData.get("categorie") ?? "");
    const contenu = String(formData.get("contenu") ?? "");

    if (!communeNom || !etablissementNom || !categorie || !contenu.trim()) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=champs_manquants", req.url),
        { status: 303 }
      );
    }
    if (!CATEGORIES.includes(categorie as (typeof CATEGORIES)[number])) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=categorie_invalide", req.url),
        { status: 303 }
      );
    }

    const etablissementId = await resoudreEtablissement({
      communeCodeInsee,
      communeNom,
      communeEpci,
      communeDepartement,
      etablissementUai,
      etablissementNom,
      etablissementAdresse,
    });

    await creerSignalement({
      parentPseudoId: identity.pseudoId,
      etablissementId,
      categorie,
      contenu,
      gravite: deriverGraviteDepuisCategorie(categorie),
    });

    return NextResponse.redirect(new URL("/parent?success=cree", req.url), { status: 303 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent/nouveau-signalement?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
