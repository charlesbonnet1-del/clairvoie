import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface AnnuaireRecord {
  identifiant_de_l_etablissement: string;
  nom_etablissement: string;
  type_etablissement: string;
  adresse_1?: string | null;
  code_postal?: string | null;
  nom_commune?: string | null;
}

export interface EtablissementSuggestion {
  uai: string;
  nom: string;
  type: string;
  adresse: string;
}

// Proxy vers l'annuaire public de l'éducation (data.education.gouv.fr),
// filtré sur la commune choisie et les établissements encore ouverts.
// Ne couvre que les établissements scolaires relevant de l'Éducation
// nationale — les structures périscolaires (centres de loisirs, garderies…)
// n'y figurent pas ; le formulaire propose une saisie manuelle en repli.
export async function GET(req: NextRequest) {
  const codeCommune = req.nextUrl.searchParams.get("codeCommune")?.trim();
  if (!codeCommune) {
    return NextResponse.json({ etablissements: [] });
  }

  const url = new URL(
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records"
  );
  url.searchParams.set(
    "where",
    `code_commune="${codeCommune}" AND etat="OUVERT" AND ` +
      `(type_etablissement="Ecole" OR type_etablissement="Collège" OR type_etablissement="Lycée")`
  );
  url.searchParams.set("limit", "100");

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return NextResponse.json(
      { etablissements: [], error: "annuaire_education_indisponible" },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { results: AnnuaireRecord[] };
  const etablissements: EtablissementSuggestion[] = data.results
    .map((r) => ({
      uai: r.identifiant_de_l_etablissement,
      nom: r.nom_etablissement,
      type: r.type_etablissement,
      adresse: [r.adresse_1, r.code_postal, r.nom_commune].filter(Boolean).join(", "),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return NextResponse.json({ etablissements });
}
