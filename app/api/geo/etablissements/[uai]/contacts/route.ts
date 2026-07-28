import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEtablissementDepuisAnnuaire } from "@/lib/annuaire";

export const dynamic = "force-dynamic";

export interface ContactOfficielAffiche {
  type: string;
  valeur: string;
  statutVerification: string;
}

// Synchronise l'établissement depuis l'annuaire (au besoin) et renvoie ses
// coordonnées officielles connues, pour affichage dans le formulaire de
// signalement au moment où le parent choisit l'établissement — avant même
// la soumission. Jamais les coordonnées "propose_par_parent" : uniquement
// celles qui font foi (annuaire de l'éducation, ou confirmées par
// l'association tierce).
export async function GET(
  _req: NextRequest,
  { params }: { params: { uai: string } }
) {
  const uai = params.uai?.trim();
  if (!uai) {
    return NextResponse.json({ etablissementId: null, contacts: [] });
  }

  let etablissementId: string;
  try {
    const etablissement = await syncEtablissementDepuisAnnuaire(uai);
    etablissementId = etablissement.id;
  } catch {
    return NextResponse.json({ etablissementId: null, contacts: [] });
  }

  const contacts = await prisma.contactCanal.findMany({
    where: {
      etablissementId,
      source: { in: ["annuaire_education_nationale", "confirme_etablissement"] },
    },
    select: { type: true, valeur: true, statutVerification: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ etablissementId, contacts });
}
