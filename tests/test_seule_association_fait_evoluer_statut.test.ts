import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { signalerDormance, traiterRelance } from "@/lib/dormance";
import { DELAI_PLANCHER_DORMANCE_JOURS } from "@/config";

const SCAN_ROOT = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  let files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (/route\.ts$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Seule l'association tierce, via traiterRelance, peut faire évoluer le
 * statut d'un ticket suite à un signalement de dormance — jamais
 * l'établissement, directement ou indirectement.
 */
describe("Seule l'association tierce fait évoluer le statut après une relance", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneRelanceRole", epci: "EPCI-RR", departement: "Dept-RR" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-RelanceRole", communeId: commune.id },
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

  it("aucune route API accessible au rôle ETABLISSEMENT n'appelle traiterRelance", () => {
    const routeFiles = walk(path.join(SCAN_ROOT, "app", "api"));
    const violations: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf-8");
      if (!/requireRole\(\s*"ETABLISSEMENT"\s*\)/.test(source)) continue;
      if (/traiterRelance/.test(source)) {
        violations.push(path.relative(SCAN_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("la route de relance (/api/signalement/[id]/relance) exige le rôle ASSOCIATION_TIERCE, jamais ETABLISSEMENT", () => {
    const relanceRoute = path.join(
      SCAN_ROOT,
      "app",
      "api",
      "signalement",
      "[id]",
      "relance",
      "route.ts"
    );
    const source = readFileSync(relanceRoute, "utf-8");

    expect(source).toContain('requireRole("ASSOCIATION_TIERCE")');
    expect(source).not.toContain('requireRole("ETABLISSEMENT")');
  });

  it("traiterRelance refuse tout appel dont le rôle n'est pas ASSOCIATION_TIERCE", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-relance-role",
        etablissementId,
        categorie: "Test",
        contenu: "Test rôle invalide pour traiterRelance",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt: new Date(Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 5) * 24 * 60 * 60 * 1000),
      },
    });

    await signalerDormance({
      ticketId: ticket.id,
      acteurPseudo: "etab-relance-role-1",
      role: "ETABLISSEMENT",
    });

    await expect(
      traiterRelance({
        ticketId: ticket.id,
        acteurPseudo: "etab-relance-role-1",
        role: "ETABLISSEMENT",
        resultat: "sans_nouvelle",
      })
    ).rejects.toThrow();

    const ticketApres = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(ticketApres.statut).toBe("attente_cloture_parent");
  });
});
