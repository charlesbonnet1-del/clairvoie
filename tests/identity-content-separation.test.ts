import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("Principe 1 — séparation identité / contenu au niveau du schéma", () => {
  const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf-8");

  function extractModelBlock(modelName: string): string {
    const regex = new RegExp(`model ${modelName} \\{([^}]*)\\}`, "s");
    const match = schema.match(regex);
    expect(match, `model ${modelName} introuvable dans schema.prisma`).not.toBeNull();
    return match![1];
  }

  it("le modèle Ticket ne contient aucun champ de nom en clair", () => {
    const ticketBlock = extractModelBlock("Ticket");
    // Seul un identifiant pseudonyme opaque (parentPseudoId) doit relier le
    // ticket à une identité — jamais displayName, nom, prenom ou email.
    expect(ticketBlock).not.toMatch(/displayName/i);
    expect(ticketBlock).not.toMatch(/\bemail\b/i);
    expect(ticketBlock).not.toMatch(/\bnomParent\b/i);
    expect(ticketBlock).not.toMatch(/\bprenom\b/i);
    expect(ticketBlock).toMatch(/parentPseudoId/);
  });

  it("le modèle Identity est bien distinct du modèle Ticket (pas de relation directe déclarée)", () => {
    const identityBlock = extractModelBlock("Identity");
    const ticketBlock = extractModelBlock("Ticket");

    // Identity ne référence jamais Ticket directement.
    expect(identityBlock).not.toMatch(/Ticket/);
    // Ticket ne référence jamais Identity directement (@relation vers Identity).
    expect(ticketBlock).not.toMatch(/Identity/);
  });

  it("le pont entre Identity et Ticket ne passe que par un pseudoId opaque", () => {
    const identityBlock = extractModelBlock("Identity");
    expect(identityBlock).toMatch(/pseudoId\s+String\s+@unique/);
  });
});
