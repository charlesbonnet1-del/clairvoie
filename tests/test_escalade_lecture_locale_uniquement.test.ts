import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { escaladerSiSilence } from "@/lib/tickets";
import { RESPONSE_DEADLINE_HOURS } from "@/config";

/**
 * La résolution du contact rectorat pendant une escalade (getContactEscalade)
 * doit toujours être une lecture de la table locale RectoratContact, jamais
 * un appel réseau synchrone dans le chemin critique de l'escalade — à la
 * différence du système de contact établissement (ContactCanal), qui lui
 * s'appuie sur une intégration API (annuaire de l'éducation nationale).
 */
describe("escaladerSiSilence — résolution du contact rectorat en lecture locale uniquement", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.rectoratContact.deleteMany({ where: { academie: "Académie de TestReseau" } });
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestReseau",
        typeContactPrefere: "standard_rectorat",
        standardTelephone: "01 00 00 00 00",
        source: "mesri_seed",
        statutVerification: "a_verifier",
      },
    });

    const commune = await prisma.commune.create({
      data: {
        nom: "CommuneTestReseau",
        epci: "EPCI-TestReseau",
        departement: "Dept-TestReseau",
        academie: "Académie de TestReseau",
      },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-TestReseau", communeId: commune.id },
    });
    etablissementId = etablissement.id;

    await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-test-reseau",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket en silence pour test réseau",
        gravite: "legere",
        statut: "ouvert",
        receptionConfirmeeAt: new Date(
          Date.now() - (RESPONSE_DEADLINE_HOURS + 1) * 60 * 60 * 1000
        ),
      },
    });
  });

  afterAll(async () => {
    await prisma.rectoratContact.deleteMany({ where: { academie: "Académie de TestReseau" } });
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("aucun appel réseau (fetch) n'est déclenché pendant escaladerSiSilence", async () => {
    const fetchEspion = vi.fn(() => {
      throw new Error("Appel réseau inattendu pendant escaladerSiSilence");
    });
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = fetchEspion as unknown as typeof fetch;

    try {
      const escalades = await escaladerSiSilence();
      expect(escalades.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = fetchOriginal;
    }

    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("le contact résolu est journalisé (audit) sans jamais figurer dans un appel externe", async () => {
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { etablissementId },
    });
    const entries = await prisma.auditLog.findMany({
      where: { ticketId: ticket.id },
      orderBy: { timestamp: "asc" },
    });
    expect(entries.some((e) => e.action.startsWith("escalade_contact_"))).toBe(true);
  });
});
