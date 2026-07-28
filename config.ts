/**
 * Constantes de configuration non négociables du produit Clairvoie.
 * Toute modification de ces seuils doit être délibérée et documentée.
 */

/** Nombre minimal de cas dans une maille géographique pour l'afficher
 * telle quelle sur le tableau de bord public. En dessous, l'API remonte
 * automatiquement à la maille géographique supérieure (commune -> EPCI -> département). */
export const K_ANONYMITY_THRESHOLD = 8;

/** Durée pendant laquelle une clôture par accord mutuel reste révocable par le parent. */
export const RETRACTION_WINDOW_HOURS = 48;

/** Délai laissé à un établissement pour répondre avant escalade automatique au rectorat. */
export const RESPONSE_DEADLINE_HOURS = 120;

/** Nom du cookie de session (démo — signature HMAC simple, pas de JWT tiers). */
export const SESSION_COOKIE_NAME = "clairvoie_session";

/**
 * Rôles applicatifs. Identity.role est un simple champ String (schema.prisma)
 * contraint par cette liste au niveau applicatif plutôt que par un enum
 * Postgres natif. Principe 2 non négociable : aucun rôle judiciaire
 * ("magistrat", "juge", "procureur"...) ne doit jamais y figurer.
 */
export const ROLES = [
  "PARENT",
  "ETABLISSEMENT",
  "ASSOCIATION_TIERCE",
  "RECTORAT",
  "ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

/** Gravités valides pour un signalement. */
export const GRAVITES = ["legere", "moderee", "grave"] as const;
export type Gravite = (typeof GRAVITES)[number];

/**
 * Catégories de signalement proposées au parent. La gravité n'est plus
 * auto-déclarée par le parent (retrait de l'entrée "gravité perçue") : elle
 * est dérivée automatiquement de la catégorie choisie, via
 * CATEGORIE_GRAVITE ci-dessous. Toute catégorie touchant à des violences
 * sexuelles est classée "grave" par construction, ce qui déclenche le
 * principe 8 (clôture par accord mutuel impossible, validation de
 * l'association tierce obligatoire).
 */
export const CATEGORIES = [
  "Violence physique",
  "Attouchements et sévices à caractère sexuel",
  "Violence verbale ou psychologique",
  "Harcèlement entre élèves",
  "Négligence de surveillance",
  "Autre",
] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const CATEGORIE_GRAVITE: Record<Categorie, Gravite> = {
  "Violence physique": "grave",
  "Attouchements et sévices à caractère sexuel": "grave",
  "Violence verbale ou psychologique": "moderee",
  "Harcèlement entre élèves": "moderee",
  "Négligence de surveillance": "legere",
  Autre: "moderee",
};

export function deriverGraviteDepuisCategorie(categorie: string): Gravite {
  return CATEGORIE_GRAVITE[categorie as Categorie] ?? "moderee";
}

/** Statuts valides pour un ticket. */
export const STATUTS_TICKET = [
  "ouvert",
  "répondu",
  "escaladé",
  "trianguléfondé",
  "trianguléinfondé",
  "clôturé_accord_mutuel",
] as const;
export type StatutTicket = (typeof STATUTS_TICKET)[number];

/** Verdicts possibles rendus par l'association tierce. */
export const VERDICTS = ["fondé", "à_investiguer", "infondé"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Statuts possibles d'une suite judiciaire auto-déclarée par le parent. */
export const STATUTS_SUITE_JUDICIAIRE = [
  "transmis",
  "classé_sans_suite",
  "renvoi_tribunal",
  "condamnation",
  "sans_nouvelle",
] as const;
export type StatutSuiteJudiciaire = (typeof STATUTS_SUITE_JUDICIAIRE)[number];
