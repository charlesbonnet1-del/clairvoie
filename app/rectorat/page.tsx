import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recupererPersonnesMiseEnCause } from "@/lib/personneMiseEnCause";
import PersonneMiseEnCauseCard from "@/components/PersonneMiseEnCauseCard";
import DateFaitsLigne from "@/components/DateFaitsLigne";

export default async function RectoratPage() {
  const identity = await getSession();
  if (!identity || identity.role !== "RECTORAT") {
    redirect("/login");
  }

  const tickets = await prisma.ticket.findMany({
    where: { statut: "escaladé" },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { escaladeAt: "desc" },
  });

  // Un ticket escaladé précis remonte son propre contenu — jamais une vue
  // consolidée sur la personne mise en cause à travers plusieurs dossiers.
  const personnesMiseEnCause = new Map(
    await Promise.all(
      tickets.map(async (ticket) => {
        const personnes = await recupererPersonnesMiseEnCause({ ticketId: ticket.id, identity });
        return [ticket.id, personnes] as const;
      })
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clairvoie-bleu">
          Signalements escaladés
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Établissements n&apos;ayant pas répondu dans le délai imparti, ou
          nécessitant une investigation complémentaire après triangulation.
        </p>
      </div>

      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{ticket.categorie}</p>
                <p className="text-xs text-slate-500">
                  {ticket.etablissement.nom} · {ticket.etablissement.commune.nom} · gravité :{" "}
                  {ticket.gravite}
                </p>
              </div>
              <span className="badge badge-escaladé">Escaladé</span>
            </div>
            <p className="text-sm text-slate-600">{ticket.contenu}</p>
            <DateFaitsLigne ticket={ticket} />
            <PersonneMiseEnCauseCard personnes={personnesMiseEnCause.get(ticket.id) ?? []} />
            <p className="text-xs text-slate-400">
              Escaladé le {ticket.escaladeAt?.toLocaleString("fr-FR") ?? "—"}
            </p>
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="text-slate-500">Aucun signalement escaladé actuellement.</p>
        )}
      </div>
    </div>
  );
}
