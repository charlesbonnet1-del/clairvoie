import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import * as annuaireApi from "@/lib/annuaireApi";
import { syncEtablissementDepuisAnnuaire } from "@/lib/annuaire";

describe("Repli sur le cache local quand l'annuaire de l'éducation est indisponible", () => {
  const uai = "FALLBACK01";
  let etablissementId: string;
  let communeId: string;

  beforeAll(async () => {
    await prisma.contactCanal.deleteMany();
    await prisma.etablissement.deleteMany({ where: { uai } });

    const commune = await prisma.commune.create({
      data: { nom: "CommuneFallback", epci: "EPCI-FB", departement: "Dept-FB" },
    });
    communeId = commune.id;

    const etablissement = await prisma.etablissement.create({
      data: {
        uai,
        nom: "Établissement en cache",
        communeId,
        // Synchronisation ancienne : force une tentative de rafraîchissement
        // plutôt qu'un simple retour anticipé "assez récent".
        derniereSyncAnnuaire: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.contactCanal.deleteMany();
    await prisma.etablissement.deleteMany({ where: { uai } });
    await prisma.commune.delete({ where: { id: communeId } }).catch(() => {});
  });

  it("utilise la dernière copie en cache sans échouer, en journalisant l'échec", async () => {
    const fetchSpy = vi
      .spyOn(annuaireApi, "fetchAnnuaireRecords")
      .mockRejectedValue(new annuaireApi.AnnuaireIndisponibleError(new Error("simulation de panne")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const resultat = await syncEtablissementDepuisAnnuaire(uai);

    expect(resultat.id).toBe(etablissementId);
    expect(resultat.nom).toBe("Établissement en cache");
    expect(errorSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
