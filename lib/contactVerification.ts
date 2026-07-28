import { prisma } from "./prisma";
import { appendAuditLog } from "./hashchain";
import {
  ORDRE_FIABILITE_CANAUX,
  CONTACT_GRACE_PERIOD_HOURS,
  ALERTE_QUALITE_FENETRE_JOURS,
  ALERTE_QUALITE_SEUIL_ECHECS,
  type TypeContact,
} from "@/config";

type ResultatTransport = "livre" | "ouvert" | "echec_rebond";
type CanalAutomatisable = (typeof ORDRE_FIABILITE_CANAUX)[number];

const METHODE_PAR_TYPE: Record<string, string> = {
  courrier_recommande_electronique: "recommande_electronique",
  email: "email",
  telephone: "sms",
};

// Fonctions de transport mockées pour le MVP : elles simulent un
// comportement réaliste (taux de succès approximatifs des canaux réels) en
// l'absence d'intégration effective avec un fournisseur. Chacune est un
// point d'extension clairement isolé.
// TODO: intégration réelle (ex. AR24 ou équivalent recommandé électronique)
async function transporterRecommandeElectronique(): Promise<ResultatTransport> {
  return Math.random() < 0.95 ? "livre" : "echec_rebond";
}
// TODO: intégration réelle (SendGrid ou équivalent, webhooks bounce/delivery)
async function transporterEmail(): Promise<ResultatTransport> {
  return Math.random() < 0.9 ? "livre" : "echec_rebond";
}
// TODO: intégration réelle (provider SMS, accusés de remise)
async function transporterSms(): Promise<ResultatTransport> {
  return Math.random() < 0.7 ? "livre" : "echec_rebond";
}

const TRANSPORTS_PAR_DEFAUT: Record<CanalAutomatisable, () => Promise<ResultatTransport>> = {
  courrier_recommande_electronique: transporterRecommandeElectronique,
  email: transporterEmail,
  telephone: transporterSms,
};

export interface OptionsTentative {
  transports?: Partial<Record<CanalAutomatisable, () => Promise<ResultatTransport>>>;
}

/**
 * Primitive d'état : enregistre une tentative de contact et en tire toutes
 * les conséquences — vérification du canal, démarrage du délai officiel du
 * ticket (une seule fois, à la première réussite), et suivi qualité des
 * échecs. Utilisée aussi bien par l'automatisation (tenterContactEtablissement)
 * que par les tests, pour rejouer une séquence précise dans le temps.
 */
export async function enregistrerTentativeContact(params: {
  ticketId: string;
  contactCanalId: string;
  methode: string;
  statut: "envoye" | "livre" | "ouvert" | "echec_rebond" | "sans_reponse";
  timestamp?: Date;
}): Promise<void> {
  const timestamp = params.timestamp ?? new Date();

  await prisma.tentativeContact.create({
    data: {
      ticketId: params.ticketId,
      contactCanalId: params.contactCanalId,
      methode: params.methode,
      statut: params.statut,
      timestamp,
    },
  });

  const succes = params.statut === "livre" || params.statut === "ouvert";
  const canalAvant = await prisma.contactCanal.findUniqueOrThrow({
    where: { id: params.contactCanalId },
  });

  if (succes) {
    await prisma.contactCanal.update({
      where: { id: params.contactCanalId },
      data: {
        statutVerification: "verifie",
        derniereReussite: timestamp,
        derniereTentativeAt: timestamp,
        echecsConsecutifs: 0,
      },
    });

    const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (ticket && !ticket.receptionConfirmeeAt) {
      await prisma.ticket.update({
        where: { id: params.ticketId },
        data: {
          receptionConfirmeeAt: timestamp,
          statut: ticket.statut === "verification_contact_requise" ? "ouvert" : ticket.statut,
        },
      });
      await appendAuditLog({
        ticketId: params.ticketId,
        action: "reception_confirmee",
        acteurPseudo: "system:contact",
      });
    }
  } else {
    const fenetreDepassee =
      canalAvant.derniereTentativeAt !== null &&
      timestamp.getTime() - canalAvant.derniereTentativeAt.getTime() >
        ALERTE_QUALITE_FENETRE_JOURS * 24 * 60 * 60 * 1000;
    const nouveauCompteur = fenetreDepassee ? 1 : canalAvant.echecsConsecutifs + 1;

    await prisma.contactCanal.update({
      where: { id: params.contactCanalId },
      data: { derniereTentativeAt: timestamp, echecsConsecutifs: nouveauCompteur },
    });

    await verifierAlerteQualiteDonnees(canalAvant.etablissementId);
  }
}

