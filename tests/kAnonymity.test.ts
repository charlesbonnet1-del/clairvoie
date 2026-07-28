import { describe, it, expect } from "vitest";
import { applyKAnonymity } from "@/lib/kAnonymity";

describe("Principe 4 — seuil de k-anonymité (unité)", () => {
  it("garde la maille commune quand l'effectif atteint le seuil", () => {
    const items = Array.from({ length: 8 }, () => ({
      commune: "Grandvillier",
      epci: "Métropole de Grandvillier",
      departement: "Rhône",
    }));
    const result = applyKAnonymity(items, 8);
    expect(result).toEqual([
      { maille: "commune", label: "Grandvillier", count: 8 },
    ]);
  });

  it("remonte à l'EPCI quand la commune est sous le seuil mais l'EPCI l'atteint", () => {
    const items = [
      ...Array.from({ length: 3 }, () => ({
        commune: "Petiteville",
        epci: "CC du Grand Machin",
        departement: "Isère",
      })),
      ...Array.from({ length: 5 }, () => ({
        commune: "Moyenneville",
        epci: "CC du Grand Machin",
        departement: "Isère",
      })),
    ];
    const result = applyKAnonymity(items, 8);
    expect(result).toEqual([
      { maille: "epci", label: "CC du Grand Machin", count: 8 },
    ]);
  });

  it("remonte au département en dernier recours", () => {
    const items = Array.from({ length: 3 }, () => ({
      commune: "Minusculeville",
      epci: "CC Minuscule",
      departement: "Ardèche",
    }));
    const result = applyKAnonymity(items, 8);
    expect(result).toEqual([
      { maille: "departement", label: "Ardèche", count: 3 },
    ]);
  });
});
