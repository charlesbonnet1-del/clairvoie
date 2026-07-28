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
 * Rôles applicatifs. Le connecteur SQLite ne supportant pas les enums natifs
 * Prisma, cette liste (et non le schéma) fait foi : Identity.role est un
 * simple champ String contraint par ce type au niveau applicatif.
 * Principe 2 non négociable : aucun rôle judiciaire ("magistrat", "juge",
 * "procureur"...) ne doit jamais y figurer.
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
