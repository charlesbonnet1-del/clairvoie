-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pseudoId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "etablissementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "epci" TEXT NOT NULL,
    "departement" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Etablissement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    CONSTRAINT "Etablissement_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentPseudoId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "reponseContenu" TEXT,
    "reponduAt" DATETIME,
    "escaladeAt" DATETIME,
    "verdict" TEXT,
    "verdictAt" DATETIME,
    "clotureAt" DATETIME,
    "clotureRevocableJusqua" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "Etablissement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "acteurPseudo" TEXT NOT NULL,
    "hashPrecedent" TEXT NOT NULL,
    "hashCourant" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiteJudiciaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "declaredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuiteJudiciaire_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_pseudoId_key" ON "Identity"("pseudoId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_email_key" ON "Identity"("email");
