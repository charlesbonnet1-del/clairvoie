import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { enregistrerPosition } from "@/lib/positionEtablissement";

const SCAN_ROOT = path.resolve(__dirname, "..");
const STATUTS_DE_CLOTURE = ["clôturé_accord_mutuel", "trianguléfondé", "trianguléinfondé"];

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
 * Aucune fonction ne doit permettre à l'établissement de faire passer un
 * ticket directement à un statut "résolu" ou "clos" par sa seule action —
 * seule cloturerParAccordMutuel (double validation parent + établissement)
 * ou un verdict de l'association tierce (trianguler) peuvent clore un
 * ticket.
 */
describe("L'établissement ne peut jamais clore seul un ticket", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneCloture", epci: "EPCI-Cloture", departement: "Dept-Cloture" },
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

  it("aucune route API accessible au rôle ETABLISSEMENT n'appelle cloturerParAccordMutuel ni trianguler", () => {
    const routeFiles = walk(path.join(SCAN_ROOT, "app", "api"));
    const violations: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(file, "utf-8");
      if (!/requireRole\(\s*"ETABLISSEMENT"\s*\)/.test(source)) continue;
      if (/cloturerParAccordMutuel|trianguler\(/.test(source)) {
        violations.push(path.relative(SCAN_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it("la seule route accessible au rôle ETABLISSEMENT est la prise de position, et n'appelle qu'enregistrerPosition", () => {
    const routeFiles = walk(path.join(SCAN_ROOT, "app", "api"));
    const routesEtablissement = routeFiles.filter((file) =>
      /requireRole\(\s*"ETABLISSEMENT"\s*\)/.test(readFileSync(file, "utf-8"))
    );

    expect(routesEtablissement.map((f) => path.relative(SCAN_ROOT, f))).toEqual([
      path.join("app", "api", "signalement", "[id]", "position", "route.ts"),
    ]);

    const source = readFileSync(routesEtablissement[0], "utf-8");
    expect(source).toContain("enregistrerPosition");
  });

  it("enregistrerPosition ne fait jamais passer un ticket à un statut de clôture, quelle que soit la position ou la gravité", async () => {
    const combinaisons: Array<{ position: "conteste" | "non_conteste"; gravite: string }> = [
      { position: "conteste", gravite: "legere" },
      { position: "non_conteste", gravite: "legere" },
      { position: "conteste", gravite: "grave" },
      { position: "non_conteste", gravite: "grave" },
    ];

    for (const { position, gravite } of combinaisons) {
      const ticket = await creerSignalement({
        parentPseudoId: `parent-cloture-seule-${position}-${gravite}`,
        etablissementId,
        categorie: "Test",
        contenu: "Test clôture seule établissement",
        gravite,
      });

      const updated = await enregistrerPosition({
        ticketId: ticket.id,
        acteurPseudo: "etab-cloture-1",
        role: "ETABLISSEMENT",
        position,
      });

      expect(STATUTS_DE_CLOTURE).not.toContain(updated.statut);
      expect(["triangulation_requise", "attente_cloture_parent"]).toContain(updated.statut);
    }
  });

  it("enregistrerPosition refuse tout appel dont le rôle n'est pas ETABLISSEMENT", async () => {
    const ticket = await creerSignalement({
      parentPseudoId: "parent-cloture-role",
      etablissementId,
      categorie: "Test",
      contenu: "Test rôle invalide",
      gravite: "legere",
    });

    await expect(
      enregistrerPosition({
        ticketId: ticket.id,
        acteurPseudo: "parent-cloture-role",
        role: "PARENT",
        position: "non_conteste",
      })
    ).rejects.toThrow();
  });
});
