import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { seedRectoratContacts } from "@/lib/rectoratContacts";

describe("Amorçage MESRI — toute entrée démarre à 'a_verifier'", () => {
  beforeAll(async () => {
    await prisma.rectoratContact.deleteMany();
  });

  afterAll(async () => {
    await prisma.rectoratContact.deleteMany();
  });

  it("toutes les entrées importées ont statutVerification = 'a_verifier' et source = 'mesri_seed', jamais 'verifie' par défaut", async () => {
    const nombreCreees = await seedRectoratContacts([
      { academie: "Académie de Test A", standardTelephone: "01 00 00 00 01" },
      {
        academie: "Académie de Test B",
        mediateurEmail: "mediateur@ac-testb.demo.fr",
        secretariatEmail: "secretariat@ac-testb.demo.fr",
      },
    ]);

    expect(nombreCreees).toBe(2);

    const entrees = await prisma.rectoratContact.findMany({
      where: { academie: { in: ["Académie de Test A", "Académie de Test B"] } },
    });
    expect(entrees).toHaveLength(2);
    for (const entree of entrees) {
      expect(entree.statutVerification).toBe("a_verifier");
      expect(entree.statutVerification).not.toBe("verifie");
      expect(entree.source).toBe("mesri_seed");
      expect(entree.derniereVerification).toBeNull();
    }
  });

  it("n'écrase pas une entrée déjà existante (ex. déjà vérifiée manuellement)", async () => {
    await seedRectoratContacts([{ academie: "Académie de Test C" }]);
    await prisma.rectoratContact.update({
      where: { academie: "Académie de Test C" },
      data: {
        statutVerification: "verifie",
        source: "verification_manuelle",
        derniereVerification: new Date(),
      },
    });

    const nombreCreees = await seedRectoratContacts([
      { academie: "Académie de Test C", standardTelephone: "09 99 99 99 99" },
    ]);
    expect(nombreCreees).toBe(0);

    const entree = await prisma.rectoratContact.findUniqueOrThrow({
      where: { academie: "Académie de Test C" },
    });
    expect(entree.statutVerification).toBe("verifie");
    expect(entree.source).toBe("verification_manuelle");
  });
});
