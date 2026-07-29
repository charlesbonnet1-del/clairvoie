import { prisma } from "./prisma";
import { RegleMetierError } from "./errors";
import { RECTORAT_REVERIFICATION_MOIS, type TypeContactRectorat } from "@/config";
import type { RectoratContact } from "@prisma/client";

export interface DonneesRectoratSeed {
  academie: string;
  mediateurEmail?: string | null;
  mediateurTelephone?: string | null;
  secretariatEmail?: string | null;
  secretariatTelephone?: string | null;
  standardTelephone?: string | null;
  standardAdresse?: string | null;
}

/**
 * Peuple (ou complète, sans écraser une entrée déjà présente) les fiches de
 * contact rectorat à partir d'un jeu de données d'amorçage (typiquement le
 * jeu MESRI "Rectorats d'académies et vice-rectorats"). Script à exécuter
 * UNE SEULE FOIS (voir prisma/seed.ts), jamais un job périodique : ce jeu de
 * données n'est jamais une source de vérité continue, sa fraîcheur réelle
 * n'étant pas garantie. Toute entrée créée ici reste `statutVerification =
 * "a_verifier"` — aucune coordonnée importée n'est jamais traitée comme
 * fiable par défaut.
 */
export async function seedRectoratContacts(donnees: DonneesRectoratSeed[]): Promise<number> {
  let compte = 0;
  for (const entree of donnees) {
    const existant = await prisma.rectoratContact.findUnique({
      where: { academie: entree.academie },
    });
    if (existant) continue;

    await prisma.rectoratContact.create({
      data: {
        academie: entree.academie,
        typeContactPrefere: "standard_rectorat",
        medieurEmail: entree.mediateurEmail ?? null,
        medieurTelephone: entree.mediateurTelephone ?? null,
        secretariatEmail: entree.secretariatEmail ?? null,
        secretariatTelephone: entree.secretariatTelephone ?? null,
        standardTelephone: entree.standardTelephone ?? null,
        standardAdresse: entree.standardAdresse ?? null,
        source: "mesri_seed",
        statutVerification: "a_verifier",
      },
    });
    compte += 1;
  }
  return compte;
}

export interface ContactEscaladeResolu {
  academie: string;
  typeUtilise: TypeContactRectorat;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  avertissement?: string;
}

/**
 * Résout le contact à utiliser pour escalader vers le rectorat d'une
 * académie donnée — TOUJOURS une lecture de la table locale RectoratContact,
 * jamais un appel réseau ni une résolution en direct via un service tiers.
 * C'est cette contrainte (pas de dépendance réseau dans le chemin critique
 * de l'escalade) qui justifie une table maintenue manuellement plutôt
 * qu'une intégration API, à la différence de ContactCanal (66 000+
 * établissements).
 *
 * Ordre de préférence : médiateur académique si renseigné ET la fiche est
 * vérifiée -> secrétariat général si renseigné ET la fiche est vérifiée ->
 * standard du rectorat en dernier recours (toujours disponible, y compris
 * si la fiche n'est pas encore vérifiée). Une fiche "obsolete_suspecte"
 * n'est jamais utilisée pour le médiateur/secrétariat (traitée comme non
 * vérifiée) mais reste retournée via le standard, toujours accompagnée d'un
 * avertissement explicite — jamais silencieusement.
 */
export async function getContactEscalade(
  academie: string
): Promise<ContactEscaladeResolu | null> {
  const contact = await prisma.rectoratContact.findUnique({ where: { academie } });
  if (!contact) return null;

  const avertissement =
    contact.statutVerification === "obsolete_suspecte"
      ? "Coordonnée signalée comme potentiellement obsolète (échec d'escalade antérieur) : vérification manuelle requise avant toute confiance."
      : undefined;

  const estVerifie = contact.statutVerification === "verifie";

  if (contact.medieurEmail && estVerifie) {
    return {
      academie,
      typeUtilise: "mediateur_academique",
      email: contact.medieurEmail,
      telephone: contact.medieurTelephone,
      adresse: null,
      avertissement,
    };
  }
  if (contact.secretariatEmail && estVerifie) {
    return {
      academie,
      typeUtilise: "secretariat_general",
      email: contact.secretariatEmail,
      telephone: contact.secretariatTelephone,
      adresse: null,
      avertissement,
    };
  }
  return {
    academie,
    typeUtilise: "standard_rectorat",
    email: null,
    telephone: contact.standardTelephone,
    adresse: contact.standardAdresse,
    avertissement,
  };
}

