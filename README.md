# Clairvoie — MVP de démonstration

Clairvoie est une plateforme de signalement et de transparence structurelle
sur le traitement des signalements de maltraitance en milieu scolaire et
périscolaire en France. Elle ne surveille rien et n'enregistre aucun enfant :
c'est un canal de signalement horodaté et infalsifiable, avec triangulation
par une association tierce indépendante, escalade automatique en cas de
silence, et un tableau de bord public agrégé protégé par un seuil de
k-anonymité.

Ce dépôt contient un **MVP démontrable de bout en bout**, pensé pour faire
vivre le parcours complet à un investisseur ou une collectivité, en local ou
sur une preview Vercel, avec des comptes de démonstration pré-remplis.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma + Postgres (Supabase)
- Authentification de démonstration : email/mot de passe, sans intégration
  FranceConnect/EduConnect réelle
- Vitest pour les tests

## Base de données (Supabase)

Ce projet utilise Postgres partout (local, tests, production) via un projet
Supabase — pas de base locale à installer.

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Cliquez sur **Connect** (en haut du tableau de bord du projet), onglet
   **ORMs** (ou **Connection string**), et récupérez deux URLs :
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct connection** (port `5432`) → `DIRECT_URL`, requise par Prisma
     pour les migrations (le pooler ne les supporte pas)
3. Copiez `.env.example` vers `.env` et renseignez ces deux valeurs, ainsi
   que `SESSION_SECRET` (une chaîne aléatoire quelconque en local).

```bash
cp .env.example .env
# éditez .env avec vos vraies valeurs Supabase
```

## Démarrage rapide

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

L'application est disponible sur http://localhost:3000.

Ce projet utilise `prisma db push` plutôt que `prisma migrate dev` : pas de
dossier `prisma/migrations/` à maintenir, le schéma est simplement synchronisé
directement sur la base à chaque changement de `schema.prisma`. `db push`
n'est nécessaire qu'après une modification du schéma (il crée les tables au
premier lancement). Pour les lancements suivants, `npm run dev` suffit. Pour
repartir de zéro, videz les tables depuis l'éditeur SQL Supabase puis
relancez `npx prisma db seed`.

### Lancer les tests

```bash
npm test
```

Les tests tournent sur la **même base Supabase**, mais dans un schéma
Postgres dédié (`test`), entièrement isolé du schéma `public` où vivent vos
données de démo — voir `vitest.config.ts` et `tests/global-setup.ts`. Ils
nécessitent donc `DIRECT_URL` dans `.env` et un accès réseau à Supabase ;
ils ne touchent jamais aux données du schéma `public`.

## Comptes de démonstration

Mot de passe identique pour tous les comptes : **`demo1234`**

| Rôle | Email | Vue |
|---|---|---|
| Parent | `parent@demo.clairvoie` | Dépôt et suivi de ses signalements |
| Établissement | `etablissement@demo.clairvoie` | Réponse aux signalements reçus (Lycée Victor Hugo) |
| Association tierce | `association@demo.clairvoie` | Triangulation et verdicts |
| Rectorat | `rectorat@demo.clairvoie` | Signalements escaladés |
| Admin | `admin@demo.clairvoie` | Annuaire des contacts rectorat |

Le tableau de bord public (`/dashboard`) ne nécessite aucune authentification.

L'écran `/login` simule un choix de fournisseur d'identité
(« FranceConnect (démo) », « EduConnect (démo) ») : il ne s'agit que d'une
mise en scène visuelle, sans aucun appel réel à un fournisseur d'identité.

## Tableaux de bord façon boîte mail

Les quatre vues métier (`/parent`, `/etablissement`, `/association`,
`/rectorat`) suivent toutes le même principe qu'une boîte mail : une liste
compacte (catégorie du signalement, date, statut — `components/InboxRow.tsx`)
plutôt qu'une pile de cartes détaillées, et un clic sur une ligne ouvre une
page dédiée (`/<role>/[id]`) avec le détail complet du signalement et les
actions possibles pour ce rôle. Le tableau de bord public (`/dashboard`)
n'est volontairement pas concerné : il ne présente que des agrégats, jamais
un signalement individuel (principe 6).

Côté association tierce, chaque file (vérification de contact, triangulation,
relance sur ticket dormant, verdicts récents) reste une liste distincte sur
`/association`, mais toutes pointent vers la même page de détail
`/association/[id]` : celle-ci n'affiche que les actions pertinentes pour
l'état courant du ticket (formulaire de contact, de triangulation, ou de
relance), sans dupliquer la logique d'affichage.

