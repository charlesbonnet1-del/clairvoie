import { computeDashboardStats } from "@/lib/dashboardStats";
import { STATUT_TICKET_LABELS } from "@/lib/labels";
import { getClassement, type EntreeClassement } from "@/lib/exemplarite";
import { prisma } from "@/lib/prisma";
import { ENTITES_EXEMPLARITE, BADGE_STALENESS_DAYS, type EntiteExemplarite } from "@/config";

const MAILLE_LABELS: Record<string, string> = {
  commune: "Commune",
  epci: "EPCI",
  departement: "Département",
};

const ENTITE_EXEMPLARITE_LABELS: Record<EntiteExemplarite, string> = {
  etablissement: "Établissement",
  commune: "Commune",
  epci: "EPCI",
  departement: "Département",
  academie: "Académie",
};

/**
 * Résout un entiteId affichable en nom lisible : id réel (Etablissement /
 * Commune) pour ces deux types, simple libellé de maille pour les trois
 * autres (epci/departement/academie ne sont que des champs texte, pas des
 * tables normalisées — voir lib/kAnonymity.ts et lib/exemplarite.ts).
 */
async function resoudreNomsEntites(
  entiteType: EntiteExemplarite,
  entiteIds: string[]
): Promise<Map<string, string>> {
  if (entiteType === "etablissement") {
    const etablissements = await prisma.etablissement.findMany({
      where: { id: { in: entiteIds } },
    });
    return new Map(etablissements.map((e) => [e.id, e.nom]));
  }
  if (entiteType === "commune") {
    const communes = await prisma.commune.findMany({ where: { id: { in: entiteIds } } });
    return new Map(communes.map((c) => [c.id, c.nom]));
  }
  return new Map(entiteIds.map((id) => [id, id]));
}

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

  const classements = await Promise.all(
    ENTITES_EXEMPLARITE.map(async (entiteType) => {
      const classement = await getClassement(entiteType);
      const noms = await resoudreNomsEntites(
        entiteType,
        classement.map((c) => c.entiteId)
      );
      return { entiteType, classement, noms };
    })
  );

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

      <div className="card border-2 border-clairvoie-vert/30">
        <h2 className="font-semibold text-slate-700">
          Établissements et collectivités exemplaires
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Reconnaissance basée uniquement sur la qualité du traitement — délai
          moyen de réponse, respect des délais, dossiers menés à terme sans
          blocage — jamais sur le nombre de signalements reçus. Un badge
          disparaît immédiatement si un dossier de l&apos;entité est
          actuellement en dépassement de délai, et n&apos;est plus affiché
          au-delà de {BADGE_STALENESS_DAYS} jours sans nouveau calcul.
        </p>
        <div className="mt-4 space-y-5">
          {classements.map(({ entiteType, classement, noms }) => (
            <div key={entiteType}>
              <p className="text-xs font-medium uppercase text-slate-400">
                {ENTITE_EXEMPLARITE_LABELS[entiteType]}
              </p>
              {classement.length === 0 ? (
                <p className="mt-1 text-sm text-slate-400">
                  Aucune entité n&apos;atteint pour le moment le volume
                  minimal requis pour être publiée à cette maille.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {classement.map((entree: EntreeClassement) => (
                    <li
                      key={entree.entiteId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {noms.get(entree.entiteId) ?? entree.entiteId}
                      </span>
                      <span className="text-xs text-slate-500">
                        Délai moyen : {heures(entree.delaiMoyenReponse)} · Réponse
                        dans les délais : {pct(entree.tauxReponseDelai)}
                      </span>
                      <span className="badge bg-emerald-100 text-emerald-800">
                        Volume suffisant pour publication
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
