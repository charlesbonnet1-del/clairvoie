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

Le tableau de bord public (`/dashboard`) ne nécessite aucune authentification.

L'écran `/login` simule un choix de fournisseur d'identité
(« FranceConnect (démo) », « EduConnect (démo) ») : il ne s'agit que d'une
mise en scène visuelle, sans aucun appel réel à un fournisseur d'identité.

## Dépôt de signalement : commune et établissement réels

Le formulaire `/parent/nouveau-signalement` ne fait plus choisir
l'établissement dans une liste figée : le parent tape le nom de sa commune,
et l'établissement se pré-remplit à partir de données publiques réelles.

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

## Jeu de données de démonstration

Le seed (`prisma/seed.ts`) génère :

- 3 communes fictives de tailles différentes : **Sainte-Colombe** (3
  signalements — volontairement sous `K_ANONYMITY_THRESHOLD`, 8 par défaut),
  **Vallonry** (4 signalements) et **Grandvillier** (8 signalements, répartis
  sur 2 établissements).
- 15 signalements aux statuts variés : ouvert, répondu dans les délais,
  escaladé pour silence (dont un escaladé automatiquement par le job de
  cron au moment du seed), triangulé (fondé / infondé), clôturé par accord
  mutuel (encore révocable ou non), avec ou sans suite judiciaire déclarée.
- 4 comptes de démonstration, un par rôle métier.

Sur le tableau de bord public, vous pouvez observer la granularité dynamique
en action : Sainte-Colombe et Vallonry (respectivement sous le seuil à
l'échelle de la commune et de leur EPCI) remontent jusqu'au département,
tandis que Grandvillier (8 cas, au seuil) s'affiche directement à l'échelle
de la commune.

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
   signalements en silence — voir la
   [documentation Vercel Cron Jobs](https://vercel.com/docs/cron-jobs). Si
   vous définissez `CRON_SECRET` dans les variables d'environnement, protégez
   l'appel avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
6. Déployez : Vercel génère une URL de preview partageable.