## Inscription parent et vérification obligatoire

Un nouveau parent peut créer un compte sur `/inscription` (email, téléphone,
mot de passe). **Email et téléphone doivent tous les deux être vérifiés**
avant de pouvoir déposer un signalement — c'est ce qui garantit que
l'association tierce peut effectivement recontacter le parent si besoin
(`Identity.emailVerifie` / `telephoneVerifie`, vérifié à la fois côté page
et côté route `/api/signalement`).

Démo — aucun email ni SMS n'est réellement envoyé (`lib/parentAuth.ts`,
`# TODO: intégration réelle`) : les codes à 6 chiffres générés à
l'inscription sont affichés directement sur `/verification-compte`, comme
s'ils venaient d'être reçus. Le compte de démo `parent@demo.clairvoie` est
pré-vérifié dans le seed.

## Dépôt de signalement : commune et établissement réels

Le formulaire `/parent/nouveau-signalement` ne fait plus choisir
l'établissement dans une liste figée : le parent tape le nom de sa commune,
et l'établissement se pré-remplit à partir de données publiques réelles.

Le formulaire se présente en 7 étapes (une information à la fois : commune,
établissement, date des faits, personne(s) mise(s) en cause, plainte
directe, catégorie, description), avec un bouton « Suivant » désactivé tant
que l'étape courante n'est pas valide plutôt qu'une longue page à remplir
d'un coup. Il s'agit uniquement d'une présentation par étapes côté
navigateur (`components/SignalementForm.tsx`) : tous les champs restent
montés dans le DOM (masqués via `hidden` plutôt que démontés) pour ne
perdre aucune saisie en navigant entre les étapes, et une seule requête
`POST /api/signalement` est envoyée à la fin, comme avant.

- **Communes** — [geo.api.gouv.fr](https://geo.api.gouv.fr) (API officielle,
  gratuite, sans clé) : recherche par nom, renvoie code INSEE, EPCI et
  département.
- **Établissements** — [data.education.gouv.fr](https://data.education.gouv.fr)
  (annuaire de l'éducation, dataset `fr-en-annuaire-education`) : liste des
  écoles/collèges/lycées ouverts dans la commune choisie. Cet annuaire ne
  couvre que les établissements de l'Éducation nationale — les structures
  périscolaires (centre de loisirs, garderie…) n'y figurent pas, d'où
  l'option « Autre / structure périscolaire non listée » avec saisie
  manuelle du nom.

Ces deux routes sont proxyfiées côté serveur (`app/api/geo/communes`,
`app/api/geo/etablissements`) pour éviter tout appel direct depuis le
navigateur. À la soumission, `/api/signalement` crée (ou réutilise, par code
INSEE / UAI) la `Commune` et l'`Etablissement` correspondants en base.

La **gravité n'est plus auto-déclarée par le parent** (l'ancien champ
« gravité perçue » a été retiré) : elle est dérivée automatiquement de la
catégorie choisie (`config.ts` -> `CATEGORIE_GRAVITE`). Les catégories de
violences physiques ou sexuelles sont classées `grave` par construction, ce
qui déclenche le principe 8 (clôture par accord mutuel impossible sans
validation de l'association tierce).

Une fois l'établissement choisi, ses **coordonnées officielles connues**
s'affichent directement dans le formulaire (type, valeur, statut de
vérification), via `app/api/geo/etablissements/[uai]/contacts` — qui
synchronise l'établissement depuis l'annuaire au passage si besoin. Le
parent peut aussi **ajouter plusieurs moyens de contact secondaires**
(email, téléphone avec son porteur, adresse postale — bouton « + Ajouter un
contact », répétable). Ce n'est jamais la source principale des
coordonnées : chaque canal ainsi créé est marqué `source =
"propose_par_parent"` et `statutVerification = "non_verifie"` jusqu'à ce
qu'une tentative de contact réelle aboutisse.

## Coordonnées d'établissement vérifiées et accusé de réception

Le **délai officiel** utilisé par l'escalade automatique et les
statistiques publiques ne démarre jamais au dépôt du signalement : il
démarre à la **réception confirmée**, c'est-à-dire la première fois qu'un
canal de contact délivre effectivement le signalement à l'établissement.

- **Annuaire de coordonnées qui s'enrichit dans le temps**
  (`lib/annuaire.ts`) : à la sélection d'un établissement (ou dès qu'un
  ticket cible un UAI inconnu), ses coordonnées (email, téléphone) sont
  synchronisées depuis l'annuaire de l'éducation nationale — la même
  intégration que pour la recherche d'établissement, jamais un import CSV
  ou un snapshot statique. Rafraîchi tous les `ANNUAIRE_REFRESH_DAYS` (30
  par défaut) ; si l'API est indisponible, retombe sur le cache local et
  journalise l'échec sans jamais bloquer la création d'un ticket.
