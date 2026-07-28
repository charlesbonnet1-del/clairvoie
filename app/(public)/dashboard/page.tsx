import { computeDashboardStats } from "@/lib/dashboardStats";
import { STATUT_TICKET_LABELS } from "@/lib/labels";

const MAILLE_LABELS: Record<string, string> = {
  commune: "Commune",
  epci: "EPCI",
  departement: "Département",
};

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)} %`;
}

function heures(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)} h`;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await computeDashboardStats();
  const maxStatutCount = Math.max(1, ...Object.values(stats.global.repartitionStatuts));
  const maxGeoCount = Math.max(1, ...stats.parGeographie.map((g) => g.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-clairvoie-bleu">
          Tableau de bord public
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Données agrégées, générées le{" "}
          {new Date(stats.generatedAt).toLocaleString("fr-FR")}. Seuil de
          k-anonymité appliqué : {stats.kAnonymityThreshold} cas minimum par
          maille géographique affichée.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Signalements</p>
          <p className="mt-1 text-2xl font-bold text-clairvoie-bleu">
            {stats.global.totalSignalements}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">
            Taux de réponse dans les délais
          </p>
          <p className="mt-1 text-2xl font-bold text-clairvoie-bleu">
            {pct(stats.global.tauxReponseDansLesDelais)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">
            Délai moyen de réponse
          </p>
          <p className="mt-1 text-2xl font-bold text-clairvoie-bleu">
            {heures(stats.global.delaiMoyenReponseHeures)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">
            Taux d&apos;escalade
          </p>
          <p className="mt-1 text-2xl font-bold text-clairvoie-bleu">
            {pct(stats.global.tauxEscalade)}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-700">Répartition par statut</h2>
        <div className="mt-4 space-y-2">
          {Object.entries(stats.global.repartitionStatuts).map(([statut, count]) => (
            <div key={statut} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs text-slate-500">
                {STATUT_TICKET_LABELS[statut] ?? statut}
              </span>
              <div className="h-3 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-clairvoie-bleuclair"
                  style={{ width: `${(count / maxStatutCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-slate-600">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-700">
          Répartition géographique (granularité dynamique)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Toute maille comptant moins de {stats.kAnonymityThreshold} cas est
          automatiquement remontée au niveau supérieur pour préserver
          l&apos;anonymat.
        </p>
        <div className="mt-4 space-y-2">
          {stats.parGeographie.map((groupe) => (
            <div key={`${groupe.maille}-${groupe.label}`} className="flex items-center gap-3">
              <span className="badge bg-slate-200 text-slate-700 w-24 shrink-0 justify-center">
                {MAILLE_LABELS[groupe.maille]}
              </span>
              <span className="w-40 shrink-0 text-xs text-slate-500">{groupe.label}</span>
              <div className="h-3 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full bg-clairvoie-vert"
                  style={{ width: `${(groupe.count / maxGeoCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-slate-600">
                {groupe.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-700">Suites judiciaires déclarées</h2>
        <p className="mt-1 text-xs text-amber-700">{stats.suiteJudiciaire.avertissement}</p>
        <p className="mt-2 text-sm text-slate-600">
          Taux de complétude déclaratif :{" "}
          <span className="font-semibold">
            {pct(stats.suiteJudiciaire.tauxCompletudeDeclaratif)}
          </span>{" "}
          des signalements ont une suite judiciaire renseignée par le parent.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(stats.suiteJudiciaire.repartition).map(([statut, count]) => (
            <span key={statut} className="badge bg-slate-100 text-slate-700">
              {statut.replaceAll("_", " ")} : {count}
            </span>
          ))}
          {Object.keys(stats.suiteJudiciaire.repartition).length === 0 && (
            <span className="text-sm text-slate-400">Aucune suite déclarée pour le moment.</span>
          )}
        </div>
      </div>
    </div>
  );
}
