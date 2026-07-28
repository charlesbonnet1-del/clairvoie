import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { tenterContactEtablissement, evaluerEchecsGracePeriod } from "@/lib/contactVerification";
import { CONTACT_GRACE_PERIOD_HOURS } from "@/config";

describe("L'échec de tous les canaux transmet à l'association, pas au rectorat", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneEchecCanaux", epci: "EPCI-EC", departement: "Dept-EC" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-EchecCanaux", communeId: commune.id },
    });
    etablissementId = etablissement.id;

    await prisma.contactCanal.create({
      data: {
        etablissementId,
        type: "email",
        valeur: "injoignable@example.fr",
        source: "annuaire_education_nationale",
      },
    });
  });

  afterAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("passe par verification_contact_requise, jamais directement par escaladé", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-echec-canaux",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement dont aucun canal ne répond",
      gravite: "legere",
    });

    // Le seul canal disponible (email) échoue systématiquement.
    await tenterContactEtablissement(ticket.id, {
      transports: { email: async () => "echec_rebond" },
    });

    const apresTentative = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(apresTentative.receptionConfirmeeAt).toBeNull();
    expect(apresTentative.statut).toBe("ouvert");

    // Simule le dépassement du délai de grâce (48h) sans réception confirmée.
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        createdAt: new Date(Date.now() - (CONTACT_GRACE_PERIOD_HOURS + 1) * 60 * 60 * 1000),
      },
    });

    const transmis = await evaluerEchecsGracePeriod();
    expect(transmis.map((t) => t.id)).toContain(ticket.id);

    const apresGrace = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(apresGrace.statut).toBe("verification_contact_requise");
    expect(apresGrace.statut).not.toBe("escaladé");
  });
});
