import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import * as personneMiseEnCauseModule from "@/lib/personneMiseEnCause";

const SCAN_ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "lib"];
const CHOKE_POINT_FILE = path.resolve(SCAN_ROOT, "lib/personneMiseEnCause.ts");

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
  it("aucun fichier hors du point d'accès unique n'appelle findMany/groupBy/aggregate/count/findFirst sur personneMiseEnCause", () => {
    const violations: { file: string; ligne: string }[] = [];
    const motifInterdit =
      /\.personneMiseEnCause\.(findMany|groupBy|aggregate|count|findFirst)\s*\(/;

    for (const dir of SCAN_DIRS) {
      const files = walk(path.join(SCAN_ROOT, dir));
      for (const file of files) {
        if (file === CHOKE_POINT_FILE) continue; // seul endroit autorisé, vérifié séparément ci-dessous
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

  it("l'unique findMany autorisé (dans lib/personneMiseEnCause.ts) est strictement filtré par ticketId, jamais par contenu", () => {
    const source = readFileSync(CHOKE_POINT_FILE, "utf-8");
    const appels = source.match(/prisma\.personneMiseEnCause\.findMany\(\{[^}]*\}\s*\}\)/g) ?? [];

    expect(appels.length).toBeGreaterThan(0);
    for (const appel of appels) {
      expect(appel).toMatch(/where:\s*\{\s*ticketId:/);
      expect(appel).not.toMatch(/nom/i);
      expect(appel).not.toMatch(/fonction/i);
      expect(appel).not.toMatch(/recurrent/i);
    }
  });

  it("le seul module d'accès (lib/personneMiseEnCause.ts) n'expose aucune fonction de recherche/listage générique", () => {
    const nomsExportes = Object.keys(personneMiseEnCauseModule);
    const motifsSuspects = /recherch|^list|search|find(All|By)|toutes?|export|dump/i;

    for (const nom of nomsExportes) {
      expect(nom).not.toMatch(motifsSuspects);
    }

    // Seules deux fonctions doivent exister : lecture scopée à UN ticket
    // précis (qui peut renvoyer plusieurs personnes pour CE ticket), et
    // écriture d'une personne à la fois au dépôt du signalement.
    expect(nomsExportes.sort()).toEqual(
      ["enregistrerPersonneMiseEnCause", "recupererPersonnesMiseEnCause"].sort()
    );
  });

  it("recupererPersonnesMiseEnCause n'accepte qu'un ticketId précis, jamais un critère de recherche", () => {
    const source = readFileSync(CHOKE_POINT_FILE, "utf-8");
    const signatureMatch = source.match(
      /export async function recupererPersonnesMiseEnCause\(params: \{([^}]*)\}/
    );
    expect(signatureMatch).not.toBeNull();
    const paramsBlock = signatureMatch![1];

    expect(paramsBlock).toMatch(/ticketId/);
    expect(paramsBlock).not.toMatch(/nom/i);
    expect(paramsBlock).not.toMatch(/fonction/i);
    expect(paramsBlock).not.toMatch(/recurrent/i);
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
    // Seule la lecture scopée à un ticket (via recupererPersonnesMiseEnCause,
    // appelée depuis les pages serveur) est autorisée ; aucune route API ne
    // doit chercher par nom/fonction.
    expect(suspicious).toEqual([]);
  });
});
