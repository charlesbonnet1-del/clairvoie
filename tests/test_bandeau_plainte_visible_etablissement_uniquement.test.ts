import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { GET as getDashboardStats } from "@/app/api/dashboard/stats/route";

const SCAN_ROOT = path.resolve(__dirname, "..");
const BANNER_TEXT = "Une plainte a été déposée directement par la famille";

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

describe("Bandeau 'plainte déposée directement' — visible uniquement côté établissement", () => {
  it("le texte du bandeau n'apparaît que dans les vues établissement (jamais parent/association/rectorat/public)", () => {
    const files = walk(path.join(SCAN_ROOT, "app"));
    const matches = files.filter((f) => readFileSync(f, "utf-8").includes(BANNER_TEXT));

    expect(matches.map((f) => path.relative(SCAN_ROOT, f))).toEqual([
      path.join("app", "etablissement", "[id]", "page.tsx"),
    ]);
  });

  it("la vue établissement n'affiche jamais le document justificatif de la plainte (documentRef)", () => {
    const source = readFileSync(
      path.join(SCAN_ROOT, "app", "etablissement", "[id]", "page.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("documentRef");
  });

  it("le tableau de bord public n'expose jamais ce bandeau ni l'origine judiciaire individuelle", async () => {
    const response = await getDashboardStats();
    const raw = await response.text();

    expect(raw).not.toContain(BANNER_TEXT);
    expect(raw).not.toContain("plainte_directe_parent");
    expect(raw).not.toContain("les_deux");
    expect(raw).not.toContain("documentRef");

    const body = JSON.parse(raw);
    expect(body.suiteJudiciaire).not.toHaveProperty("origine");
    expect(body.suiteJudiciaire).not.toHaveProperty("documentRef");
  });
});
