import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recupererPersonnesMiseEnCause } from "@/lib/personneMiseEnCause";
import { STATUT_TICKET_LABELS } from "@/lib/labels";
import PersonneMiseEnCauseCard from "@/components/PersonneMiseEnCauseCard";
import DateFaitsLigne from "@/components/DateFaitsLigne";

export default async function RectoratTicketPage({ params }: { params: { id: string } }) {
  const identity = await getSession();
  if (!identity || identity.role !== "RECTORAT") {
    redirect("/login");
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, statut: { in: ["escaladé", "escaladé_rectorat"] } },
    include: { etablissement: { include: { commune: true } } },
  });
  if (!ticket) notFound();

  // Un ticket escaladé précis remonte son propre contenu — jamais une vue
  // consolidée sur la personne mise en cause à travers plusieurs dossiers.
  const personnes = await recupererPersonnesMiseEnCause({ ticketId: ticket.id, identity });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/rectorat" className="text-sm text-clairvoie-bleuclair underline">
        ← Retour aux signalements escaladés
      </Link>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium text-slate-800">{ticket.categorie}</p>
            <p className="text-xs text-slate-500">
              {ticket.etablissement.nom} · {ticket.etablissement.commune.nom} · gravité :{" "}
              {ticket.gravite}
            </p>
          </div>
          <span className={`badge badge-${ticket.statut}`}>
            {STATUT_TICKET_LABELS[ticket.statut] ?? ticket.statut}
          </span>
        </div>
        <p className="text-sm text-slate-600">{ticket.contenu}</p>
        <DateFaitsLigne ticket={ticket} />
        <PersonneMiseEnCauseCard personnes={personnes} />
        <p className="text-xs text-slate-400">
          Escaladé le {ticket.escaladeAt?.toLocaleString("fr-FR") ?? "—"}
        </p>
      </div>
    </div>
  );
}
