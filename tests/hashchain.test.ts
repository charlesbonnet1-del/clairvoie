import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { appendAuditLog, verifyChainIntegrity } from "@/lib/hashchain";

describe("Principe 3 — journal d'audit à chaînage de hash", () => {
  let ticketId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "TestCommune", epci: "TestEPCI", departement: "TestDept" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "TestEtab", communeId: commune.id },
    });
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-test",
        etablissementId: etablissement.id,
        categorie: "Test",
        contenu: "Contenu de test",
        gravite: "legere",
        statut: "ouvert",
      },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("chaîne chaque nouvelle entrée sur le hash de la précédente", async () => {
    await appendAuditLog({ ticketId, action: "creation", acteurPseudo: "parent-test" });
    await appendAuditLog({ ticketId, action: "reponse", acteurPseudo: "etab-test" });
    await appendAuditLog({ ticketId, action: "escalade_silence", acteurPseudo: "system:cron" });

    const entries = await prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { timestamp: "asc" },
    });
    expect(entries).toHaveLength(3);
    expect(entries[1].hashPrecedent).toBe(entries[0].hashCourant);
    expect(entries[2].hashPrecedent).toBe(entries[1].hashCourant);
  });

  it("verifyChainIntegrity() confirme une chaîne intacte", async () => {
    const result = await verifyChainIntegrity(ticketId);
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(3);
  });

  it("verifyChainIntegrity() détecte un maillon cassé volontairement", async () => {
    const entries = await prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { timestamp: "asc" },
    });
    const middleEntry = entries[1];

    // On altère volontairement une entrée du milieu de la chaîne.
    await prisma.auditLog.update({
      where: { id: middleEntry.id },
      data: { action: "reponse_falsifiee" },
    });

    const result = await verifyChainIntegrity(ticketId);
    expect(result.valid).toBe(false);
    expect(result.brokenAtEntryId).toBe(middleEntry.id);
  });
});
