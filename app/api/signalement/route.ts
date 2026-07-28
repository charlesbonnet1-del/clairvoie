import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { creerSignalement, RegleMetierError } from "@/lib/tickets";
import { resoudreEtablissement, ajouterContactSecondaireParent } from "@/lib/etablissements";
import { tenterContactEtablissement } from "@/lib/contactVerification";
import { enregistrerPersonneMiseEnCause } from "@/lib/personneMiseEnCause";
import { CATEGORIES, TYPES_CONTACT, deriverGraviteDepuisCategorie } from "@/config";

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRole("PARENT");
    if (!identity.emailVerifie || !identity.telephoneVerifie) {
      return NextResponse.redirect(new URL("/verification-compte", req.url), { status: 303 });
    }
    const formData = await req.formData();
    const communeCodeInsee = String(formData.get("communeCodeInsee") ?? "");
    const communeNom = String(formData.get("communeNom") ?? "");
    const communeEpci = String(formData.get("communeEpci") ?? "");
    const communeDepartement = String(formData.get("communeDepartement") ?? "");
    const etablissementUai = String(formData.get("etablissementUai") ?? "");
    const etablissementNom = String(formData.get("etablissementNom") ?? "");
    const etablissementAdresse = String(formData.get("etablissementAdresse") ?? "");
    const categorie = String(formData.get("categorie") ?? "");
    const contenu = String(formData.get("contenu") ?? "");
    const contactsSecondairesJson = String(formData.get("contactsSecondairesJson") ?? "[]");
    const personnesMiseEnCauseJson = String(formData.get("personnesMiseEnCauseJson") ?? "[]");
    const dateFaitsBrut = String(formData.get("dateFaits") ?? "");
    const horaireFaits = String(formData.get("horaireFaits") ?? "");

    if (!communeNom || !etablissementNom || !categorie || !contenu.trim()) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=champs_manquants", req.url),
        { status: 303 }
      );
    }
    if (!CATEGORIES.includes(categorie as (typeof CATEGORIES)[number])) {
      return NextResponse.redirect(
        new URL("/parent/nouveau-signalement?error=categorie_invalide", req.url),
        { status: 303 }
      );
    }

    const etablissementId = await resoudreEtablissement({
      communeCodeInsee,
      communeNom,
      communeEpci,
      communeDepartement,
      etablissementUai,
      etablissementNom,
      etablissementAdresse,
    });

    let contactsSecondaires: Array<{ type?: string; valeur?: string; porteur?: string }> = [];
    try {
      const parsed = JSON.parse(contactsSecondairesJson);
      if (Array.isArray(parsed)) contactsSecondaires = parsed;
    } catch {
      contactsSecondaires = [];
    }

    for (const contact of contactsSecondaires) {
      const type = String(contact.type ?? "");
      const valeur = String(contact.valeur ?? "");
      if (valeur.trim() && TYPES_CONTACT.includes(type as (typeof TYPES_CONTACT)[number])) {
        await ajouterContactSecondaireParent({
          etablissementId,
          type,
          valeur,
          porteur: String(contact.porteur ?? ""),
        });
      }
    }

    const ticket = await creerSignalement({
      parentPseudoId: identity.pseudoId,
      etablissementId,
      categorie,
      contenu,
      gravite: deriverGraviteDepuisCategorie(categorie),
      dateFaits: dateFaitsBrut.trim() ? new Date(dateFaitsBrut.trim()) : null,
      horaireFaits: horaireFaits.trim() || null,
    });

    let personnesMiseEnCause: Array<{ nom?: string; fonction?: string; recurrent?: boolean }> = [];
    try {
      const parsed = JSON.parse(personnesMiseEnCauseJson);
      if (Array.isArray(parsed)) personnesMiseEnCause = parsed;
    } catch {
      personnesMiseEnCause = [];
    }

    for (const personne of personnesMiseEnCause) {
      await enregistrerPersonneMiseEnCause({
        ticketId: ticket.id,
        nom: personne.nom,
        fonction: personne.fonction,
        recurrent: Boolean(personne.recurrent),
      });
    }

    // Tente automatiquement de délivrer le signalement à l'établissement par
    // les canaux disponibles. N'échoue jamais silencieusement mais ne
    // bloque jamais la création du ticket : une erreur ici n'empêche pas le
    // parent de recevoir la confirmation de dépôt.
    try {
      await tenterContactEtablissement(ticket.id);
    } catch (err) {
      console.error(`[contact] échec de la tentative de contact pour ${ticket.id} :`, err);
    }

    return NextResponse.redirect(new URL("/parent?success=cree", req.url), { status: 303 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent/nouveau-signalement?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
