import { NextRequest, NextResponse } from "next/server";

// Force le rendu à la requête : proxy vers une API tierce, jamais exécuté
// au moment du build (voir app/api/dashboard/stats/route.ts pour le détail
// de pourquoi ce genre de route doit rester dynamique).
export const dynamic = "force-dynamic";

interface GeoApiCommune {
  nom: string;
  code: string;
  epci?: { code: string; nom: string };
  departement?: { code: string; nom: string };
}

export interface CommuneSuggestion {
  nom: string;
  codeInsee: string;
  epci: string;
  departement: string;
}

// Proxy vers l'API officielle des communes françaises (data.gouv.fr /
// geo.api.gouv.fr), publique et gratuite, sans clé — recherche par nom
// pour l'autocomplétion du formulaire de signalement.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ communes: [] });
  }

  const url = new URL("https://geo.api.gouv.fr/communes");
  url.searchParams.set("nom", q);
  url.searchParams.set("fields", "nom,code,epci,departement");
  url.searchParams.set("boost", "population");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    return NextResponse.json({ communes: [], error: "geo_api_indisponible" }, { status: 502 });
  }

  const data = (await response.json()) as GeoApiCommune[];
  const communes: CommuneSuggestion[] = data.map((c) => ({
    nom: c.nom,
    codeInsee: c.code,
    epci: c.epci?.nom ?? "EPCI inconnu",
    departement: c.departement?.nom ?? "Département inconnu",
  }));

  return NextResponse.json({ communes });
}
