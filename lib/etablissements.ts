import { prisma } from "./prisma";
import { RegleMetierError } from "./tickets";
import { syncEtablissementDepuisAnnuaire } from "./annuaire";
import { deriverAcademie } from "./academies";

/**
 * Résout l'établissement choisi dans le formulaire de signalement en un
 * `etablissementId` interne.
 *
 * Quand un UAI est fourni (établissement choisi dans la recherche publique),
 * on délègue entièrement à syncEtablissementDepuisAnnuaire : le nom, la
 * commune et les coordonnées de contact viennent de l'annuaire officiel
 * interrogé côté serveur, jamais des champs cachés soumis par le
 * navigateur — la saisie du parent n'est jamais la source de vérité des
 * coordonnées d'établissement.
 *
 * À défaut d'UAI (structure périscolaire absente de cet annuaire, saisie
 * manuelle), on upserte Commune (par code INSEE) et on déduplique
 * l'Établissement par nom + commune plutôt que d'en créer un nouveau à
 * chaque signalement.
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

  if (params.etablissementUai.trim()) {
    const etablissement = await syncEtablissementDepuisAnnuaire(params.etablissementUai.trim());
    return etablissement.id;
  }

  const communeDepartement = params.communeDepartement || "Département inconnu";
  const commune = await prisma.commune.upsert({
    where: { codeInsee: params.communeCodeInsee },
    update: {},
    create: {
      nom: params.communeNom,
      epci: params.communeEpci || "EPCI inconnu",
      departement: communeDepartement,
      academie: deriverAcademie(communeDepartement),
      codeInsee: params.communeCodeInsee,
    },
  });

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

/**
 * Un parent peut proposer un moyen de contact secondaire pour
 * l'établissement (email, téléphone avec son porteur, adresse postale).
 * Ce n'est jamais la source principale des coordonnées : le canal créé
 * reste `source = "propose_par_parent"` et `statutVerification =
 * "non_verifie"` jusqu'à ce qu'une tentative de contact réelle aboutisse.
 */
export async function ajouterContactSecondaireParent(params: {
  etablissementId: string;
  type: string;
  valeur: string;
  porteur?: string;
}): Promise<void> {
  if (!params.valeur.trim()) return;

  await prisma.contactCanal.create({
    data: {
      etablissementId: params.etablissementId,
      type: params.type,
      valeur: params.valeur.trim(),
      porteur: params.porteur?.trim() || null,
      source: "propose_par_parent",
      statutVerification: "non_verifie",
    },
  });
}
