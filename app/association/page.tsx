import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERDICTS, TYPES_CONTACT } from "@/config";
import { STATUT_TICKET_LABELS } from "@/lib/labels";
import { recupererPersonneMiseEnCause } from "@/lib/personneMiseEnCause";

const LABEL_TYPE_CONTACT: Record<string, string> = {
  email: "Email",
  telephone: "Téléphone",
  courrier_recommande_electronique: "Recommandé électronique",
  adresse_postale: "Adresse postale",
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

  const verificationContactRequise = await prisma.ticket.findMany({
    where: { statut: "verification_contact_requise" },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  const aTrianguler = await prisma.ticket.findMany({
    where: { statut: { in: ["répondu", "escaladé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  const personnesMiseEnCause = new Map(
    await Promise.all(
      aTrianguler.map(async (ticket) => {
        const personne = await recupererPersonneMiseEnCause({ ticketId: ticket.id, identity });
        return [ticket.id, personne] as const;
      })
    )
  );

  const dejaTraites = await prisma.ticket.findMany({
    where: { statut: { in: ["trianguléfondé", "trianguléinfondé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { verdictAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      {searchParams.success === "contact_verifie" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Coordonnée vérifiée enregistrée : les signalements en attente pour cet établissement
          reprennent leur cours.
        </p>
      )}
      {searchParams.success === "verdict_rendu" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Verdict enregistré.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <div className="rounded-xl border-2 border-purple-200 bg-purple-50/40 p-5 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">
            Vérification de contact requise
          </h1>
          <p className="mt-1 text-sm text-purple-800">
            Les canaux automatisés n&apos;ont pas réussi à délivrer ces signalements à
            l&apos;établissement. Ce n&apos;est pas un silence de l&apos;établissement — c&apos;est
            un problème de coordonnées. Retrouvez une coordonnée fonctionnelle (recherche
            manuelle, appel direct) et soumettez-la une fois qu&apos;elle a fonctionné.
          </p>
        </div>

        <div className="space-y-4">
          {verificationContactRequise.map((ticket) => (
            <div key={ticket.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{ticket.categorie}</p>
                  <p className="text-xs text-slate-500">
                    {ticket.etablissement.nom} · {ticket.etablissement.commune.nom}
                  </p>
                </div>
                <span className={`badge badge-${ticket.statut}`}>
                  {STATUT_TICKET_LABELS[ticket.statut] ?? ticket.statut}
                </span>
              </div>
              <p className="text-sm text-slate-600">{ticket.contenu}</p>
              <form
                action={`/api/signalement/${ticket.id}/proposer-contact`}
                method="post"
                className="flex flex-wrap items-center gap-2 border-t border-purple-100 pt-3"
              >
                <select name="type" className="input w-auto text-xs" required defaultValue="">
                  <option value="" disabled>
                    Type de coordonnée…
                  </option>
                  {TYPES_CONTACT.map((t) => (
                    <option key={t} value={t}>
                      {LABEL_TYPE_CONTACT[t] ?? t}
                    </option>
                  ))}
                </select>
                <input
                  name="valeur"
                  className="input w-auto flex-1 text-xs"
                  placeholder="Coordonnée vérifiée (email, numéro, adresse…)"
                  required
                />
                <input
                  name="porteur"
                  className="input w-auto text-xs"
                  placeholder="Porteur (si téléphone)"
                />
                <button type="submit" className="btn btn-primary text-xs">
                  Confirmer ce contact
                </button>
              </form>
            </div>
          ))}
          {verificationContactRequise.length === 0 && (
            <p className="text-sm text-purple-800/70">
              Aucun signalement en attente de vérification de contact.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-clairvoie-bleu">File de triangulation</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rendez un verdict indépendant sur les signalements répondus ou
          escaladés pour silence de l&apos;établissement.
        </p>
      </div>

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
                {STATUT_TICKET_LABELS[ticket.statut] ?? ticket.statut}
              </span>
            </div>
            <p className="text-sm text-slate-600">{ticket.contenu}</p>
            {ticket.reponseContenu && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Réponse de l&apos;établissement</p>
                <p className="text-slate-600">{ticket.reponseContenu}</p>
              </div>
            )}
            {personnesMiseEnCause.get(ticket.id) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">Personne mise en cause</p>
                {personnesMiseEnCause.get(ticket.id)!.nom && (
                  <p className="text-slate-600">Nom : {personnesMiseEnCause.get(ticket.id)!.nom}</p>
                )}
                {personnesMiseEnCause.get(ticket.id)!.fonction && (
                  <p className="text-slate-600">
                    Fonction : {personnesMiseEnCause.get(ticket.id)!.fonction}
                  </p>
                )}
                {personnesMiseEnCause.get(ticket.id)!.contexte && (
                  <p className="text-slate-600">
                    Contexte : {personnesMiseEnCause.get(ticket.id)!.contexte}
                  </p>
                )}
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
                {STATUT_TICKET_LABELS[ticket.statut] ?? ticket.statut}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
