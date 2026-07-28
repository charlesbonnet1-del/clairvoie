import { NextResponse } from "next/server";
import { computeDashboardStats } from "@/lib/dashboardStats";

// Force le rendu à la requête : sans ça, Next.js tente d'exécuter ce GET au
// moment du build pour le mettre en cache statique, ce qui échoue dès que
// la base de données n'est pas joignable pendant le build (ex. sur Vercel
// avant qu'une base Postgres ne soit provisionnée).
export const dynamic = "force-dynamic";

// Endpoint public — aucune authentification requise, aucun statut
// individuel exposé (principe 6). Le seuil de k-anonymité (principe 4) est
// appliqué ici, côté API, pas seulement côté affichage.
export async function GET() {
  const stats = await computeDashboardStats();
  return NextResponse.json(stats);
}
