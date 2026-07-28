import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CATEGORIES, deriverGraviteDepuisCategorie } from "@/config";
import { prisma } from "@/lib/prisma";
import { creerSignalement, cloturerParAccordMutuel, RegleMetierError } from "@/lib/tickets";

describe("Dérivation de la gravité à partir de la catégorie", () => {
  it("classe les catégories de violences sexuelles et physiques comme graves", () => {
    expect(deriverGraviteDepuisCategorie("Attouchements et sévices à caractère sexuel")).toBe(
      "grave"
    );
    expect(deriverGraviteDepuisCategorie("Violence physique")).toBe("grave");
  });

  it("ne classe jamais une catégorie inconnue comme grave par défaut", () => {
    expect(deriverGraviteDepuisCategorie("catégorie-inexistante")).not.toBe("grave");
  });

  it("couvre toutes les catégories proposées au parent", () => {
    for (const categorie of CATEGORIES) {
      expect(() => deriverGraviteDepuisCategorie(categorie)).not.toThrow();
    }
  });

  describe("effet de bord sur le principe 8 (clôture encadrée)", () => {
    let etablissementId: string;

    beforeAll(async () => {
      await prisma.auditLog.deleteMany();
      await prisma.ticket.deleteMany();
      await prisma.etablissement.deleteMany();
      await prisma.commune.deleteMany();

      const commune = await prisma.commune.create({
        data: { nom: "CommuneCategorieGravite", epci: "EPCI-CG", departement: "Dept-CG" },
      });
      const etablissement = await prisma.etablissement.create({
        data: { nom: "Etab-CategorieGravite", communeId: commune.id },
      });
      etablissementId = etablissement.id;
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany();
      await prisma.ticket.deleteMany();
      await prisma.etablissement.deleteMany();
      await prisma.commune.deleteMany();
    });

    it("un signalement pour attouchements ne peut pas être clôturé par accord mutuel direct", async () => {
      const categorie = "Attouchements et sévices à caractère sexuel";
      const ticket = await creerSignalement({
        parentPseudoId: "parent-categorie-gravite",
        etablissementId,
        categorie,
        contenu: "Signalement de test",
        gravite: deriverGraviteDepuisCategorie(categorie),
      });

      await expect(
        cloturerParAccordMutuel({ ticketId: ticket.id, acteurPseudo: "parent-categorie-gravite" })
      ).rejects.toThrow(RegleMetierError);
    });
  });
});
