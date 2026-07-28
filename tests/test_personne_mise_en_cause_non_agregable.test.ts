import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import * as personneMiseEnCauseModule from "@/lib/personneMiseEnCause";

const SCAN_ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "lib"];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  let files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Principe (article 46 LIL) — PersonneMiseEnCause non agrégeable entre tickets", () => {
  it("aucun fichier du code n'appelle findMany/groupBy/aggregate/count sur personneMiseEnCause", () => {
    const violations: { file: string; ligne: string }[] = [];
    const motifInterdit =
      /\.personneMiseEnCause\.(findMany|groupBy|aggregate|count|findFirst)\s*\(/;

    for (const dir of SCAN_DIRS) {
      const files = walk(path.join(SCAN_ROOT, dir));
      for (const file of files) {
        const lignes = readFileSync(file, "utf-8").split("\n");
        lignes.forEach((ligne) => {
          if (motifInterdit.test(ligne)) {
            violations.push({ file: path.relative(SCAN_ROOT, file), ligne: ligne.trim() });
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });

  it("le seul module d'accès (lib/personneMiseEnCause.ts) n'expose aucune fonction de recherche/listage", () => {
    const nomsExportes = Object.keys(personneMiseEnCauseModule);
    const motifsSuspects = /recherch|list|search|find(All|By)|toutes?|export|dump/i;

    for (const nom of nomsExportes) {
      expect(nom).not.toMatch(motifsSuspects);
    }

    // Seules deux fonctions doivent exister : lecture scopée à un ticket
    // précis, et écriture au dépôt du signalement.
    expect(nomsExportes.sort()).toEqual(
      ["enregistrerPersonneMiseEnCause", "recupererPersonneMiseEnCause"].sort()
    );
  });

  it("recupererPersonneMiseEnCause n'accepte qu'un ticketId précis, jamais un critère de recherche", () => {
    const source = readFileSync(
      path.resolve(SCAN_ROOT, "lib/personneMiseEnCause.ts"),
      "utf-8"
    );
    const signatureMatch = source.match(
      /export async function recupererPersonneMiseEnCause\(params: \{([^}]*)\}/
    );
    expect(signatureMatch).not.toBeNull();
    const paramsBlock = signatureMatch![1];

    expect(paramsBlock).toMatch(/ticketId/);
    expect(paramsBlock).not.toMatch(/nom/i);
    expect(paramsBlock).not.toMatch(/fonction/i);
    expect(paramsBlock).not.toMatch(/contexte/i);
  });

  it("aucune route API n'expose de recherche par personne mise en cause", () => {
    const files = walk(path.join(SCAN_ROOT, "app", "api"));
    const suspicious = files.filter((f) => {
      const content = readFileSync(f, "utf-8").toLowerCase();
      return (
        content.includes("personnemiseencause") &&
        (content.includes("searchparams.get(\"nom\")") ||
          content.includes("searchparams.get('nom')") ||
          content.includes("req.nextUrl.searchParams"))
      );
    });
    // Seule la lecture scopée à un ticket (via recupererPersonneMiseEnCause,
    // appelée depuis les pages serveur) est autorisée ; aucune route API ne
    // doit chercher par nom/fonction/contexte.
    expect(suspicious).toEqual([]);
  });
});
