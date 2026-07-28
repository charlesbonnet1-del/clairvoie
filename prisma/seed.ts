import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { appendAuditLog } from "../lib/hashchain";
import { escaladerSiSilence } from "../lib/tickets";

function daysAgo(days: number, hours = 0): Date {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);
}
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
/** Réception confirmée peu après le dépôt — la majorité des établissements
 * du seed ont des coordonnées qui fonctionnent, la démo veut surtout
 * illustrer le cas contraire (T16) sans le généraliser. */
function receptionRapide(createdAt: Date, heuresApres = 2): Date {
  return new Date(createdAt.getTime() + heuresApres * 60 * 60 * 1000);
}

async function log(ticketId: string, action: string, acteurPseudo: string) {
  await appendAuditLog({ ticketId, action, acteurPseudo });
}

async function main() {
  console.log("Nettoyage de la base…");
  await prisma.auditLog.deleteMany();
  await prisma.suiteJudiciaire.deleteMany();
  await prisma.tentativeContact.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.alerteQualiteDonnees.deleteMany();
  await prisma.contactCanal.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.etablissement.deleteMany();
  await prisma.commune.deleteMany();

  console.log("Création des communes…");
  const petite = await prisma.commune.create({
    data: {
      nom: "Sainte-Colombe",
      epci: "CC du Pays de Sainte-Colombe",
      departement: "Ardèche",
    },
  });
  const moyenne = await prisma.commune.create({
    data: { nom: "Vallonry", epci: "CA de Vallonry", departement: "Isère" },
  });
  const grande = await prisma.commune.create({
    data: {
      nom: "Grandvillier",
      epci: "Métropole de Grandvillier",
      departement: "Rhône",
    },
  });

  console.log("Création des établissements…");
  const ecoleJeanMoulin = await prisma.etablissement.create({
    data: { nom: "École primaire Jean Moulin", communeId: petite.id },
  });
  const collegeLeVallon = await prisma.etablissement.create({
    data: { nom: "Collège Le Vallon", communeId: moyenne.id },
  });
  const lyceeVictorHugo = await prisma.etablissement.create({
    data: { nom: "Lycée Victor Hugo", communeId: grande.id },
  });
  const ecoleDesTilleuls = await prisma.etablissement.create({
    data: { nom: "École primaire des Tilleuls", communeId: grande.id },
  });

  console.log("Création des coordonnées de contact…");
  // Lycée Victor Hugo : coordonnées fonctionnelles, vérifiées de longue date.
  await prisma.contactCanal.create({
    data: {
      etablissementId: lyceeVictorHugo.id,
      type: "email",
      valeur: "ce.0382430K@ac-demo.fr",
      source: "annuaire_education_nationale",
      statutVerification: "verifie",
      derniereReussite: daysAgo(60),
      derniereTentativeAt: daysAgo(60),
    },
  });
  await prisma.contactCanal.create({
    data: {
      etablissementId: lyceeVictorHugo.id,
      type: "telephone",
      valeur: "04 74 00 00 00",
      source: "annuaire_education_nationale",
      statutVerification: "verifie",
      derniereReussite: daysAgo(60),
      derniereTentativeAt: daysAgo(60),
    },
  });
  // École primaire des Tilleuls : email connu mais qui a déjà bronché une
  // fois — sert de terrain pour la démonstration de la file de
  // vérification de contact de l'association tierce (voir T16 plus bas).
  const emailTilleuls = await prisma.contactCanal.create({
    data: {
      etablissementId: ecoleDesTilleuls.id,
      type: "email",
      valeur: "contact@tilleuls-demo.fr",
      source: "annuaire_education_nationale",
      statutVerification: "non_verifie",
      echecsConsecutifs: 1,
      derniereTentativeAt: daysAgo(3),
    },
  });

  console.log("Création des comptes de démo…");
  const passwordHash = await hashPassword("demo1234");

  const parent = await prisma.identity.create({
    data: {
      pseudoId: "parent-demo-1",
      role: "PARENT",
      displayName: "Camille Durand",
      email: "parent@demo.clairvoie",
      passwordHash,
      telephone: "06 00 00 00 00",
      emailVerifie: true,
      telephoneVerifie: true,
    },
  });
  await prisma.identity.create({
    data: {
      pseudoId: "etab-demo-1",
      role: "ETABLISSEMENT",
      displayName: "Direction — Lycée Victor Hugo",
      email: "etablissement@demo.clairvoie",
      passwordHash,
      etablissementId: lyceeVictorHugo.id,
    },
  });
  await prisma.identity.create({
    data: {
      pseudoId: "asso-demo-1",
      role: "ASSOCIATION_TIERCE",
      displayName: "Association Enfance Sereine",
      email: "association@demo.clairvoie",
      passwordHash,
    },
  });
  await prisma.identity.create({
    data: {
      pseudoId: "rectorat-demo-1",
      role: "RECTORAT",
      displayName: "Rectorat de démonstration",
      email: "rectorat@demo.clairvoie",
      passwordHash,
    },
  });

  const p1 = parent.pseudoId;
  const p2 = "parent-fictif-2";
  const p3 = "parent-fictif-3";
  const p4 = "parent-fictif-4";
  const p5 = "parent-fictif-5";

  console.log("Création des signalements (petite commune — sous le seuil de k-anonymité)…");

  // T1 — ouvert, récent
  const t1 = await prisma.ticket.create({
    data: {
      parentPseudoId: p2,
      etablissementId: ecoleJeanMoulin.id,
      categorie: "Négligence de surveillance",
      contenu: "Absence de surveillance constatée dans la cour pendant la récréation.",
      gravite: "legere",
      statut: "ouvert",
      createdAt: daysAgo(2),
      receptionConfirmeeAt: receptionRapide(daysAgo(2)),
    },
  });
  await log(t1.id, "creation", p2);

  // T2 — répondu dans les délais
  const t2 = await prisma.ticket.create({
    data: {
      parentPseudoId: p3,
      etablissementId: ecoleJeanMoulin.id,
      categorie: "Violence verbale ou psychologique",
      contenu: "Propos humiliants tenus par un surveillant envers un élève.",
      gravite: "moderee",
      statut: "répondu",
      createdAt: daysAgo(20),
      receptionConfirmeeAt: receptionRapide(daysAgo(20)),
      reponduAt: daysAgo(18),
      reponseContenu:
        "Un entretien a été mené avec le membre du personnel concerné et un rappel des règles a été effectué.",
    },
  });
  await log(t2.id, "creation", p3);
  await log(t2.id, "reponse", "etab-demo-1");

  // T3 — escaladé pour silence
  const t3 = await prisma.ticket.create({
    data: {
      parentPseudoId: p1,
      etablissementId: ecoleJeanMoulin.id,
      categorie: "Violence physique",
      contenu: "Un enfant a été bousculé violemment par un animateur périscolaire.",
      gravite: "grave",
      statut: "escaladé",
      createdAt: daysAgo(20),
      receptionConfirmeeAt: receptionRapide(daysAgo(20)),
      escaladeAt: daysAgo(15),
    },
  });
  await log(t3.id, "creation", p1);
  await log(t3.id, "escalade_silence", "system:cron");

  console.log("Création des signalements (commune moyenne)…");

  // T4 — clôturé par accord mutuel, encore révocable
  const t4 = await prisma.ticket.create({
    data: {
      parentPseudoId: p1,
      etablissementId: collegeLeVallon.id,
      categorie: "Harcèlement entre élèves",
      contenu: "Moqueries répétées d'un groupe d'élèves envers mon enfant.",
      gravite: "legere",
      statut: "clôturé_accord_mutuel",
      createdAt: daysAgo(3),
      receptionConfirmeeAt: receptionRapide(daysAgo(3)),
      reponduAt: daysAgo(2),
      reponseContenu: "Médiation organisée entre les élèves concernés, situation apaisée.",
      clotureAt: hoursAgo(1),
      clotureRevocableJusqua: hoursFromNow(47),
    },
  });
  await log(t4.id, "creation", p1);
  await log(t4.id, "reponse", "etab-demo-1");
  await log(t4.id, "cloture_accord_mutuel", p1);

  // T5 — clôturé par accord mutuel, fenêtre de rétractation dépassée
  const t5 = await prisma.ticket.create({
    data: {
      parentPseudoId: p4,
      etablissementId: collegeLeVallon.id,
      categorie: "Négligence de surveillance",
      contenu: "Élève laissé seul dans un couloir pendant plus d'une heure.",
      gravite: "moderee",
      statut: "clôturé_accord_mutuel",
      createdAt: daysAgo(20),
      receptionConfirmeeAt: receptionRapide(daysAgo(20)),
      reponduAt: daysAgo(19),
      reponseContenu: "Renforcement de la surveillance des couloirs mis en place.",
      clotureAt: daysAgo(15),
      clotureRevocableJusqua: daysAgo(13),
    },
  });
  await log(t5.id, "creation", p4);
  await log(t5.id, "reponse", "etab-demo-1");
  await log(t5.id, "cloture_accord_mutuel", p4);

  // T6 — grave, trianguléfondé, avec suite judiciaire déclarée
  const t6 = await prisma.ticket.create({
    data: {
      parentPseudoId: p2,
      etablissementId: collegeLeVallon.id,
      categorie: "Violence physique",
      contenu: "Coups portés à un élève par un surveillant, plusieurs témoins.",
      gravite: "grave",
      statut: "trianguléfondé",
      createdAt: daysAgo(25),
      receptionConfirmeeAt: receptionRapide(daysAgo(25)),
      reponduAt: daysAgo(24),
      reponseContenu: "Le personnel concerné a été suspendu dans l'attente des conclusions.",
      verdict: "fondé",
      verdictAt: daysAgo(20),
    },
  });
  await log(t6.id, "creation", p2);
  await log(t6.id, "reponse", "etab-demo-1");
  await log(t6.id, "verdict_fondé", "asso-demo-1");
  await prisma.suiteJudiciaire.create({ data: { ticketId: t6.id, statut: "transmis" } });
  await log(t6.id, "suite_judiciaire_declaree", p2);

  // T7 — ouvert, très récent
  const t7 = await prisma.ticket.create({
    data: {
      parentPseudoId: p3,
      etablissementId: collegeLeVallon.id,
      categorie: "Autre",
      contenu: "Absence de suivi après une chute d'un élève dans les escaliers.",
      gravite: "legere",
      statut: "ouvert",
      createdAt: daysAgo(1),
      receptionConfirmeeAt: receptionRapide(daysAgo(1)),
    },
  });
  await log(t7.id, "creation", p3);

  console.log("Création des signalements (grande commune)…");

  // T8 — répondu dans les délais
  const t8 = await prisma.ticket.create({
    data: {
      parentPseudoId: p1,
      etablissementId: lyceeVictorHugo.id,
      categorie: "Violence verbale ou psychologique",
      contenu: "Remarques dévalorisantes répétées d'un enseignant envers un élève.",
      gravite: "moderee",
      statut: "répondu",
      createdAt: daysAgo(10),
      receptionConfirmeeAt: receptionRapide(daysAgo(10)),
      reponduAt: daysAgo(9),
      reponseContenu: "Un rappel des obligations déontologiques a été fait à l'enseignant concerné.",
    },
  });
  await log(t8.id, "creation", p1);
  await log(t8.id, "reponse", "etab-demo-1");

  // T9 — ouvert, très récent (pour la démo du compte établissement)
  const t9 = await prisma.ticket.create({
    data: {
      parentPseudoId: p1,
      etablissementId: lyceeVictorHugo.id,
      categorie: "Négligence de surveillance",
      contenu: "Absence d'encadrement lors d'une sortie scolaire.",
      gravite: "legere",
      statut: "ouvert",
      createdAt: hoursAgo(12),
      receptionConfirmeeAt: receptionRapide(hoursAgo(12)),
    },
  });
  await log(t9.id, "creation", p1);

  // T10 — grave, trianguléinfondé
  const t10 = await prisma.ticket.create({
    data: {
      parentPseudoId: p5,
      etablissementId: lyceeVictorHugo.id,
      categorie: "Violence physique",
      contenu: "Signalement d'une altercation entre un surveillant et un élève.",
      gravite: "grave",
      statut: "trianguléinfondé",
      createdAt: daysAgo(30),
      receptionConfirmeeAt: receptionRapide(daysAgo(30)),
      reponduAt: daysAgo(29),
      reponseContenu: "Enquête interne menée, versions contradictoires recueillies.",
      verdict: "infondé",
      verdictAt: daysAgo(25),
    },
  });
  await log(t10.id, "creation", p5);
  await log(t10.id, "reponse", "etab-demo-1");
  await log(t10.id, "verdict_infondé", "asso-demo-1");

  // T11 — escaladé pour silence
  const t11 = await prisma.ticket.create({
    data: {
      parentPseudoId: p2,
      etablissementId: lyceeVictorHugo.id,
      categorie: "Harcèlement entre élèves",
      contenu: "Harcèlement répété signalé à plusieurs reprises sans réponse.",
      gravite: "moderee",
      statut: "escaladé",
      createdAt: daysAgo(20),
      receptionConfirmeeAt: receptionRapide(daysAgo(20)),
      escaladeAt: daysAgo(15),
    },
  });
  await log(t11.id, "creation", p2);
  await log(t11.id, "escalade_silence", "system:cron");

  // T12 — clôturé par accord mutuel, fenêtre dépassée, avec suite judiciaire "sans_nouvelle"
  const t12 = await prisma.ticket.create({
    data: {
      parentPseudoId: p3,
      etablissementId: lyceeVictorHugo.id,
      categorie: "Autre",
      contenu: "Incident mineur lors d'une sortie pédagogique, résolu à l'amiable.",
      gravite: "legere",
      statut: "clôturé_accord_mutuel",
      createdAt: daysAgo(40),
      receptionConfirmeeAt: receptionRapide(daysAgo(40)),
      reponduAt: daysAgo(39),
      reponseContenu: "Excuses formelles présentées à la famille.",
      clotureAt: daysAgo(35),
      clotureRevocableJusqua: daysAgo(33),
    },
  });
  await log(t12.id, "creation", p3);
  await log(t12.id, "reponse", "etab-demo-1");
  await log(t12.id, "cloture_accord_mutuel", p3);
  await prisma.suiteJudiciaire.create({ data: { ticketId: t12.id, statut: "sans_nouvelle" } });
  await log(t12.id, "suite_judiciaire_declaree", p3);

  // T13 — ouvert mais au-delà du délai : sera escaladé automatiquement par le cron plus bas
  const t13 = await prisma.ticket.create({
    data: {
      parentPseudoId: p4,
      etablissementId: ecoleDesTilleuls.id,
      categorie: "Négligence de surveillance",
      contenu: "Aucune réponse de l'établissement plusieurs jours après le signalement.",
      gravite: "moderee",
      statut: "ouvert",
      createdAt: daysAgo(6),
      receptionConfirmeeAt: receptionRapide(daysAgo(6)),
    },
  });
  await log(t13.id, "creation", p4);

  // T14 — répondu dans les délais
  const t14 = await prisma.ticket.create({
    data: {
      parentPseudoId: p5,
      etablissementId: ecoleDesTilleuls.id,
      categorie: "Violence verbale ou psychologique",
      contenu: "Cris et propos rabaissants tenus envers plusieurs élèves.",
      gravite: "legere",
      statut: "répondu",
      createdAt: daysAgo(8),
      receptionConfirmeeAt: receptionRapide(daysAgo(8)),
      reponduAt: daysAgo(7),
      reponseContenu: "Un accompagnement pédagogique a été mis en place.",
    },
  });
  await log(t14.id, "creation", p5);
  await log(t14.id, "reponse", "etab-demo-1");

  // T15 — grave, ouvert, avec suite judiciaire déjà déclarée par le parent
  const t15 = await prisma.ticket.create({
    data: {
      parentPseudoId: p1,
      etablissementId: ecoleDesTilleuls.id,
      categorie: "Attouchements ou sévices à caractère sexuel",
      contenu: "Signalement déposé après un incident survenu ce matin, en attente de traitement.",
      gravite: "grave",
      statut: "ouvert",
      createdAt: hoursAgo(3),
      receptionConfirmeeAt: receptionRapide(hoursAgo(3)),
    },
  });
  await log(t15.id, "creation", p1);
  await prisma.suiteJudiciaire.create({ data: { ticketId: t15.id, statut: "transmis" } });
  await log(t15.id, "suite_judiciaire_declaree", p1);

  // T16 — le seul canal connu (email) a déjà échoué une fois ; la réception
  // n'a jamais été confirmée. Démontre la file "Vérification de contact
  // requise" de l'association tierce, distincte de l'escalade pour silence.
  const t16 = await prisma.ticket.create({
    data: {
      parentPseudoId: p4,
      etablissementId: ecoleDesTilleuls.id,
      categorie: "Violence verbale ou psychologique",
      contenu: "Propos déplacés tenus par un intervenant périscolaire, aucune réponse reçue.",
      gravite: "moderee",
      statut: "verification_contact_requise",
      createdAt: daysAgo(3),
    },
  });
  await log(t16.id, "creation", p4);
  await prisma.tentativeContact.create({
    data: {
      ticketId: t16.id,
      contactCanalId: emailTilleuls.id,
      methode: "email",
      statut: "echec_rebond",
      timestamp: daysAgo(3),
    },
  });
  await log(t16.id, "verification_contact_requise", "system:cron");

  console.log("Exécution de l'escalade automatique (cron) pour les signalements en silence…");
  const escalades = await escaladerSiSilence();
  console.log(`  -> ${escalades.length} signalement(s) escaladé(s) automatiquement.`);

  console.log("\nSeed terminé.");
  console.log(
    "Répartition géographique : Sainte-Colombe=3, Vallonry=4, Grandvillier=9 (total 16)."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
