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
- Prisma + SQLite en local (migrable vers Postgres sans réécriture du modèle
  de données, à l'exception du champ `role`, voir plus bas)
- Authentification de démonstration : email/mot de passe, sans intégration
  FranceConnect/EduConnect réelle
- Vitest pour les tests

## Démarrage rapide

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

L'application est disponible sur http://localhost:3000.

Si `npx prisma migrate dev` a déjà été lancé une fois, `npm run dev` suffit
ensuite (la base `prisma/dev.db` persiste). Pour repartir de zéro :

```bash
rm -f prisma/dev.db
npx prisma migrate dev
npx prisma db seed
```

### Lancer les tests

```bash
npm test
```

Les tests utilisent une base SQLite dédiée (`prisma/test.db`), distincte de
`prisma/dev.db`, poussée automatiquement au premier lancement.

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
- **`Role` n'est pas un enum natif de la base de données.** SQLite (utilisé
  en local) ne supporte pas les enums Prisma ; `Identity.role` est donc un
  champ `String`, contraint côté applicatif par la constante `ROLES` dans
  `config.ts`. En migrant vers Postgres, ce champ peut redevenir un enum
  natif sans changer la logique applicative.
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
3. Comme SQLite ne convient pas à un déploiement serverless multi-instances,
   provisionnez une base Postgres (Vercel Postgres, Neon, Supabase…) et
   définissez la variable d'environnement `DATABASE_URL` avec la chaîne de
   connexion Postgres dans les paramètres du projet Vercel.
4. Changez le `provider` du datasource dans `prisma/schema.prisma` de
   `sqlite` à `postgresql` (le reste du schéma est compatible tel quel).
5. Définissez également `SESSION_SECRET` (une valeur aléatoire longue) dans
   les variables d'environnement Vercel.
6. Dans les paramètres de build Vercel, assurez-vous que la commande de
   build exécute les migrations avant `next build`, par exemple :
   `npx prisma migrate deploy && npx prisma db seed && next build` (le seed
   n'est utile que pour une preview de démonstration ; à retirer pour un
   déploiement destiné à de vraies données).
7. (Optionnel) Configurez un Vercel Cron Job pointant vers
   `/api/cron/escalade` pour déclencher automatiquement l'escalade des
   signalements en silence — voir la
   [documentation Vercel Cron Jobs](https://vercel.com/docs/cron-jobs). Si
   vous définissez `CRON_SECRET` dans les variables d'environnement, protégez
   l'appel avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
8. Déployez : Vercel génère une URL de preview partageable.
