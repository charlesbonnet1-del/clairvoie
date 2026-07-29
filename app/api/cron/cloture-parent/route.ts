import { NextRequest, NextResponse } from "next/server";
import { verifierClotureParent } from "@/lib/positionEtablissement";

// Force le rendu à la requête (voir app/api/dashboard/stats/route.ts pour
// le détail) : ce GET ne doit jamais être exécuté au moment du build.
export const dynamic = "force-dynamic";

// Destiné à être déclenché par Vercel Cron, même mécanisme que
// /api/cron/escalade mais appliqué au silence du parent (et non de
// l'établissement) après une position "non_conteste". Si CRON_SECRET est
// défini côté serveur, l'appel doit porter l'en-tête
// Authorization: Bearer <secret>.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const transmis = await verifierClotureParent();
  return NextResponse.json({
    transmisCount: transmis.length,
    transmisTicketIds: transmis.map((t) => t.id),
  });
}