- **Une coordonnée fraîchement synchronisée reste `non_verifie`** : l'annuaire
  donne une donnée déclarative à jour, pas la preuve qu'un canal fonctionne
  aujourd'hui. Seule une tentative de contact réelle ayant abouti (livrée ou
  ouverte) fait passer un canal à `verifie` (`lib/contactVerification.ts`).
- **Tentative automatique à la création du ticket**, par ordre de fiabilité
  décroissant : recommandé électronique > email > SMS (fonctions de
  transport mockées pour la démo — `# TODO: intégration réelle` dans
  `lib/contactVerification.ts`, ex. SendGrid ou un fournisseur SMS).
- **Si tous les canaux échouent** au-delà du délai de grâce
  (`CONTACT_GRACE_PERIOD_HOURS`, 48h), le ticket passe au statut
  `verification_contact_requise` — distinct de `escaladé` : ce n'est pas un
  silence de l'établissement, c'est un problème de canal. L'association
  tierce retrouve alors une coordonnée fonctionnelle et la soumet via
  `proposerContactVerifie`, ce qui débloque aussitôt le ticket.
- **Alerte qualité de données interne** (jamais publique) quand un
  établissement cumule `ALERTE_QUALITE_SEUIL_ECHECS` échecs (3 par défaut)
  sur une fenêtre de `ALERTE_QUALITE_FENETRE_JOURS` (90 jours) — table
  `AlerteQualiteDonnees`, distincte des statistiques publiques de délai.

Vérifié par `tests/test_delai_demarre_a_reception_confirmee.test.ts`,
`tests/test_echec_tous_canaux_transmet_association.test.ts`,
`tests/test_contact_verifie_persiste_etablissement.test.ts`,
`tests/test_alerte_qualite_donnees.test.ts`,
`tests/test_api_annuaire_fallback_cache.test.ts` et
`tests/test_coordonnee_api_reste_non_verifiee.test.ts`.

## Identification de la personne mise en cause — strictement scopée au ticket

Le formulaire de dépôt (dans cet ordre : commune, établissement, date des
faits, personne(s) mise(s) en cause, catégorie, description) propose, en
option, d'identifier une ou plusieurs personnes mises en cause (nom,
fonction, caractère récurrent ou non — bouton « + Ajouter une personne »,
répétable) — jamais obligatoire, un signalement reste déposable sans cette
information. La date et l'horaire des faits sont, eux, portés directement
par le signalement (`Ticket.dateFaits` / `horaireFaits`), pas par la
personne.

Cadre légal strict (article 46 loi Informatique et Libertés) : un
particulier ne peut traiter une donnée relative à une infraction que pour
préparer ou suivre sa propre action de victime, jamais pour constituer un
fichier consultable au-delà de son propre dossier. En conséquence :

- Le modèle `PersonneMiseEnCause` peut avoir plusieurs entrées pour un même
  ticket (plusieurs personnes mises en cause dans un même signalement), mais
  chaque entrée reste liée à un seul `ticketId` — jamais partagée ni
  réutilisée entre tickets. **Aucun index** sur `nom`/`fonction`/`recurrent`
  — rien ne permet une requête « tous les tickets mentionnant telle
  personne ».
- **Un seul point d'accès en lecture existe dans tout le code** :
  `lib/personneMiseEnCause.ts` -> `recupererPersonnesMiseEnCause`, qui
  n'accepte qu'un `ticketId` précis (jamais un critère de recherche) ; le
  seul `findMany` sur cette table est là, systématiquement filtré par ce
  seul `ticketId`, jamais par contenu.
- Visible uniquement par l'établissement instructeur *de ce ticket précis*,
  et par l'association tierce en charge de la triangulation. Le rectorat ne
  le voit **jamais**, sauf pour un ticket qu'il a explicitement escaladé —
  et uniquement le contenu de ce ticket-là, jamais une vue consolidée sur la
  personne. Jamais exposé sur le dashboard public.
