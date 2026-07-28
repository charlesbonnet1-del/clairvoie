import { describe, it, expect, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import * as annuaireApi from "@/lib/annuaireApi";
import * as geoApi from "@/lib/geoApi";
import { syncEtablissementDepuisAnnuaire } from "@/lib/annuaire";

describe("Une coordonnée synchronisée depuis l'annuaire reste non_verifie", () => {
  const uai = "FRAISNONVER1";

  afterAll(async () => {
    await prisma.contactCanal.deleteMany({ where: { etablissement: { uai } } });
    const etab = await prisma.etablissement.findUnique({ where: { uai } });
    if (etab) {
      await prisma.etablissement.delete({ where: { id: etab.id } });
      await prisma.commune.deleteMany({ where: { id: etab.communeId } });
    }
  });

  it("statutVerification = 'non_verifie' tant qu'aucune tentative de contact n'a abouti", async () => {
    const fetchSpy = vi.spyOn(annuaireApi, "fetchAnnuaireRecords").mockResolvedValue([
      {
        identifiant_de_l_etablissement: uai,
        nom_etablissement: "École fraîchement synchronisée",
        type_etablissement: "Ecole",
        adresse_1: "1 rue de Test",
        code_postal: "00000",
        code_commune: "00000",
        nom_commune: "Testville",
        telephone: "0100000000",
        mail: "ecole-fraiche@example.fr",
      },
    ]);
    const geoSpy = vi.spyOn(geoApi, "recupererCommuneParCode").mockResolvedValue({
      nom: "Testville",
      codeInsee: "00000",
      epci: "EPCI de Testville",
      departement: "Département de Test",
    });

    const etablissement = await syncEtablissementDepuisAnnuaire(uai);

    const contacts = await prisma.contactCanal.findMany({
      where: { etablissementId: etablissement.id },
    });

    expect(contacts.length).toBeGreaterThan(0);
    for (const contact of contacts) {
      expect(contact.statutVerification).toBe("non_verifie");
      expect(contact.source).toBe("annuaire_education_nationale");
    }

    fetchSpy.mockRestore();
    geoSpy.mockRestore();
  });
});
