import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERDICTS } from "@/config";

const STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  répondu: "Répondu",
  escaladé: "Escaladé",
  trianguléfondé: "Triangulé — fondé",
  trianguléinfondé: "Triangulé — infondé",
  clôturé_accord_mutuel: "Clôturé par accord mutuel",
};

export default async function AssociationPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "ASSOCIATION_TIERCE") {
    redirect("/login");
  }

  const aTrianguler = await prisma.ticket.findMany({
    where: { statut: { in: ["répondu", "escaladé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  const dejaTraites = await prisma.ticket.findMany({
    where: { statut: { in: ["trianguléfondé", "trianguléinfondé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { verdictAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-clairvoie-bleu">File de triangulation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rendez un verdict indépendant sur les signalements répondus ou
          escaladés pour silence de l&apos;établissement.
        </p>
      </div>

      {searchParams.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Verdict enregistré.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <div className="space-y-4">
        {aTrianguler.map((ticket) => (
          <div key={ticket.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{ticket.categorie}</p>
                <p className="text-xs text-slate-500">
                  {ticket.etablissement.nom} · {ticket.etablissement.commune.nom} · gravité :{" "}
                  {ticket.gravite}
                </p>
              </div>
              <span className={`badge badge-${ticket.statut}`}>
                {STATUT_LABELS[ticket.statut] ?? ticket.statut}
              </span>
            </div>
            <p className="text-sm text-slate-600">{ticket.contenu}</p>
            {ticket.reponseContenu && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Réponse de l&apos;établissement</p>
                <p className="text-slate-600">{ticket.reponseContenu}</p>
              </div>
            )}
            <form
              action={`/api/signalement/${ticket.id}/trianguler`}
              method="post"
              className="flex items-center gap-2 border-t border-slate-100 pt-3"
            >
              <select name="verdict" className="input w-auto text-xs" required>
                <option value="">Rendre un verdict…</option>
                {VERDICTS.map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary text-xs">
                Valider le verdict
              </button>
            </form>
          </div>
        ))}
        {aTrianguler.length === 0 && (
          <p className="text-slate-500">Aucun signalement en attente de triangulation.</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-700">Verdicts récents</h2>
        <div className="mt-3 space-y-2">
          {dejaTraites.map((ticket) => (
            <div key={ticket.id} className="card flex items-center justify-between">
              <span className="text-sm text-slate-600">{ticket.categorie}</span>
              <span className={`badge badge-${ticket.statut}`}>
                {STATUT_LABELS[ticket.statut] ?? ticket.statut}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
