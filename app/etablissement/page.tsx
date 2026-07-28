import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RESPONSE_DEADLINE_HOURS } from "@/config";

const STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  répondu: "Répondu",
  escaladé: "Escaladé",
  trianguléfondé: "Triangulé — fondé",
  trianguléinfondé: "Triangulé — infondé",
  clôturé_accord_mutuel: "Clôturé par accord mutuel",
};

function delaiRestant(createdAt: Date): string {
  const deadline = new Date(createdAt.getTime() + RESPONSE_DEADLINE_HOURS * 60 * 60 * 1000);
  const heuresRestantes = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
  if (heuresRestantes <= 0) return "Délai dépassé";
  return `${heuresRestantes} h avant escalade automatique`;
}

export default async function EtablissementPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "ETABLISSEMENT") {
    redirect("/login");
  }
  if (!identity.etablissementId) {
    return (
      <p className="text-slate-500">
        Ce compte de démo n&apos;est rattaché à aucun établissement.
      </p>
    );
  }

  const tickets = await prisma.ticket.findMany({
    where: { etablissementId: identity.etablissementId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-clairvoie-bleu">Signalements reçus</h1>

      {searchParams.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Réponse envoyée avec succès.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{ticket.categorie}</p>
                <p className="text-xs text-slate-500">
                  Reçu le {ticket.createdAt.toLocaleDateString("fr-FR")} · gravité :{" "}
                  {ticket.gravite}
                </p>
              </div>
              <span className={`badge badge-${ticket.statut}`}>
                {STATUT_LABELS[ticket.statut] ?? ticket.statut}
              </span>
            </div>
            <p className="text-sm text-slate-600">{ticket.contenu}</p>

            {ticket.statut === "ouvert" && (
              <>
                <p className="text-xs font-medium text-amber-700">
                  {delaiRestant(ticket.createdAt)}
                </p>
                <form
                  action={`/api/signalement/${ticket.id}/repondre`}
                  method="post"
                  className="space-y-2 border-t border-slate-100 pt-3"
                >
                  <textarea
                    className="input"
                    name="reponseContenu"
                    rows={3}
                    required
                    placeholder="Votre réponse au signalement…"
                  />
                  <button type="submit" className="btn btn-primary text-xs">
                    Envoyer la réponse
                  </button>
                </form>
              </>
            )}

            {ticket.reponseContenu && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Votre réponse</p>
                <p className="text-slate-600">{ticket.reponseContenu}</p>
              </div>
            )}
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="text-slate-500">Aucun signalement reçu pour le moment.</p>
        )}
      </div>
    </div>
  );
}
