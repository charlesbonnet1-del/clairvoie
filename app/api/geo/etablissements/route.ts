import { NextRequest, NextResponse } from "next/server";
import { fetchAnnuaireRecords, AnnuaireIndisponibleError } from "@/lib/annuaireApi";

export const dynamic = "force-dynamic";

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

  let records;
  try {
    records = await fetchAnnuaireRecords(
      `code_commune="${codeCommune}" AND etat="OUVERT" AND ` +
        `(type_etablissement="Ecole" OR type_etablissement="Collège" OR type_etablissement="Lycée")`
    );
  } catch (err) {
    if (err instanceof AnnuaireIndisponibleError) {
      return NextResponse.json(
        { etablissements: [], error: "annuaire_education_indisponible" },
        { status: 502 }
      );
    }
    throw err;
  }

  const etablissements: EtablissementSuggestion[] = records
    .map((r) => ({
      uai: r.identifiant_de_l_etablissement,
      nom: r.nom_etablissement,
      type: r.type_etablissement,
      adresse: [r.adresse_1, r.code_postal, r.nom_commune].filter(Boolean).join(", "),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return NextResponse.json({ etablissements });
}
