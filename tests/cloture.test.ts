import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  creerSignalement,
  cloturerParAccordMutuel,
  retracterCloture,
  RegleMetierError,
} from "@/lib/tickets";
import { RETRACTION_WINDOW_HOURS } from "@/config";

describe("Principe 8 — clôture par accord mutuel encadrée", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneCloture", epci: "EPCI-C", departement: "Dept-C" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-Cloture", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("refuse la clôture directe pour un signalement grave", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-cloture-grave",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement grave",
      gravite: "grave",
    });

    await expect(
      cloturerParAccordMutuel({ ticketId: ticket.id, acteurPseudo: "parent-cloture-grave" })
    ).rejects.toThrow(RegleMetierError);

    const reloaded = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(reloaded?.statut).not.toBe("clôturé_accord_mutuel");
  });

  it("autorise la clôture directe pour un signalement non grave et pose une fenêtre de rétractation", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-cloture-legere",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement léger",
      gravite: "legere",
    });

    const updated = await cloturerParAccordMutuel({
      ticketId: ticket.id,
      acteurPseudo: "parent-cloture-legere",
    });

    expect(updated.statut).toBe("clôturé_accord_mutuel");
    expect(updated.clotureRevocableJusqua).not.toBeNull();

    const heuresRevocable =
      (updated.clotureRevocableJusqua!.getTime() - updated.clotureAt!.getTime()) /
      (1000 * 60 * 60);
    expect(Math.round(heuresRevocable)).toBe(RETRACTION_WINDOW_HOURS);
  });

  it("permet la rétractation tant que la fenêtre n'est pas dépassée, et la refuse au-delà", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-cloture-retract",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement modéré",
      gravite: "moderee",
    });
    await cloturerParAccordMutuel({
      ticketId: ticket.id,
      acteurPseudo: "parent-cloture-retract",
    });

    const retracte = await retracterCloture({
      ticketId: ticket.id,
      acteurPseudo: "parent-cloture-retract",
    });
    expect(retracte.statut).not.toBe("clôturé_accord_mutuel");

    // Simule une clôture dont la fenêtre de rétractation est déjà dépassée.
    const ticket2 = await creerSignalement({
      parentPseudoId: "parent-cloture-expire",
      etablissementId,
      categorie: "Test",
      contenu: "Signalement modéré expiré",
      gravite: "moderee",
    });
    await cloturerParAccordMutuel({
      ticketId: ticket2.id,
      acteurPseudo: "parent-cloture-expire",
    });
    await prisma.ticket.update({
      where: { id: ticket2.id },
      data: { clotureRevocableJusqua: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await expect(
      retracterCloture({ ticketId: ticket2.id, acteurPseudo: "parent-cloture-expire" })
    ).rejects.toThrow(RegleMetierError);
  });
});
