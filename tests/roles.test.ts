import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ROLES } from "@/config";

const FORBIDDEN_TERMS = ["magistrat", "juge", "procureur", "judge", "prosecutor"];

describe("Principe 2 — aucun rôle judiciaire dans l'énumération des rôles", () => {
  it("la liste des rôles applicatifs (config.ts) ne contient aucune valeur judiciaire", () => {
    // Le connecteur SQLite ne supportant pas les enums natifs Prisma,
    // Identity.role est un champ String contraint par ROLES (config.ts),
    // qui fait foi pour ce principe (voir commentaire dans schema.prisma).
    const values = ROLES.map((v) => v.toLowerCase());
    for (const forbidden of FORBIDDEN_TERMS) {
      expect(values.some((v) => v.includes(forbidden))).toBe(false);
    }
  });

  it("le schéma Prisma source ne déclare aucun rôle judiciaire", () => {
    const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf-8").toLowerCase();
    for (const forbidden of FORBIDDEN_TERMS) {
      expect(schema.includes(forbidden)).toBe(false);
    }
  });
});
