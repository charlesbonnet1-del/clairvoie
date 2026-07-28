/**
 * Accès bas niveau, partagé, à l'annuaire public de l'éducation nationale
 * (data.education.gouv.fr, dataset "fr-en-annuaire-education"). Toute
 * intégration à cette API — recherche d'établissements par commune pour le
 * formulaire de signalement (app/api/geo/etablissements), ou synchronisation
 * des coordonnées de contact par UAI (lib/annuaire.ts) — passe par ce même
 * point d'entrée plutôt que de dupliquer l'appel HTTP.
 */

export interface AnnuaireRecord {
  identifiant_de_l_etablissement: string;
  nom_etablissement: string;
  type_etablissement: string;
  adresse_1?: string | null;
  code_postal?: string | null;
  code_commune?: string | null;
  nom_commune?: string | null;
  telephone?: string | null;
  mail?: string | null;
}

const ANNUAIRE_BASE_URL =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records";

export class AnnuaireIndisponibleError extends Error {
  constructor(cause?: unknown) {
    super("L'annuaire de l'éducation nationale est momentanément indisponible.");
    this.name = "AnnuaireIndisponibleError";
    if (cause) this.cause = cause;
  }
}

export async function fetchAnnuaireRecords(
  whereClause: string,
  limit = 100
): Promise<AnnuaireRecord[]> {
  const url = new URL(ANNUAIRE_BASE_URL);
  url.searchParams.set("where", whereClause);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new AnnuaireIndisponibleError(err);
  }
  if (!response.ok) {
    throw new AnnuaireIndisponibleError(new Error(`HTTP ${response.status}`));
  }

  const data = (await response.json()) as { results: AnnuaireRecord[] };
  return data.results;
}
