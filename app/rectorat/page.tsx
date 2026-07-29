import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InboxRow from "@/components/InboxRow";

export default async function RectoratPage() {
  const identity = await getSession();
  if (!identity || identity.role !== "RECTORAT") {
    redirect("/login");
  }

  const tickets = await prisma.ticket.findMany({
    where: { statut: { in: ["escaladé", "escaladé_rectorat"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { escaladeAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clairvoie-bleu">Signalements escaladés</h1>
        <p className="mt-1 text-sm text-slate-500">
          Établissements n&apos;ayant pas pris position dans le délai imparti, ou signalements non
          contestés restés sans clôture du parent au-delà du délai imparti.
        </p>
      </div>

      <div className="card divide-y divide-slate-100 p-0">
        {tickets.map((ticket) => (
          <InboxRow
            key={ticket.id}
            href={`/rectorat/${ticket.id}`}
            categorie={ticket.categorie}
            date={ticket.escaladeAt ?? ticket.createdAt}
            souscription={`${ticket.etablissement.nom} · ${ticket.etablissement.commune.nom}`}
            statut={ticket.statut}
          />
        ))}
        {tickets.length === 0 && (
          <p className="p-4 text-slate-500">Aucun signalement escaladé actuellement.</p>
        )}
      </div>
    </div>
  );
}