- Aucune fonctionnalité de recoupement entre tickets (pas de hashing à des
  fins de matching, pas de détection de récidive) — volontairement absente
  du schéma ; une telle fonctionnalité nécessiterait une validation
  juridique et une autorisation CNIL dédiées avant toute implémentation.

Vérifié par `tests/test_personne_mise_en_cause_non_agregable.test.ts` et
`tests/test_acces_restreint_personne_mise_en_cause.test.ts`.

## Plainte déposée directement par le parent

Une plainte déposée directement par le parent auprès de la police/
gendarmerie est une origine de saisine de la justice indépendante de
l'escalade établissement -> rectorat, avec laquelle elle peut coexister.
Le modèle `SuiteJudiciaire` distingue les deux via le champ `origine` :

- `"transmission_etablissement"` (valeur par défaut, parcours préexistant :
  déclaration générique de statut judiciaire par le parent) ;
- `"plainte_directe_parent"` (plainte directe, sans lien avec l'escalade) ;
- `"les_deux"`, quand les deux coexistent pour un même ticket.

La déclaration se fait en priorité **au moment du dépôt du signalement**
(case à cocher « J'ai déposé plainte directement auprès de la
police/gendarmerie » dans le formulaire de dépôt), avec une zone de
téléversement cliquable/glissable (`components/DropZoneFichier.tsx`) pour le
récépissé de dépôt de plainte. Elle reste néanmoins possible à tout moment
par la suite depuis le suivi du signalement (`/parent`) si elle n'a pas été
faite au dépôt, indépendamment du statut d'escalade du ticket.

**Le document justificatif est obligatoire** : contrairement au reste de
`SuiteJudiciaire` (purement auto-déclaratif), une plainte directe n'est
enregistrée que si le récépissé est fourni — sans document, rien n'est
enregistré (`lib/tickets.ts` -> `declarerPlainteDirecte` refuse
explicitement toute déclaration sans `documentRef`). Aucun stockage réel
dans ce MVP : seul le nom du fichier est retenu comme référence, à l'image
des autres intégrations externes mockées du projet — et **ce document n'est
jamais transmis à l'établissement**, qui ne reçoit que le fait informatif
(bandeau ci-dessous), jamais la pièce elle-même.

`declarerPlainteDirecte` garantit aussi qu'aucun doublon n'est jamais créé :
si une `SuiteJudiciaire` `"transmission_etablissement"` existe déjà pour le
ticket, elle est mise à jour vers `"les_deux"` ; une plainte directe déjà
déclarée est mise à jour de façon idempotente (pas de second
enregistrement).

Quand l'origine d'un ticket inclut `"plainte_directe_parent"`, la vue
établissement (`/etablissement`) affiche, pour ce ticket précis uniquement,
un bandeau strictement factuel : « Une plainte a été déposée directement par
la famille — le signalement peut faire l'objet d'une enquête judiciaire en
parallèle. » Aucune consigne de conduite, aucun statut individuel — jamais
affiché ailleurs, en particulier jamais sur le dashboard public, qui ne
reçoit que le taux de complétude déclaratif et une répartition agrégée par
`statut` (jamais par `origine`).

Vérifié par `tests/test_origine_les_deux_pas_de_doublon.test.ts` et
`tests/test_bandeau_plainte_visible_etablissement_uniquement.test.ts`.

## Reconnaissance des établissements/collectivités exemplaires

Une section « Établissements et collectivités exemplaires » du tableau de
bord public (`(public)/dashboard/page.tsx`) publie un classement positif par
maille (établissement, commune, EPCI, département, académie), calculé et
lu par `lib/exemplarite.ts` — qui réutilise le seuil de k-anonymité et la
maille géographique dynamique déjà en place pour `/api/dashboard/stats`
(`lib/kAnonymity.ts` -> `K_ANONYMITY_THRESHOLD`), sans dupliquer cette
logique.

Objectif : ne jamais récompenser la suppression du signal (moins de
signalements reçus) plutôt que la qualité du traitement. En conséquence :

- **Le score ne dépend que de métriques de process** — délai moyen de
  réponse, taux de réponse dans les délais, taux de dossiers résolus sans
  blocage (`clôturé_accord_mutuel`/`trianguléfondé`/`trianguléinfondé`) —
  jamais du volume de signalements reçus. `ExemplariteScore.nombreCasEligibles`
  n'existe que pour vérifier le seuil d'éligibilité (voir ci-dessous) ; il
  n'est jamais un paramètre de `lib/exemplarite.ts` ->
  `calculerScoreProcess`, la seule fonction qui dérive un score comparable
  à partir des trois métriques.
- **Seuil d'éligibilité minimum** : une entité dont le nombre de cas clos
  sur la période est inférieur à `K_ANONYMITY_THRESHOLD` n'apparaît dans
  aucun classement, ni bon ni mauvais.
- **Aucun badge permanent** : `calculerScores` (déclenché par
  `/api/cron/exemplarite`, tâche de fond récurrente au même titre que
  `/api/cron/escalade` — jamais recalculé à la volée sur une requête
  utilisateur) écrit des scores horodatés (`calculeLe`) pour une période
  glissante de `EXEMPLARITE_PERIODE_JOURS` jours ; `getClassement` exclut
  tout score de plus de `BADGE_STALENESS_DAYS` jours (30 par défaut) sans
  recalcul.
- **Suspension immédiate** : avant tout affichage, `estExemplaireSuspendu`
  vérifie en temps réel (jamais mis en cache) qu'aucun ticket actif de
  l'entité n'est actuellement au-delà de son délai de réponse
  (`RESPONSE_DEADLINE_HOURS`, réception confirmée dépassée sans réponse).
  Si c'est le cas, le badge est masqué immédiatement, quel que soit le
  score historique.

La vue publique n'affiche jamais le nombre de cas en valeur absolue — une
mention qualitative (« Volume suffisant pour publication ») en tient lieu,
pour éviter qu'un chiffre brut soit interprété comme un critère de mérite.

Simplification assumée : le regroupement par « académie » s'appuie sur
`lib/academies.ts`, une table statique département -> académie
volontairement limitée aux départements du jeu de démonstration (Ardèche,
Isère, Rhône) — à remplacer par un référentiel officiel avant tout usage en
production, le découpage académique n'étant pas exposé par
geo.api.gouv.fr.

Vérifié par `tests/test_volume_neutre_dans_le_score.test.ts`,
`tests/test_seuil_eligibilite_exemplarite.test.ts`,
`tests/test_suspension_badge_ticket_en_retard.test.ts` et
`tests/test_badge_expire_sans_recalcul.test.ts`.

## Prise de position établissement (accepter/contester)

L'ancienne étape unique de "réponse" libre de l'établissement est remplacée
par une prise de position structurée (`lib/positionEtablissement.ts` ->
`enregistrerPosition`) : dans les temps, l'établissement indique s'il
conteste ou non le signalement, avec un commentaire optionnel. Objectif :
éviter que tout signalement non contesté passe systématiquement par
l'association tierce (charge de travail inutile sur les cas simples), sans
jamais permettre à l'établissement d'éteindre seul une affaire.

Routage après enregistrement (une seule position possible par ticket,
aucun changement rétroactif) :

- `"conteste"` **ou** `gravite === "grave"` (quelle que soit la position) :
  statut `"triangulation_requise"`, visible dans la file de l'association
  tierce ;
- `"non_conteste"` **et** gravité standard : statut
  `"attente_cloture_parent"`. Un job périodique
  (`verifierClotureParent`, même mécanisme que `escaladerSiSilence` mais
  appliqué au silence du *parent*) transmet automatiquement le ticket au
  rectorat (`"escaladé_rectorat"`) après `DELAI_CLOTURE_PARENT_JOURS`
  (30 jours par défaut) sans clôture par le parent.

Aucune fonction ne permet à l'établissement de clore un ticket par sa seule
action : `enregistrerPosition` ne mène jamais à un statut de clôture
(`clôturé_accord_mutuel`, `trianguléfondé`, `trianguléinfondé`) — seule
`cloturerParAccordMutuel` (rôle PARENT, double validation) ou un verdict de
l'association tierce (`trianguler`) le peuvent. La seule route API
accessible au rôle ETABLISSEMENT est `/api/signalement/[id]/position`.

Le délai "établissement" exposé par le tableau de bord public
(`lib/dashboardStats.ts`) et par le classement d'exemplarité
(`lib/exemplarite.ts`) reste, sans aucune modification de ces deux
fichiers, celui déjà mesuré jusqu'à `reponduAt` — désormais toujours écrit
au même instant que `positionEtablissementDate` par `enregistrerPosition`,
et jamais retouché ensuite (triangulation, escalade, clôture). C'est ce qui
fige définitivement ce délai au moment de la prise de position.

Côté association tierce, la file de triangulation affiche désormais les
coordonnées connues de l'établissement et du parent (celui-ci ayant
obligatoirement vérifié son email et son téléphone à l'inscription), pour
lui permettre de les recontacter dans le cadre de son évaluation.

Vérifié par `tests/test_delai_fige_a_la_prise_de_position.test.ts`,
`tests/test_gravite_grave_force_triangulation.test.ts`,
`tests/test_non_conteste_sans_cloture_va_au_rectorat.test.ts` et
`tests/test_etablissement_ne_peut_pas_clore_seul.test.ts`.

## Relance déclenchée par l'établissement sur un ticket dormant

Étend le mécanisme de relance déjà en place pour l'association tierce
(section 4.4 du PRD) : un établissement peut signaler un ticket comme
dormant lorsque le parent ne donne plus signe de vie, sans jamais obtenir
le pouvoir de le faire disparaître de ses propres statistiques. Objectif :
éviter l'accumulation de tickets ouverts sans jamais permettre à
l'établissement d'éteindre seul une affaire.

`lib/dormance.ts` -> `signalerDormance` (rôle ETABLISSEMENT exclusivement) :

- refuse tout signalement précoce (ticket créé il y a moins de
  `DELAI_PLANCHER_DORMANCE_JOURS`, 60 jours par défaut) et toute relance déjà
  en attente pour ce ticket (pas de doublon de tâche) ;
- **ne modifie jamais, par lui-même, le statut du ticket** — il crée
  uniquement une entrée `SignalementDormance` et alimente la file de relance
  de l'association tierce (`/association`, section « File de relance —
  tickets dormants »), distincte de la file de triangulation existante.

