/**
 * Correspondance département -> académie. Table statique, volontairement
 * limitée aux départements réellement rencontrés par ce MVP (données de
 * démonstration et tests) — le découpage académique officiel est fixé par
 * arrêté ministériel et n'est pas exposé par geo.api.gouv.fr ; à remplacer
 * par un référentiel officiel avant tout usage en production.
 * TODO: intégration réelle (référentiel académique officiel)
 */
const DEPARTEMENT_VERS_ACADEMIE: Record<string, string> = {
  Ardèche: "Académie de Grenoble",
  Isère: "Académie de Grenoble",
  Rhône: "Académie de Lyon",
};

export function deriverAcademie(departement: string): string {
  return DEPARTEMENT_VERS_ACADEMIE[departement] ?? "Académie inconnue";
}