/**
 * Interface d'administration simple (pas de workflow automatisé) : un
 * opérateur Clairvoie confirme ou corrige manuellement les coordonnées
 * d'une académie. Horodate systématiquement la vérification et repasse le
 * statut à "verifie", quels que soient les champs effectivement modifiés —
 * une vérification manuelle vaut confirmation de l'ensemble de la fiche.
 */
export async function marquerVerifie(params: {
  academie: string;
  compteAdminId: string;
  champsMisAJour?: Partial<{
    typeContactPrefere: TypeContactRectorat;
    medieurEmail: string | null;
    medieurTelephone: string | null;
    secretariatEmail: string | null;
    secretariatTelephone: string | null;
    standardTelephone: string | null;
    standardAdresse: string | null;
  }>;
}): Promise<RectoratContact> {
  const contact = await prisma.rectoratContact.findUnique({
    where: { academie: params.academie },
  });
  if (!contact) throw new RegleMetierError("Académie introuvable.");

  return prisma.rectoratContact.update({
    where: { academie: params.academie },
    data: {
      ...params.champsMisAJour,
      source: "verification_manuelle",
      statutVerification: "verifie",
      derniereVerification: new Date(),
    },
  });
}

/**
 * Si une tentative d'escalade réelle vers un rectorat échoue (email en
 * échec, numéro invalide), marque automatiquement l'entrée
 * "obsolete_suspecte" et journalise à l'intention d'un administrateur — ne
 * corrige JAMAIS la donnée automatiquement, se contente de déclencher la
 * vérification manuelle (voir marquerVerifie, seule voie de correction).
 * TODO: intégration réelle (notification effective d'un administrateur
 * Clairvoie — mail, Slack... — plutôt qu'une simple trace de log).
 */
export async function signalerEchecContact(params: {
  academie: string;
  ticketId: string;
}): Promise<RectoratContact> {
  const contact = await prisma.rectoratContact.findUnique({
    where: { academie: params.academie },
  });
  if (!contact) throw new RegleMetierError("Académie introuvable.");

  const updated = await prisma.rectoratContact.update({
    where: { academie: params.academie },
    data: { statutVerification: "obsolete_suspecte" },
  });

  console.error(
    `[rectoratContacts] échec d'escalade vers le rectorat de "${params.academie}" (ticket ${params.ticketId}) — coordonnée marquée "obsolete_suspecte", vérification manuelle requise.`
  );

  return updated;
}

/** Liste complète, pour le tableau de bord d'administration. */
export async function getTousLesRectoratContacts(): Promise<RectoratContact[]> {
  return prisma.rectoratContact.findMany({ orderBy: { academie: "asc" } });
}

/**
 * Entrées à re-vérifier : jamais vérifiées, ou vérifiées il y a plus de
 * RECTORAT_REVERIFICATION_MOIS mois. Purement informatif pour
 * l'administration — n'affecte jamais getContactEscalade ni la disponibilité
 * d'un contact pour une escalade en cours.
 */
export async function getRectoratsAReverifier(): Promise<RectoratContact[]> {
  const seuil = new Date(Date.now() - RECTORAT_REVERIFICATION_MOIS * 30 * 24 * 60 * 60 * 1000);
  return prisma.rectoratContact.findMany({
    where: { OR: [{ derniereVerification: null }, { derniereVerification: { lt: seuil } }] },
    orderBy: { academie: "asc" },
  });
}