Seule `lib/dormance.ts` -> `traiterRelance` (rôle ASSOCIATION_TIERCE
exclusivement) peut ensuite faire évoluer le statut :

- `"reponse_obtenue"` : le ticket reprend son cours normal (même règle de
  routage que `lib/positionEtablissement.ts` -> `enregistrerPosition`,
  réutilisée via `statutNormalDuTicket`) ;
- `"sans_nouvelle"` : statut dédié `"sans_nouvelle"` — jamais `"résolu"` ni
  `"classé_sans_suite"`. Alimente les statistiques agrégées comme une
  catégorie à part, cohérente avec le taux de complétude (section 4.4 du
  PRD) plutôt que comme un statut de clôture déguisé.

Vérifié par `tests/test_signalement_dormance_ne_modifie_pas_statut.test.ts`,
`tests/test_delai_plancher_dormance.test.ts`,
`tests/test_sans_nouvelle_jamais_resolu.test.ts` et
`tests/test_seule_association_fait_evoluer_statut.test.ts`.

## Annuaire des contacts rectorat (maintenance manuelle, pas d'API live)

À ne pas confondre avec `ContactCanal` (coordonnées d'établissement, 66 000+
entités, intégration API + cache) : les contacts des 30 rectorats/académies
sont gérés par une table dédiée, `RectoratContact`
(`lib/rectoratContacts.ts`), **maintenue manuellement plutôt qu'intégrée à
une API**. À cette échelle (30 entités), une vérification manuelle
périodique est plus fiable qu'une dépendance API — et l'enjeu d'un mauvais
contact y est plus grave, puisque c'est le point de sortie de toute la
chaîne d'escalade automatique déjà construite (`escaladerSiSilence`,
`verifierClotureParent`).

