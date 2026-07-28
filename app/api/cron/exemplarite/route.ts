import { NextRequest, NextResponse } from "next/server";
import { calculerScores, periodeCourante } from "@/lib/exemplarite";

// Force le rendu à la requête (voir app/api/dashboard/stats/route.ts pour
// le détail) : ce GET ne doit jamais être exécuté au moment du build.
export const dynamic = "force-dynamic";

// Destiné à être déclenché par Vercel Cron, tâche de fond récurrente au même
// titre que /api/cron/escalade et /api/cron/verification-contact — jamais
// recalculé à la volée sur une requête utilisateur (voir lib/exemplarite.ts).
// Si CRON_SECRET est défini côté serveur, l'appel doit porter l'en-tête
// Authorization: Bearer <secret>.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const periode = periodeCourante();
  const nombreScoresCalcules = await calculerScores(periode);
  return NextResponse.json({
    periodeDebut: periode.debut.toISOString(),
    periodeFin: periode.fin.toISOString(),
    nombreScoresCalcules,
  });
}