/**
 * Tente automatiquement les canaux disponibles pour l'établissement d'un
 * ticket, par ordre de fiabilité décroissant (recommandé électronique >
 * email > SMS), et s'arrête au premier succès. N'échoue jamais silencieusement
 * mais ne bloque jamais la création du ticket : les échecs sont enregistrés,
 * pas levés en exception.
 */
export async function tenterContactEtablissement(
  ticketId: string,
  options?: OptionsTentative
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const canaux = await prisma.contactCanal.findMany({
    where: { etablissementId: ticket.etablissementId },
  });

  for (const type of ORDRE_FIABILITE_CANAUX) {
    const candidats = canaux.filter((c) => c.type === type);
    for (const canal of candidats) {
      const transport = options?.transports?.[type] ?? TRANSPORTS_PAR_DEFAUT[type];
      const resultat = await transport();
      await enregistrerTentativeContact({
        ticketId,
        contactCanalId: canal.id,
        methode: METHODE_PAR_TYPE[type] ?? type,
        statut: resultat,
      });
      if (resultat === "livre" || resultat === "ouvert") return;
    }
  }
}

/**
 * Tâche de fond (cron) : transmet à l'association tierce (statut
 * "verification_contact_requise") tout ticket encore sans réception
 * confirmée au-delà du délai de grâce — distinct de l'escalade pour
 * silence de l'établissement (escaladerSiSilence), qui ne concerne que les
 * tickets dont la réception a déjà été confirmée.
 */
export async function evaluerEchecsGracePeriod(acteurPseudo = "system:cron") {
  const seuil = new Date(Date.now() - CONTACT_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  const aTransmettre = await prisma.ticket.findMany({
    where: { statut: "ouvert", receptionConfirmeeAt: null, createdAt: { lt: seuil } },
  });

  const transmis = [];
  for (const ticket of aTransmettre) {
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { statut: "verification_contact_requise" },
    });
    await appendAuditLog({
      ticketId: ticket.id,
      action: "verification_contact_requise",
      acteurPseudo,
    });
    transmis.push(updated);
  }
  return transmis;
}

/**
 * Action de l'association tierce, dernier recours : elle a retrouvé une
 * coordonnée fonctionnelle (recherche manuelle, appel direct) et la soumet
 * une fois qu'elle a déjà fonctionné — ce nouveau canal est donc créé
 * directement "verifie", pas re-testé automatiquement. Débloque aussitôt
 * tout ticket de cet établissement resté en "verification_contact_requise".
 */
export async function proposerContactVerifie(params: {
  etablissementId: string;
  type: string;
  valeur: string;
  acteurPseudo: string;
  porteur?: string;
}) {
  const timestamp = new Date();

  const canal = await prisma.contactCanal.create({
    data: {
      etablissementId: params.etablissementId,
      type: params.type,
      valeur: params.valeur,
      porteur: params.porteur ?? null,
      source: "confirme_etablissement",
      statutVerification: "verifie",
      derniereReussite: timestamp,
      derniereTentativeAt: timestamp,
    },
  });

  const enAttente = await prisma.ticket.findMany({
    where: {
      etablissementId: params.etablissementId,
      statut: "verification_contact_requise",
      receptionConfirmeeAt: null,
    },
  });

  for (const ticket of enAttente) {
    await prisma.tentativeContact.create({
      data: {
        ticketId: ticket.id,
        contactCanalId: canal.id,
        methode: METHODE_PAR_TYPE[params.type] ?? params.type,
        statut: "livre",
        timestamp,
      },
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { receptionConfirmeeAt: timestamp, statut: "ouvert" },
    });
    await appendAuditLog({
      ticketId: ticket.id,
      action: "reception_confirmee_verification_association",
      acteurPseudo: params.acteurPseudo,
    });
  }

  return canal;
}

/**
 * Alerte interne (jamais publique) : un établissement dont les canaux
 * cumulent trop d'échecs récents a probablement des coordonnées obsolètes.
 * Une seule alerte non résolue à la fois par établissement.
 */
export async function verifierAlerteQualiteDonnees(etablissementId: string): Promise<void> {
  const canaux = await prisma.contactCanal.findMany({ where: { etablissementId } });
  const totalEchecs = canaux.reduce((somme, c) => somme + c.echecsConsecutifs, 0);
  if (totalEchecs < ALERTE_QUALITE_SEUIL_ECHECS) return;

  const dejaAlerte = await prisma.alerteQualiteDonnees.findFirst({
    where: { etablissementId, resolue: false },
  });
  if (dejaAlerte) return;

  await prisma.alerteQualiteDonnees.create({
    data: {
      etablissementId,
      message:
        "Les coordonnées de cet établissement semblent obsolètes (échecs de contact répétés).",
    },
  });
}

export type { TypeContact };