- **`seedRectoratContacts`** : script d'amorçage à exécuter une seule fois
  (pas un job périodique) à partir d'un jeu de données externe (typiquement
  le jeu MESRI « Rectorats d'académies et vice-rectorats », qui ne sert
  qu'à l'amorçage initial, jamais de source de vérité continue — sa
  fraîcheur réelle n'est pas garantie). Toute entrée créée reste
  `statutVerification = "a_verifier"`, jamais `"verifie"` par défaut. Le
  jeu utilisé par `prisma/seed.ts` (30 académies réelles, coordonnées
  fictives en domaine `-demo.fr`) est un jeu de démonstration, pas un
  import réel du jeu MESRI.
- **`getContactEscalade(academie)`** : seul point de résolution d'un
  contact pour une escalade en cours — toujours une lecture de la table
  locale, **jamais un appel réseau synchrone dans le chemin critique de
  l'escalade**. Ordre de préférence : médiateur académique (si renseigné
  et la fiche vérifiée) → secrétariat général (si renseigné et vérifié) →
  standard du rectorat en dernier recours (toujours disponible). Une fiche
  `"obsolete_suspecte"` n'est jamais utilisée pour le médiateur/secrétariat
  mais reste retournée via le standard, toujours accompagnée d'un
  avertissement explicite.
