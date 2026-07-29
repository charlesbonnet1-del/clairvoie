import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signalerDormance, traiterRelance } from "@/lib/dormance";
import { DELAI_PLANCHER_DORMANCE_JOURS } from "@/config";

const STATUTS_DE_CLOTURE = ["clôturé_accord_mutuel", "trianguléfondé", "trianguléinfondé"];

describe("resultatRelance 'sans_nouvelle' ne produit jamais un statut de clôture", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneSansNouvelle", epci: "EPCI-SN", departement: "Dept-SN" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-SansNouvelle", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.signalementDormance.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("un résultat 'sans_nouvelle' fait passer le ticket au statut dédié 'sans_nouvelle', jamais un statut de clôture", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-sans-nouvelle",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket sans nouvelle du parent après relance",
        gravite: "legere",
        statut: "attente_cloture_parent",
        createdAt: new Date(Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 5) * 24 * 60 * 60 * 1000),
      },
    });

    await signalerDormance({
      ticketId: ticket.id,
      acteurPseudo: "etab-sn-1",
      role: "ETABLISSEMENT",
    });

    const updated = await traiterRelance({
      ticketId: ticket.id,
      acteurPseudo: "asso-sn-1",
      role: "ASSOCIATION_TIERCE",
      resultat: "sans_nouvelle",
    });

    expect(updated.statut).toBe("sans_nouvelle");
    expect(STATUTS_DE_CLOTURE).not.toContain(updated.statut);
    expect(updated.statut).not.toBe("résolu");
    expect(updated.statut).not.toBe("classé_sans_suite");

    const signalement = await prisma.signalementDormance.findFirstOrThrow({
      where: { ticketId: ticket.id },
    });
    expect(signalement.relanceEffectuee).toBe(true);
    expect(signalement.resultatRelance).toBe("sans_nouvelle");
  });

  it("un résultat 'reponse_obtenue' ne produit jamais non plus un statut de clôture directement", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        parentPseudoId: "parent-reponse-obtenue",
        etablissementId,
        categorie: "Test",
        contenu: "Ticket avec réponse obtenue après relance",
        gravite: "legere",
        statut: "attente_cloture_parent",
        positionEtablissement: "non_conteste",
        positionEtablissementDate: new Date(
          Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 5) * 24 * 60 * 60 * 1000
        ),
        createdAt: new Date(Date.now() - (DELAI_PLANCHER_DORMANCE_JOURS + 5) * 24 * 60 * 60 * 1000),
      },
    });

    await signalerDormance({
      ticketId: ticket.id,
      acteurPseudo: "etab-sn-2",
      role: "ETABLISSEMENT",
    });

    const updated = await traiterRelance({
      ticketId: ticket.id,
      acteurPseudo: "asso-sn-2",
      role: "ASSOCIATION_TIERCE",
      resultat: "reponse_obtenue",
    });

    expect(STATUTS_DE_CLOTURE).not.toContain(updated.statut);
    expect(updated.statut).toBe("attente_cloture_parent");
  });
});
