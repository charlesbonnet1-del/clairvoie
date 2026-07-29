import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getContactEscalade } from "@/lib/rectoratContacts";

describe("getContactEscalade — ordre de préférence", () => {
  afterAll(async () => {
    await prisma.rectoratContact.deleteMany({
      where: { academie: { startsWith: "Académie de TestOrdre" } },
    });
  });

  it("retourne le médiateur académique en priorité s'il est renseigné et la fiche vérifiée", async () => {
    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestOrdre 1",
        typeContactPrefere: "mediateur_academique",
        medieurEmail: "mediateur@ac-testordre1.demo.fr",
        secretariatEmail: "secretariat@ac-testordre1.demo.fr",
        standardTelephone: "01 00 00 00 00",
        source: "verification_manuelle",
        statutVerification: "verifie",
        derniereVerification: new Date(),
      },
    });

    const resultat = await getContactEscalade("Académie de TestOrdre 1");
    expect(resultat).not.toBeNull();
    expect(resultat!.typeUtilise).toBe("mediateur_academique");
    expect(resultat!.email).toBe("mediateur@ac-testordre1.demo.fr");
  });

  it("retombe sur le secrétariat général si le médiateur n'est pas renseigné", async () => {
    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestOrdre 2",
        typeContactPrefere: "secretariat_general",
        medieurEmail: null,
        secretariatEmail: "secretariat@ac-testordre2.demo.fr",
        standardTelephone: "01 00 00 00 00",
        source: "verification_manuelle",
        statutVerification: "verifie",
        derniereVerification: new Date(),
      },
    });

    const resultat = await getContactEscalade("Académie de TestOrdre 2");
    expect(resultat!.typeUtilise).toBe("secretariat_general");
    expect(resultat!.email).toBe("secretariat@ac-testordre2.demo.fr");
  });

  it("retombe sur le standard du rectorat en dernier recours, y compris si la fiche n'est pas encore vérifiée", async () => {
    await prisma.rectoratContact.create({
      data: {
        academie: "Académie de TestOrdre 3",
        typeContactPrefere: "standard_rectorat",
        medieurEmail: "mediateur@ac-testordre3.demo.fr",
        secretariatEmail: "secretariat@ac-testordre3.demo.fr",
        standardTelephone: "01 00 00 00 03",
        standardAdresse: "Rectorat de TestOrdre 3",
        source: "mesri_seed",
        statutVerification: "a_verifier",
      },
    });

    // Non vérifiée : ni le médiateur ni le secrétariat ne doivent être
    // utilisés malgré leur présence — repli sur le standard.
    const resultat = await getContactEscalade("Académie de TestOrdre 3");
    expect(resultat!.typeUtilise).toBe("standard_rectorat");
    expect(resultat!.telephone).toBe("01 00 00 00 03");
  });

  it("retourne null si l'académie est totalement inconnue de la table locale", async () => {
    const resultat = await getContactEscalade("Académie Totalement Inexistante XYZ");
    expect(resultat).toBeNull();
  });
});
