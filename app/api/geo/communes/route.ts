import { NextRequest, NextResponse } from "next/server";
import { rechercherCommunesParNom } from "@/lib/geoApi";

export type { CommuneSuggestion } from "@/lib/geoApi";

// Force le rendu à la requête : proxy vers une API tierce, jamais exécuté
// au moment du build (voir app/api/dashboard/stats/route.ts pour le détail
// de pourquoi ce genre de route doit rester dynamique).
export const dynamic = "force-dynamic";

// Proxy vers l'API officielle des communes françaises (geo.api.gouv.fr),
// publique et gratuite, sans clé — recherche par nom pour l'autocomplétion
// du formulaire de signalement.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ communes: [] });
  }

  try {
    const communes = await rechercherCommunesParNom(q);
    return NextResponse.json({ communes });
  } catch {
    return NextResponse.json({ communes: [], error: "geo_api_indisponible" }, { status: 502 });
  }
}
