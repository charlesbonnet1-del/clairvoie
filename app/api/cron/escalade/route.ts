import { NextRequest, NextResponse } from "next/server";
import { escaladerSiSilence } from "@/lib/tickets";

// Destiné à être déclenché par Vercel Cron. Si CRON_SECRET est défini côté
// serveur, l'appel doit porter l'en-tête Authorization: Bearer <secret>.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const escalades = await escaladerSiSilence();
  return NextResponse.json({
    escaladedCount: escalades.length,
    escaladedTicketIds: escalades.map((t) => t.id),
  });
}
