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
    const plainteDeposee = String(formData.get("plainteDeposee") ?? "non") === "oui";

    if (!plainteDeposee) {
      return NextResponse.redirect(
        new URL("/parent?success=plainte_non_declaree", req.url),
        { status: 303 }
      );
    }

    // Téléversement optionnel du récépissé de dépôt de plainte : capture par
    // document plutôt que déclaration libre, pour plus de fiabilité. Aucun
    // stockage réel dans ce MVP (mock) — seul le nom du fichier est retenu
    // comme référence.
    // TODO: intégration réelle (stockage documentaire sécurisé)
    const recepisse = formData.get("recepisse");
    const documentRef = recepisse instanceof File && recepisse.size > 0 ? recepisse.name : null;

    await declarerPlainteDirecte({
      ticketId: params.id,
      acteurPseudo: identity.pseudoId,
      documentRef,
    });

    return NextResponse.redirect(
      new URL("/parent?success=plainte_directe_declaree", req.url),
      { status: 303 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
    }
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/parent?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
