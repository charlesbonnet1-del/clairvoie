import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const FORBIDDEN_TERMS = [
  "payment",
  "paiement",
  "stripe",
  "invoice",
  "facture",
  "billing",
  "checkout",
  "carte bancaire",
  "creditcard",
];

const SCAN_DIRS = ["app", "lib", "prisma"];
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
    } else if (/\.(ts|tsx|prisma)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Principe 5 — aucun champ, modèle ou route lié à un paiement", () => {
  it("aucun fichier de code ou de schéma ne mentionne de terminologie de paiement", () => {
    const violations: { file: string; term: string }[] = [];

    for (const dir of SCAN_DIRS) {
      const fullDir = path.join(SCAN_ROOT, dir);
      const files = walk(fullDir);
      for (const file of files) {
        const content = readFileSync(file, "utf-8").toLowerCase();
        for (const term of FORBIDDEN_TERMS) {
          if (content.includes(term)) {
            violations.push({ file, term });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("aucune route API n'existe sous un chemin lié au paiement", () => {
    const apiDir = path.join(SCAN_ROOT, "app/api");
    const files = walk(apiDir);
    const suspiciousPaths = files.filter((f) =>
      FORBIDDEN_TERMS.some((term) => f.toLowerCase().includes(term))
    );
    expect(suspiciousPaths).toEqual([]);
  });
});