- **`marquerVerifie`** : interface d'administration simple (pas de workflow
  automatisé) permettant à un opérateur de confirmer ou corriger les
  coordonnées d'une académie, avec horodatage de la vérification.
- **`signalerEchecContact`** : si une tentative d'escalade réelle échoue,
  marque automatiquement l'entrée `"obsolete_suspecte"` et journalise à
  l'intention d'un administrateur — ne corrige **jamais** la donnée
  automatiquement, ne fait que déclencher la vérification manuelle.
- **Alerte de péremption** : toute entrée non revérifiée depuis plus de
  `RECTORAT_REVERIFICATION_MOIS` (6 mois par défaut) apparaît dans le
  tableau de bord d'administration (`admin/rectorats`, rôle `ADMIN`
  exclusivement) comme à re-vérifier — jamais bloquant pour une escalade en
  cours, seulement visible côté administration.

`escaladerSiSilence` et `verifierClotureParent` résolvent chacun le contact
via `getContactEscalade` au moment de l'escalade et journalisent le type de
contact retenu (ou son absence) dans le journal d'audit du ticket — aucune
notification réelle n'est envoyée dans ce MVP.

Vérifié par `tests/test_seed_statut_a_verifier.test.ts`,
`tests/test_ordre_preference_contact.test.ts`,
`tests/test_echec_contact_marque_obsolete.test.ts`,
`tests/test_escalade_lecture_locale_uniquement.test.ts` et
`tests/test_alerte_peremption_6_mois.test.ts`.

## Jeu de données de démonstration

Le seed (`prisma/seed.ts`) génère :

- 3 communes fictives de tailles différentes : **Sainte-Colombe** (3
  signalements — volontairement sous `K_ANONYMITY_THRESHOLD`, 8 par défaut),
  **Vallonry** (4 signalements) et **Grandvillier** (11 signalements, répartis
  sur 2 établissements).
- 18 signalements aux statuts variés : ouvert, en attente de vérification de
  contact, prise de position (contestée ou non) dans les délais, escaladé
  pour silence de l'établissement ou du parent (dont un de chaque escaladé
  automatiquement par les jobs de cron au moment du seed), triangulé (fondé /
  infondé), clôturé par accord mutuel (encore révocable ou non), signalé
  dormant par l'établissement (relance en attente ou déjà traitée sans
  nouvelle du parent), avec ou sans suite judiciaire déclarée.
- 4 comptes de démonstration, un par rôle métier.
- Des coordonnées de contact d'établissement (email, téléphone) pré-vérifiées
  pour la démo, et un établissement dont le seul canal connu a déjà échoué
  une fois, pour illustrer la file « Vérification de contact requise » de
  l'association tierce.

Sur le tableau de bord public, vous pouvez observer la granularité dynamique
en action : Sainte-Colombe et Vallonry (respectivement sous le seuil à
l'échelle de la commune et de leur EPCI) remontent jusqu'au département,
tandis que Grandvillier (11 cas, au-dessus du seuil) s'affiche directement à
l'échelle de la commune.

## Principes non négociables — vérifiés par des tests

Voir `tests/`. Chaque test échoue si la règle correspondante est violée.

1. **Séparation identité / contenu** (`tests/identity-content-separation.test.ts`) :
   le modèle `Ticket` ne contient aucun champ de nom en clair, uniquement un
   `parentPseudoId` opaque ; aucune relation directe n'est déclarée entre
   `Identity` et `Ticket` dans le schéma.
2. **Aucun rôle judiciaire** (`tests/roles.test.ts`) : la liste des rôles
   applicatifs (`ROLES` dans `config.ts`) et le schéma Prisma ne contiennent
   jamais "magistrat", "juge" ou "procureur".
3. **Journal d'audit à chaînage de hash** (`tests/hashchain.test.ts`) :
   `verifyChainIntegrity()` détecte tout maillon altéré.
4. **Seuil de k-anonymité côté API** (`tests/kAnonymity.test.ts` et
   `tests/kAnonymity.integration.test.ts`) : `/api/dashboard/stats` remonte
   automatiquement de maille géographique quand l'effectif est insuffisant —
   testé unitairement et via un appel direct à la route de l'API avec un jeu
   de données à 3 cas.
5. **Aucune trace de paiement** (`tests/no-payment.test.ts`) : scan
   automatique du schéma et du code applicatif.
6. **Pas de statut judiciaire individuel exposé publiquement**
   (`tests/dashboard-no-individual-status.test.ts`) : la réponse du dashboard
   public ne contient jamais d'identifiant de ticket ni de liste
   individuelle, uniquement des agrégats et un taux de complétude
   déclaratif.
7. **Provenance de chaque mise à jour** (`tests/audit-provenance.test.ts`) :
   chaque entrée `AuditLog` porte l'identifiant pseudonyme du compte
   authentifié à l'origine de l'action.
8. **Clôture par accord mutuel encadrée** (`tests/cloture.test.ts`) : refus de
   la clôture directe pour un signalement `grave` ; fenêtre de rétractation
   de `RETRACTION_WINDOW_HOURS` (48h par défaut) pour les autres.

## Simplifications assumées pour ce MVP

**Ce prototype ne doit en aucun cas être utilisé pour traiter de vraies
données sensibles.** Les simplifications suivantes sont volontaires et
documentées pour qu'aucune confusion ne soit possible avec une version
prête pour la production :

- **Pas de vraie authentification FranceConnect/EduConnect.** L'écran de
  connexion simule le choix d'un fournisseur d'identité, mais l'authentification
  réelle repose sur un simple couple email/mot de passe (bcrypt) et un
  cookie de session signé par HMAC maison — pas de JWT tiers, pas de MFA.
- **Contenu des signalements en clair en base.** Le champ `Ticket.contenu`
  n'est pas chiffré. Un chiffrement par enregistrement (au minimum au repos,
  idéalement de bout en bout) est indispensable avant tout traitement de
  données réelles.
