import { NextResponse } from "next/server";
import { computeDashboardStats } from "@/lib/dashboardStats";

// Endpoint public — aucune authentification requise, aucun statut
// individuel exposé (principe 6). Le seuil de k-anonymité (principe 4) est
// appliqué ici, côté API, pas seulement côté affichage.
export async function GET() {
  const stats = await computeDashboardStats();
  return NextResponse.json(stats);
}
