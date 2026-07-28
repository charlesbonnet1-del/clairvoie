import { NextRequest, NextResponse } from "next/server";
import { evaluerEchecsGracePeriod } from "@/lib/contactVerification";

// Force le rendu à la requête (voir app/api/dashboard/stats/route.ts pour
// le détail) : ce GET ne doit jamais être exécuté au moment du build.
export const dynamic = "force-dynamic";

// Destiné à être déclenché par Vercel Cron, en complément de
// /api/cron/escalade : transmet à l'association tierce les tickets dont la
// réception n'a toujours pas été confirmée au-delà du délai de grâce. Si
// CRON_SECRET est défini côté serveur, l'appel doit porter l'en-tête
// Authorization: Bearer <secret>.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const transmis = await evaluerEchecsGracePeriod();
  return NextResponse.json({
    transmisCount: transmis.length,
    transmisTicketIds: transmis.map((t) => t.id),
  });
}
