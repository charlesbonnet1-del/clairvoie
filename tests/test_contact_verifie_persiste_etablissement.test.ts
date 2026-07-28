import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { creerSignalement } from "@/lib/tickets";
import { enregistrerTentativeContact } from "@/lib/contactVerification";

describe("Un canal vérifié persiste pour l'établissement, sans nouvelle vérification", () => {
  let etablissementId: string;

  beforeAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();

    const commune = await prisma.commune.create({
      data: { nom: "CommuneContactPersiste", epci: "EPCI-CP", departement: "Dept-CP" },
    });
    const etablissement = await prisma.etablissement.create({
      data: { nom: "Etab-ContactPersiste", communeId: commune.id },
    });
    etablissementId = etablissement.id;
  });

  afterAll(async () => {
    await prisma.tentativeContact.deleteMany();
    await prisma.contactCanal.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.etablissement.deleteMany();
    await prisma.commune.deleteMany();
  });

  it("reste 'verifie' pour un futur ticket du même établissement, et reste directement exploitable", async () => {
    const canal = await prisma.contactCanal.create({
      data: {
        etablissementId,
        type: "email",
        valeur: "secretariat@example.fr",
        source: "annuaire_education_nationale",
      },
    });

    const ticket1 = await creerSignalement({
      parentPseudoId: "parent-persiste-1",
      etablissementId,
      categorie: "Test",
      contenu: "Premier signalement",
      gravite: "legere",
    });

    await enregistrerTentativeContact({
      ticketId: ticket1.id,
      contactCanalId: canal.id,
      methode: "email",
      statut: "livre",
    });

    const canalApresTicket1 = await prisma.contactCanal.findUniqueOrThrow({
      where: { id: canal.id },
    });
    expect(canalApresTicket1.statutVerification).toBe("verifie");

    // Un second ticket est déposé plus tard pour le même établissement : le
    // canal doit rester "verifie" sans qu'aucune action de re-vérification
    // n'ait eu lieu entre-temps.
    const ticket2 = await creerSignalement({
      parentPseudoId: "parent-persiste-2",
      etablissementId,
      categorie: "Test",
      contenu: "Second signalement, plus tard",
      gravite: "legere",
    });

    const canalAvantTicket2 = await prisma.contactCanal.findUniqueOrThrow({
      where: { id: canal.id },
    });
    expect(canalAvantTicket2.statutVerification).toBe("verifie");
    expect(canalAvantTicket2.echecsConsecutifs).toBe(0);

    // Le même canal, déjà vérifié, sert directement pour ce second ticket.
    await enregistrerTentativeContact({
      ticketId: ticket2.id,
      contactCanalId: canal.id,
      methode: "email",
      statut: "livre",
    });

    const ticket2Rafraichi = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket2.id } });
    expect(ticket2Rafraichi.receptionConfirmeeAt).not.toBeNull();
  });
});
