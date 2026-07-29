import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signalerDormance } from "@/lib/dormance";
import { DELAI_PLANCHER_DORMANCE_JOURS } from "@/config";

/**
 * Principe non négociable : le signalement d'un ticket dormant par
 * l'établissement ne modifie jamais, par lui-même, le statut du ticket. Il
 * ne fait que créer une tâche de relance pour l'association tierce.
 */
describe("signalerDormance seul ne modifie jamais le statut du ticket", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneDormance", epci: "EPCI-Dormance", departement: "Dept-Dormance" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Dormance", communeId: commune.id },
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

  it("le statut reste inchangé après un signalement de dormance, quel que soit le statut de départ", async () => {
    const createdAt = new Date(
      Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 10) * 24 * 60 * 60 * 1000
    );
    const statutsDeDepart = ["ouvert", "attente_cloture_parent", "triangulation_requise"];

    for (const statutDepart of statutsDeDepart) {
      const ticket = await prisma.ticket.create({
        data: {
          parentPseudoId: `parent-dormance-${statutDepart}`,
          etablissementId,
          categorie: "Test",
          contenu: "Ticket dormant pour test",
          gravite: "legere",
          statut: statutDepart,
          createdAt,
        },
      });

      await signalerDormance({
        ticketId: ticket.id,
        acteurPseudo: "etab-dormance-1",
        role: "ETABLISSEMENT",
      });

      const ticketApres = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(ticketApres.statut).toBe(statutDepart);
    }
  });

  it("crée une entrée SignalementDormance non traitée, sans autre effet", async () => {
    const createdAt = new Date(
      Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 10) * 24 * 60 * 60 * 1000
    );
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-dormance-entree",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket dormant pour test d'entrée",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt,
      },
    });

    await signalerDormance({
      ticketId: ticket.id,
      acteurPseudo: "etab-dormance-2",
      role: "ETABLISSEMENT",
    });

    const entrees = await prisma.signalementDormance.findMany({ where: { ticketId: ticket.id } });
    expect(entrees).toHaveLength(1);
    expect(entrees[0].signalePar).toBe("etab-dormance-2");
    expect(entrees[0].relanceEffectuee).toBe(false);
    expect(entrees[0].resultatRelance).toBeNull();
  });
});
