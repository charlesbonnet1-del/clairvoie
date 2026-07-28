import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { enregistrerTentativeContact } from "@/lib/contactVerification";
import { GET as getDashboardStats } from "@/app/api/dashboard/stats/route";

describe("Alerte qualité de données — échecs cumulés sur 90 jours", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.alerteQualiteDonnees.deleteMany();
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneAlerteQualite", epci: "EPCI-AQ", departement: "Dept-AQ" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-AlerteQualite", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.alerteQualiteDonnees.deleteMany();
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("3 échecs cumulés en 90 jours déclenchent l'alerte interne", async () => {
    const canal = await prisma.contactCanal.create({
      data: {
        etablissementId,
        type: "email",
        valeur: "obsolete@example.fr",
        source: "annuaire_education_nationale",
      },
    });

    const maintenant = new Date();
    for (let i = 0; i < 3; i++) {
      const ticket = await creerSignalement({
        parentPseudoId: `parent-alerte-${i}`,
        etablissementId,
        categorie: "Test",
        contenu: `Signalement de test ${i}`,
        gravite: "legere",
      });
      await enregistrerTentativeContact({
        ticketId: ticket.id,
        contactCanalId: canal.id,
        methode: "email",
        statut: "echec_rebond",
        timestamp: new Date(maintenant.getTime() + i * 10 * 24 * 60 * 60 * 1000), // espacés de 10 jours
      });
    }

    const alerte = await prisma.alerteQualiteDonnees.findFirst({
      where: { etablissementId, resolue: false },
    });
    expect(alerte).not.toBeNull();
    expect(alerte!.message.toLowerCase()).toContain("obsolète");
  });

  it("l'alerte qualité de données n'apparaît jamais dans les statistiques publiques", async () => {
    const response = await getDashboardStats();
    const raw = await response.text();

    expect(raw).not.toContain("AlerteQualiteDonnees");
    expect(raw.toLowerCase()).not.toContain("obsolète");
    expect(raw).not.toContain(etablissementId);

    const body = JSON.parse(raw);
    expect(body).not.toHaveProperty("alertes");
    expect(body).not.toHaveProperty("alertesQualiteDonnees");
  });
});
