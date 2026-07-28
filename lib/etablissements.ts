import { prisma } from "./prisma";
import { RegleMetierError } from "./tickets";

/**
 * Résout l'établissement choisi dans le formulaire de signalement (issu de
 * la recherche publique commune -> établissement, ou d'une saisie manuelle
 * pour une structure périscolaire non référencée par l'annuaire de
 * l'éducation) en un `etablissementId` interne, créant au passage la
 * Commune et/ou l'Établissement s'ils n'existent pas encore.
 *
 * `codeInsee` (Commune) et `uai` (Etablissement) servent de clé d'upsert
 * quand ils sont fournis (recherche via l'API publique) ; à défaut (saisie
 * manuelle), on déduplique par nom + commune plutôt que de créer une
 * nouvelle ligne à chaque signalement.
 */
export async function resoudreEtablissement(params: {
  communeCodeInsee: string;
  communeNom: string;
  communeEpci: string;
  communeDepartement: string;
  etablissementUai: string;
  etablissementNom: string;
  etablissementAdresse: string;
}): Promise<string> {
  if (!params.communeNom.trim() || !params.communeCodeInsee.trim()) {
    throw new RegleMetierError("Commune invalide.");
  }
  if (!params.etablissementNom.trim()) {
    throw new RegleMetierError("Établissement invalide.");
  }

  const commune = await prisma.commune.upsert({
    where: { codeInsee: params.communeCodeInsee },
    update: {},
    create: {
      nom: params.communeNom,
      epci: params.communeEpci || "EPCI inconnu",
      departement: params.communeDepartement || "Département inconnu",
      codeInsee: params.communeCodeInsee,
    },
  });

  if (params.etablissementUai.trim()) {
    const etablissement = await prisma.etablissement.upsert({
      where: { uai: params.etablissementUai },
      update: {},
      create: {
        nom: params.etablissementNom,
        adresse: params.etablissementAdresse || null,
        communeId: commune.id,
        uai: params.etablissementUai,
      },
    });
    return etablissement.id;
  }

  const nomManuel = params.etablissementNom.trim();
  const existant = await prisma.etablissement.findFirst({
    where: { nom: nomManuel, communeId: commune.id, uai: null },
  });
  if (existant) return existant.id;

  const cree = await prisma.etablissement.create({
    data: { nom: nomManuel, communeId: commune.id },
  });
  return cree.id;
}
