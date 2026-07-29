import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signalerDormance } from "@/lib/dormance";
import { DELAI_PLANCHER_DORMANCE_JOURS } from "@/config";

describe("Délai plancher avant signalement de dormance", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommunePlancher", epci: "EPCI-Plancher", departement: "Dept-Plancher" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Plancher", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("un signalement sur un ticket créé il y a moins de DELAI_PLANCHER_DORMANCE_JOURS est refusé", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-plancher-recent",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket trop récent pour être signalé dormant",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt: new Date(Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS - 5) * 24 * 60 * 60 * 1000),
      },
    });

    await expect(
      signalerDormance({
        ticketId: ticket.id,
        acteurPseudo: "etab-plancher-1",
        role: "ETABLISSEMENT",
      })
    ).rejects.toThrow();

    const entrees = await prisma.signalementDormance.findMany({ where: { ticketId: ticket.id } });
    expect(entrees).toHaveLength(0);

    const ticketApres = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketApres.statut).toBe("attente_cloture_parent");
  });

  it("un signalement sur un ticket créé exactement au seuil est refusé (borne stricte)", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-plancher-limite",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket créé pile au seuil",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt: new Date(Date.now() - DELAI_PLANCHER_DORMANCE_JOURS * 24 * 60 * 60 * 1000 + 1000),
      },
    });

    await expect(
      signalerDormance({
        ticketId: ticket.id,
        acteurPseudo: "etab-plancher-2",
        role: "ETABLISSEMENT",
      })
    ).rejects.toThrow();
  });

  it("un signalement sur un ticket créé il y a plus de DELAI_PLANCHER_DORMANCE_JOURS est accepté", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-plancher-ancien",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket assez ancien pour être signalé dormant",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt: new Date(Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 5) * 24 * 60 * 60 * 1000),
      },
    });

    const signalement = await signalerDormance({
      ticketId: ticket.id,
      acteurPseudo: "etab-plancher-3",
      role: "ETABLISSEMENT",
    });

    expect(signalement.ticketId).toBe(ticket.id);
  });
});
