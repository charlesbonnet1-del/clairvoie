import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/dashboard/stats/route";

describe("Principe 6 — pas de statut judiciaire individuel exposé publiquement", () => {
  let ticketId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneJudiciaire", epci: "EPCI-J", departement: "Dept-J" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-J", communeId: commune.id },
    });
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-judiciaire-test",
        etablissementId: etablissement.id,
        categorie: "Test",
        contenu: "Signalement avec suite judiciaire déclarée",
        gravite: "grave",
        statut: "ouvert",
      },
    });
    ticketId = ticket.id;
    await prisma.suiteJudiciaire.create({
      data: { ticketId: ticket.id, statut: "condamnation" },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.suiteJudiciaire.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("la réponse du dashboard public ne référence aucun identifiant de ticket", async () => {
    const response = await GET();
    const raw = await response.text();
    expect(raw.includes(ticketId)).toBe(false);
    expect(raw.includes("parent-judiciaire-test")).toBe(false);
  });

  it("la réponse n'expose que des agrégats, jamais une liste de tickets individuels", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).not.toHaveProperty("tickets");
    expect(body).not.toHaveProperty("signalements");
    expect(Array.isArray(body.parGeographie)).toBe(true);
    for (const groupe of body.parGeographie) {
      expect(groupe).not.toHaveProperty("ticketId");
      expect(groupe).not.toHaveProperty("statutJudiciaire");
    }

    // La suite judiciaire ne doit apparaître que sous forme de compteurs
    // agrégés par statut, jamais rattachée à un ticket identifiable.
    expect(typeof body.suiteJudiciaire.repartition).toBe("object");
    expect(Array.isArray(body.suiteJudiciaire.repartition)).toBe(false);
    expect(typeof body.suiteJudiciaire.tauxCompletudeDeclaratif).toBe("number");
  });
});