- **`Role` n'est pas un enum natif de la base de données.** `Identity.role`
  est un champ `String`, contraint côté applicatif par la constante `ROLES`
  dans `config.ts`, plutôt qu'un enum Postgres natif — un choix de
  simplicité, pas une contrainte technique (Postgres supporte les enums).
- **Le lien entre comptes ETABLISSEMENT et établissement** se fait par un
  simple champ `etablissementId` sur `Identity`, sans logique de gestion de
  plusieurs comptes par établissement.
- **Pas de job de cron réellement planifié en local.** La route
  `/api/cron/escalade` implémente la logique d'escalade automatique et est
  prévue pour être déclenchée par Vercel Cron en production ; en local, le
  seed l'exécute une fois pour démontrer son fonctionnement.
- **Aucune protection CSRF dédiée** au-delà de `sameSite: lax` sur le cookie
  de session — acceptable pour une démo, à durcir avant toute mise en
  production.

## Déploiement Vercel (preview)

1. Poussez ce dépôt sur GitHub (ou connectez-le directement depuis Vercel).
2. Sur [vercel.com](https://vercel.com), créez un nouveau projet à partir du
   dépôt.
3. Dans les paramètres du projet Vercel (**Settings → Environment
   Variables**), définissez pour l'environnement Production (et Preview si
   vous voulez que les previews de PR utilisent la même base) :
   - `DATABASE_URL` — connexion Supabase via le pooler (port `6543`)
   - `DIRECT_URL` — connexion Supabase directe (port `5432`)
   - `SESSION_SECRET` — une valeur aléatoire longue
   - `SEED_ON_BUILD=true` — **uniquement** pour peupler ou réinitialiser les
     données de démo au prochain déploiement (voir point 4) ; à retirer une
     fois les données en place si vous ne voulez plus qu'elles soient
     réinitialisées à chaque déploiement
4. Rien d'autre à configurer : la commande de build (`npm run build`, déjà
   dans `package.json`) exécute automatiquement `prisma db push` avant
   `next build`, sur n'importe quel environnement Vercel — aucune commande
   de build personnalisée à définir dans le dashboard. Si `SEED_ON_BUILD` est
   à `true`, `prisma db seed` s'exécute aussi (voir `scripts/conditional-seed.js`) ;
   sinon cette étape est simplement ignorée, sans erreur.
5. (Optionnel) Configurez un Vercel Cron Job pointant vers
   `/api/cron/escalade` pour déclencher automatiquement l'escalade des
   signalements en silence, un second vers `/api/cron/exemplarite` pour
   recalculer les scores de reconnaissance des établissements/collectivités
   exemplaires, et un troisième vers `/api/cron/cloture-parent` pour
   transmettre au rectorat les signalements non contestés sans clôture du
   parent — voir la
   [documentation Vercel Cron Jobs](https://vercel.com/docs/cron-jobs). Si
   vous définissez `CRON_SECRET` dans les variables d'environnement, protégez
   l'appel avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
6. Déployez : Vercel génère une URL de preview partageable.
