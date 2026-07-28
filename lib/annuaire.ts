import { prisma } from "./prisma";
import { fetchAnnuaireRecords, AnnuaireIndisponibleError } from "./annuaireApi";
import { recupererCommuneParCode } from "./geoApi";
import { ANNUAIRE_REFRESH_DAYS } from "@/config";
import type { Etablissement } from "@prisma/client";

/**
 * Synchronise (en le mettant en cache localement) l'établissement
 * correspondant à un UAI depuis l'annuaire public de l'éducation nationale :
 * nom, commune de rattachement, et coordonnées de contact déclarées
 * (email, téléphone). Réutilise l'intégration déjà en place pour la
 * recherche d'établissements par commune (lib/annuaireApi.ts) plutôt que
 * d'en créer une seconde.
 *
 * Toute coordonnée importée ici reste `statutVerification = "non_verifie"` :
 * l'annuaire donne une donnée déclarative à jour, jamais la preuve qu'un
 * canal fonctionne aujourd'hui — seule une tentative de contact réelle
 * ayant abouti peut faire passer un canal à "verifie"
 * (voir lib/contactVerification.ts).
 *
 * Ne rafraîchit que si le cache local a plus de ANNUAIRE_REFRESH_DAYS, sauf
 * appel explicite à refreshEtablissement(). Si l'API est indisponible,
 * retombe sur le cache existant et journalise l'échec — ne bloque jamais la
 * création d'un ticket pour autant.
 */
export async function syncEtablissementDepuisAnnuaire(uai: string): Promise<Etablissement> {
  const existant = await prisma.etablissement.findUnique({ where: { uai } });

  const assezRecent =
    existant?.derniereSyncAnnuaire &&
    Date.now() - existant.derniereSyncAnnuaire.getTime() <
      ANNUAIRE_REFRESH_DAYS * 24 * 60 * 60 * 1000;

  if (existant && assezRecent) {
    return existant;
  }

  return refreshEtablissement(uai, existant);
}

/**
 * Force un rafraîchissement depuis l'annuaire, sans tenir compte de la
 * fraîcheur du cache. Utilisable comme tâche de fond (ex. cron) ou appelée
 * par syncEtablissementDepuisAnnuaire ci-dessus.
 */
export async function refreshEtablissement(
  uai: string,
  existantConnu?: Etablissement | null
): Promise<Etablissement> {
  const existant =
    existantConnu !== undefined
      ? existantConnu
      : await prisma.etablissement.findUnique({ where: { uai } });

  let records;
  try {
    records = await fetchAnnuaireRecords(`identifiant_de_l_etablissement="${uai}"`, 1);
  } catch (err) {
    console.error(
      `[annuaire] échec de synchronisation pour l'UAI ${uai} — repli sur le cache local.`,
      err
    );
    if (existant) return existant;
    throw err instanceof AnnuaireIndisponibleError
      ? err
      : new AnnuaireIndisponibleError(err);
  }

  const record = records[0];
  if (!record) {
    if (existant) return existant;
    throw new Error(`Établissement UAI ${uai} introuvable dans l'annuaire de l'éducation.`);
  }

  const codeCommune = record.code_commune ?? "";
  const nomCommune = record.nom_commune ?? "Commune inconnue";

  let epci = "EPCI inconnu";
  let departement = "Département inconnu";
  if (codeCommune) {
    try {
      const commune = await recupererCommuneParCode(codeCommune);
      if (commune) {
        epci = commune.epci;
        departement = commune.departement;
      }
    } catch (err) {
      // L'annuaire de l'éducation reste la source d'autorité pour
      // l'établissement lui-même ; l'EPCI/département sont un complément,
      // leur indisponibilité ne doit jamais bloquer la synchronisation.
      console.error(`[annuaire] échec de complément géographique pour ${codeCommune} :`, err);
    }
  }

  const commune = await prisma.commune.upsert({
    where: { codeInsee: codeCommune || `inconnu-${uai}` },
    update: {},
    create: {
      nom: nomCommune,
      epci,
      departement,
      codeInsee: codeCommune || `inconnu-${uai}`,
    },
  });

  const etablissement = await prisma.etablissement.upsert({
    where: { uai },
    update: {
      nom: record.nom_etablissement,
      adresse: [record.adresse_1, record.code_postal, nomCommune].filter(Boolean).join(", "),
      communeId: commune.id,
      derniereSyncAnnuaire: new Date(),
    },
    create: {
      uai,
      nom: record.nom_etablissement,
      adresse: [record.adresse_1, record.code_postal, nomCommune].filter(Boolean).join(", "),
      communeId: commune.id,
      derniereSyncAnnuaire: new Date(),
    },
  });

  await synchroniserContactCanal(etablissement.id, "email", record.mail);
  await synchroniserContactCanal(etablissement.id, "telephone", record.telephone);

  return etablissement;
}

async function synchroniserContactCanal(
  etablissementId: string,
  type: "email" | "telephone",
  valeur: string | null | undefined
) {
  if (!valeur || !valeur.trim()) return;

  const existant = await prisma.contactCanal.findFirst({
    where: { etablissementId, type, source: "annuaire_education_nationale" },
  });

  if (existant) {
    if (existant.valeur !== valeur) {
      // La coordonnée déclarée a changé côté annuaire : on la met à jour,
      // mais on ne touche pas à son statutVerification ni à ses compteurs —
      // une valeur différente redevient de fait non prouvée, mais ce n'est
      // pas un échec de contact à comptabiliser.
      await prisma.contactCanal.update({
        where: { id: existant.id },
        data: { valeur, statutVerification: "non_verifie" },
      });
    }
    return;
  }

  await prisma.contactCanal.create({
    data: {
      etablissementId,
      type,
      valeur,
      source: "annuaire_education_nationale",
      statutVerification: "non_verifie",
    },
  });
}
