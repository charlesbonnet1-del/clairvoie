import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InboxRow from "@/components/InboxRow";

export default async function EtablissementPage() {
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

  // Un établissement ne voit jamais un signalement dont la réception n'a
  // pas été confirmée par un canal de contact vérifié : tant que ce n'est
  // pas le cas, il ne peut pas, de fait, en avoir connaissance.
  const tickets = await prisma.ticket.findMany({
    where: { etablissementId: identity.etablissementId, receptionConfirmeeAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-clairvoie-bleu">Signalements reçus</h1>

      <div className="card divide-y divide-slate-100 p-0">
        {tickets.map((ticket) => (
          <InboxRow
            key={ticket.id}
            href={`/etablissement/${ticket.id}`}
            categorie={ticket.categorie}
            date={ticket.createdAt}
            souscription={`Gravité : ${ticket.gravite}`}
            statut={ticket.statut}
          />
        ))}
        {tickets.length === 0 && (
          <p className="p-4 text-slate-500">Aucun signalement reçu pour le moment.</p>
        )}
      </div>
    </div>
  );
}
