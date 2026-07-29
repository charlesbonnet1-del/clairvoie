import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InboxRow from "@/components/InboxRow";

export default async function AssociationPage() {
  const identity = await getSession();
  if (!identity || identity.role !== "ASSOCIATION_TIERCE") {
    redirect("/login");
  }

  const verificationContactRequise = await prisma.ticket.findMany({
    where: { statut: "verification_contact_requise" },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  const aTrianguler = await prisma.ticket.findMany({
    where: { statut: { in: ["triangulation_requise", "escaladé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  // File de relance — tickets dormants signalés par un établissement,
  // distincte de la file de triangulation ci-dessus : un signalement de
  // dormance ne modifie jamais le statut par lui-même, seule cette relance,
  // une fois traitée ici, le peut (lib/dormance.ts -> traiterRelance).
  const aRelancer = await prisma.ticket.findMany({
    where: { signalementsDormance: { some: { relanceEffectuee: false } } },
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
      <div className="rounded-xl border-2 border-purple-200 bg-purple-50/40 p-5 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Vérification de contact requise</h1>
          <p className="mt-1 text-sm text-purple-800">
            Les canaux automatisés n&apos;ont pas réussi à délivrer ces signalements à
            l&apos;établissement. Ce n&apos;est pas un silence de l&apos;établissement — c&apos;est
            un problème de coordonnées.
          </p>
        </div>
        <div className="card divide-y divide-purple-100 bg-white p-0">
          {verificationContactRequise.map((ticket) => (
            <InboxRow
              key={ticket.id}
              href={`/association/${ticket.id}`}
              categorie={ticket.categorie}
              date={ticket.createdAt}
              souscription={`${ticket.etablissement.nom} · ${ticket.etablissement.commune.nom}`}
              statut={ticket.statut}
            />
          ))}
          {verificationContactRequise.length === 0 && (
            <p className="p-4 text-sm text-purple-800/70">
              Aucun signalement en attente de vérification de contact.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-clairvoie-bleu">File de triangulation</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rendez un verdict indépendant sur les signalements contestés, classés graves, ou
          escaladés pour silence de l&apos;établissement.
        </p>
      </div>
      <div className="card divide-y divide-slate-100 p-0">
        {aTrianguler.map((ticket) => (
          <InboxRow
            key={ticket.id}
            href={`/association/${ticket.id}`}
            categorie={ticket.categorie}
            date={ticket.createdAt}
            souscription={`${ticket.etablissement.nom} · ${ticket.etablissement.commune.nom}`}
            statut={ticket.statut}
          />
        ))}
        {aTrianguler.length === 0 && (
          <p className="p-4 text-slate-500">Aucun signalement en attente de triangulation.</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-clairvoie-bleu">
          File de relance — tickets dormants
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Signalés par un établissement lorsque le parent ne donne plus signe de vie. Le statut du
          ticket n&apos;évolue que lorsque vous traitez la relance.
        </p>
      </div>
      <div className="card divide-y divide-slate-100 p-0">
        {aRelancer.map((ticket) => (
          <InboxRow
            key={ticket.id}
            href={`/association/${ticket.id}`}
            categorie={ticket.categorie}
            date={ticket.createdAt}
            souscription={`${ticket.etablissement.nom} · ${ticket.etablissement.commune.nom}`}
            statut={ticket.statut}
          />
        ))}
        {aRelancer.length === 0 && (
          <p className="p-4 text-slate-500">Aucune relance en attente de traitement.</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-700">Verdicts récents</h2>
        <div className="card mt-3 divide-y divide-slate-100 p-0">
          {dejaTraites.map((ticket) => (
            <InboxRow
              key={ticket.id}
              href={`/association/${ticket.id}`}
              categorie={ticket.categorie}
              date={ticket.verdictAt ?? ticket.createdAt}
              souscription={`${ticket.etablissement.nom} · ${ticket.etablissement.commune.nom}`}
              statut={ticket.statut}
            />
          ))}
          {dejaTraites.length === 0 && (
            <p className="p-4 text-slate-500">Aucun verdict rendu pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
}
