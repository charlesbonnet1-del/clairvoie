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

/** Délai laissé à un établissement pour répondre avant escalade automatique au
 * rectorat. Ce délai démarre à la réception confirmée du signalement
 * (Ticket.receptionConfirmeeAt), jamais au dépôt (Ticket.createdAt) — voir
 * lib/contactVerification.ts. */
export const RESPONSE_DEADLINE_HOURS = 120;

/** Durée de fraîcheur du cache local des coordonnées d'établissement avant
 * un nouveau rafraîchissement depuis l'annuaire de l'éducation nationale. */
export const ANNUAIRE_REFRESH_DAYS = 30;

/** Délai de grâce laissé aux canaux de contact automatisés avant de
 * considérer que la réception n'a pas pu être confirmée et de transmettre
 * à l'association tierce (statut "verification_contact_requise"). */
export const CONTACT_GRACE_PERIOD_HOURS = 48;

/** Fenêtre glissante sur laquelle les échecs de contact d'un établissement
 * sont cumulés avant de déclencher une alerte qualité de données interne. */
export const ALERTE_QUALITE_FENETRE_JOURS = 90;

/** Nombre d'échecs cumulés (tous canaux confondus) dans la fenêtre ci-dessus
 * déclenchant l'alerte qualité de données. */
export const ALERTE_QUALITE_SEUIL_ECHECS = 3;

/** Types de canal de contact valides pour un établissement. */
export const TYPES_CONTACT = [
  "email",
  "telephone",
  "courrier_recommande_electronique",
  "adresse_postale",
] as const;
export type TypeContact = (typeof TYPES_CONTACT)[number];

/** Provenance d'une coordonnée de contact. */
export const SOURCES_CONTACT = [
  "annuaire_education_nationale",
  "propose_par_parent",
  "confirme_etablissement",
] as const;
export type SourceContact = (typeof SOURCES_CONTACT)[number];

/** Statut de vérification d'un canal de contact : "verifie" signifie qu'une
 * tentative de contact réelle a effectivement abouti (livrée ou ouverte),
 * jamais qu'une coordonnée provient d'une source réputée fiable. */
export const STATUTS_VERIFICATION_CONTACT = ["non_verifie", "verifie"] as const;
export type StatutVerificationContact = (typeof STATUTS_VERIFICATION_CONTACT)[number];

/** Ordre de tentative des canaux automatisés, du plus fiable au moins fiable. */
export const ORDRE_FIABILITE_CANAUX = [
  "courrier_recommande_electronique",
  "email",
  "telephone",
] as const satisfies readonly TypeContact[];

/** Statuts possibles d'une tentative de contact individuelle. */
export const STATUTS_TENTATIVE_CONTACT = [
  "envoye",
  "livre",
  "ouvert",
  "echec_rebond",
  "sans_reponse",
] as const;
export type StatutTentativeContact = (typeof STATUTS_TENTATIVE_CONTACT)[number];

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
  "Attouchements ou sévices à caractère sexuel",
  "Violence verbale ou psychologique",
  "Harcèlement entre élèves",
  "Négligence de surveillance",
  "Autre",
] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const CATEGORIE_GRAVITE: Record<Categorie, Gravite> = {
  "Violence physique": "grave",
  "Attouchements ou sévices à caractère sexuel": "grave",
  "Violence verbale ou psychologique": "moderee",
  "Harcèlement entre élèves": "moderee",
  "Négligence de surveillance": "legere",
  Autre: "moderee",
};

export function deriverGraviteDepuisCategorie(categorie: string): Gravite {
  return CATEGORIE_GRAVITE[categorie as Categorie] ?? "moderee";
}

/** Statuts valides pour un ticket. "verification_contact_requise" est
 * distinct de "escaladé" : ce n'est pas un silence de l'établissement, c'est
 * l'impossibilité de lui délivrer le signalement par un canal vérifié. */
export const STATUTS_TICKET = [
  "ouvert",
  "verification_contact_requise",
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

/** Types d'entité éligibles au classement d'exemplarité (établissements et
 * collectivités reconnus pour la qualité de leur process, jamais pour leur
 * volume de signalements — voir lib/exemplarite.ts). */
export const ENTITES_EXEMPLARITE = [
  "etablissement",
  "commune",
  "epci",
  "departement",
  "academie",
] as const;
export type EntiteExemplarite = (typeof ENTITES_EXEMPLARITE)[number];

/** Durée de validité d'un score d'exemplarité avant qu'il ne soit considéré
 * périmé et exclu de tout classement (principe 3 : aucun badge permanent). */
export const BADGE_STALENESS_DAYS = 30;

/** Largeur (en jours) de la période glissante sur laquelle les scores
 * d'exemplarité sont calculés à chaque exécution du job périodique. */
export const EXEMPLARITE_PERIODE_JOURS = 90;

/** Origine d'une suite judiciaire déclarée : la plainte directe du parent et
 * l'escalade établissement -> rectorat sont deux voies de saisine
 * indépendantes, qui peuvent coexister ("les_deux") sans jamais donner lieu
 * à un doublon d'enregistrement pour un même ticket. */
export const ORIGINES_SUITE_JUDICIAIRE = [
  "plainte_directe_parent",
  "transmission_etablissement",
  "les_deux",
] as const;
export type OrigineSuiteJudiciaire = (typeof ORIGINES_SUITE_JUDICIAIRE)[number];
