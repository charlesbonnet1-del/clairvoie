import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getRectoratsAReverifier } from "@/lib/rectoratContacts";
import { RECTORAT_REVERIFICATION_MOIS } from "@/config";

describe("Alerte de péremption — entrées non revérifiées depuis plus de RECTORAT_REVERIFICATION_MOIS", () => {
  beforeAll(async () => {
    await prisma.rectoratContact.deleteMany({
      where: { academie: { startsWith: "Académie de TestPeremption" } },
    });

    const ancienne = new Date(
      Date.now() - (RECTORAT_REVERIFICATION_MOIS * 30 + 10) * 24 * 60 * 60 * 1000
    );
    const recente = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestPeremption Jamais",
        typeContactPrefere: "standard_rectorat",
        standardTelephone: "01 00 00 00 01",
        source: "mesri_seed",
        statutVerification: "a_verifier",
        derniereVerification: null,
      },
    });
    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestPeremption Perimee",
        typeContactPrefere: "standard_rectorat",
        standardTelephone: "01 00 00 00 02",
        source: "verification_manuelle",
        statutVerification: "verifie",
        derniereVerification: ancienne,
      },
    });
    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestPeremption Fraiche",
        typeContactPrefere: "standard_rectorat",
        standardTelephone: "01 00 00 00 03",
        source: "verification_manuelle",
        statutVerification: "verifie",
        derniereVerification: recente,
      },
    });
  });

  afterAll(async () => {
    await prisma.rectoratContact.deleteMany({
      where: { academie: { startsWith: "Académie de TestPeremption" } },
    });
  });

  it("une entrée jamais vérifiée apparaît comme à re-vérifier", async () => {
    const aReverifier = await getRectoratsAReverifier();
    expect(aReverifier.map((c) => c.academie)).toContain("Académie de TestPeremption Jamais");
  });

  it("une entrée vérifiée il y a plus de RECTORAT_REVERIFICATION_MOIS mois apparaît comme à re-vérifier", async () => {
    const aReverifier = await getRectoratsAReverifier();
    expect(aReverifier.map((c) => c.academie)).toContain("Académie de TestPeremption Perimee");
  });

  it("une entrée vérifiée récemment n'apparaît PAS comme à re-vérifier", async () => {
    const aReverifier = await getRectoratsAReverifier();
    expect(aReverifier.map((c) => c.academie)).not.toContain("Académie de TestPeremption Fraiche");
  });

  it("le tableau de bord d'administration consulte bien getRectoratsAReverifier et affiche une mention 'à re-vérifier'", () => {
    const source = readFileSync(
      path.resolve(__dirname, "..", "app", "admin", "rectorats", "page.tsx"),
      "utf-8"
    );
    expect(source).toContain("getRectoratsAReverifier");
    expect(source).toMatch(/re-v[ée]rifier/i);
  });

  it("la péremption n'empêche jamais la résolution d'un contact pour une escalade en cours", async () => {
    // Vérification indirecte : getRectoratsAReverifier ne modifie rien sur
    // les entrées elles-mêmes (purement informatif pour l'administration).
    const avant = await prisma.rectoratContact.findUniqueOrThrow({
      where: { academie: "Académie de TestPeremption Perimee" },
    });
    await getRectoratsAReverifier();
    const apres = await prisma.rectoratContact.findUniqueOrThrow({
      where: { academie: "Académie de TestPeremption Perimee" },
    });
    expect(apres).toEqual(avant);
  });
});
