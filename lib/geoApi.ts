/**
 * Accès bas niveau, partagé, à l'API officielle des communes françaises
 * (geo.api.gouv.fr) — recherche par nom pour l'autocomplétion du formulaire
 * de signalement (app/api/geo/communes), et recherche par code INSEE pour
 * compléter EPCI/département quand seul le code est connu (lib/annuaire.ts,
 * qui obtient code_commune depuis l'annuaire de l'éducation mais pas l'EPCI).
 */

export interface GeoApiCommune {
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

const GEO_API_FIELDS = "nom,code,epci,departement";

function versSuggestion(c: GeoApiCommune): CommuneSuggestion {
  return {
    nom: c.nom,
    codeInsee: c.code,
    epci: c.epci?.nom ?? "EPCI inconnu",
    departement: c.departement?.nom ?? "Département inconnu",
  };
}

export async function rechercherCommunesParNom(nom: string): Promise<CommuneSuggestion[]> {
  const url = new URL("https://geo.api.gouv.fr/communes");
  url.searchParams.set("nom", nom);
  url.searchParams.set("fields", GEO_API_FIELDS);
  url.searchParams.set("boost", "population");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`geo.api.gouv.fr HTTP ${response.status}`);

  const data = (await response.json()) as GeoApiCommune[];
  return data.map(versSuggestion);
}

export async function recupererCommuneParCode(
  codeInsee: string
): Promise<CommuneSuggestion | null> {
  const url = new URL(`https://geo.api.gouv.fr/communes/${codeInsee}`);
  url.searchParams.set("fields", GEO_API_FIELDS);

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`geo.api.gouv.fr HTTP ${response.status}`);

  const data = (await response.json()) as GeoApiCommune;
  return versSuggestion(data);
}
