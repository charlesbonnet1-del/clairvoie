import { NextRequest, NextResponse } from "next/server";
import { requireRole, UnauthorizedError } from "@/lib/auth";
import { declarerPlainteDirecte, RegleMetierError } from "@/lib/tickets";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireRole("PARENT");
    const formData = await req.formData();

    // Le récépissé de dépôt de plainte est obligatoire : une plainte directe
    // n'est jamais enregistrée sans preuve (contrairement au reste de
    // SuiteJudiciaire, purement auto-déclaratif). Aucun stockage réel dans
    // ce MVP (mock) — seul le nom du fichier est retenu comme référence, et
    // ce document n'est jamais transmis à l'établissement.
    // TODO: intégration réelle (stockage documentaire sécurisé)
    const recepisse = formData.get("recepisse");
    const documentRef = recepisse instanceof File && recepisse.size > 0 ? recepisse.name : null;

    if (!documentRef) {
      return NextResponse.redirect(
        new URL(
          `/parent/${params.id}?error=${encodeURIComponent(
            "Le récépissé de dépôt de plainte est obligatoire pour enregistrer une plainte directe."
          )}`,
          req.url
        ),
        { status: 303 }
      );
    }

    await declarerPlainteDirecte({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      documentRef,
    });

    return NextResponse.redirect(
      new URL(`/parent/${params.id}?success=plainte_directe_declaree`, req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent/${params.id}?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
