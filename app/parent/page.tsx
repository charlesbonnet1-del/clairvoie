import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InboxRow from "@/components/InboxRow";

export default async function ParentPage() {
  const identity = await getSession();
  if (!identity || identity.role !== "PARENT") {
    redirect("/login");
  }

  const tickets = await prisma.ticket.findMany({
    where: { parentPseudoId: identity.pseudoId },
    include: { etablissement: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-clairvoie-bleu">Mes signalements</h1>
        <Link href="/parent/nouveau-signalement" className="btn btn-primary">
          Nouveau signalement
        </Link>
      </div>

      {(!identity.emailVerifie || !identity.telephoneVerifie) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Votre email et votre téléphone doivent être vérifiés avant de pouvoir déposer un
          nouveau signalement.{" "}
          <Link href="/verification-compte" className="underline">
            Vérifier maintenant
          </Link>
        </p>
      )}

      <div className="card divide-y divide-slate-100 p-0">
        {tickets.map((ticket) => (
          <InboxRow
            key={ticket.id}
            href={`/parent/${ticket.id}`}
            categorie={ticket.categorie}
            date={ticket.createdAt}
            souscription={ticket.etablissement.nom}
            statut={ticket.statut}
          />
        ))}
        {tickets.length === 0 && (
          <p className="p-4 text-slate-500">
            Vous n&apos;avez déposé aucun signalement pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
