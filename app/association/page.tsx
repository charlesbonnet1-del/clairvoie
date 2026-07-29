import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERDICTS, TYPES_CONTACT } from "@/config";
import { STATUT_TICKET_LABELS } from "@/lib/labels";
import { recupererPersonnesMiseEnCause } from "@/lib/personneMiseEnCause";
import { recupererContactParent } from "@/lib/parentAuth";
import PersonneMiseEnCauseCard from "@/components/PersonneMiseEnCauseCard";
import DateFaitsLigne from "@/components/DateFaitsLigne";

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
    where: { statut: { in: ["triangulation_requise", "escaladé"] } },
    include: { etablissement: { include: { commune: true } } },
    orderBy: { createdAt: "asc" },
  });

  const personnesMiseEnCause = new Map(
    await Promise.all(
      aTrianguler.map(async (ticket) => {
        const personnes = await recupererPersonnesMiseEnCause({ ticketId: ticket.id, identity });
        return [ticket.id, personnes] as const;
      })
    )
  );

  // Coordonnées de l'établissement et du parent, pour permettre à
  // l'association tierce de les recontacter dans le cadre de son
  // évaluation — jamais une vue consolidée au-delà du dossier en cours.
  const contactsEtablissement = new Map(
    await Promise.all(
      aTrianguler.map(async (ticket) => {
        const contacts = await prisma.contactCanal.findMany({
          where: { etablissementId: ticket.etablissementId },
        });
        return [ticket.id, contacts] as const;
      })
    )
  );
  const contactsParent = new Map(
    await Promise.all(
      aTrianguler.map(async (ticket) => {
        const contact = await recupererContactParent(ticket.parentPseudoId);
        return [ticket.id, contact] as const;
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
          Rendez un verdict indépendant sur les signalements contestés,
          classés graves, ou escaladés pour silence de l&apos;établissement.
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
            <DateFaitsLigne ticket={ticket} />
            {ticket.positionEtablissement && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-700">
                  Position de l&apos;établissement :{" "}
                  {ticket.positionEtablissement === "conteste" ? "contesté" : "non contesté"}
                </p>
                {ticket.reponseContenu && (
                  <p className="mt-1 text-slate-600">{ticket.reponseContenu}</p>
                )}
              </div>
            )}
            <PersonneMiseEnCauseCard personnes={personnesMiseEnCause.get(ticket.id) ?? []} />

            <div className="grid gap-3 rounded-lg border border-slate-100 p-3 text-xs sm:grid-cols-2">
              <div>
                <p className="font-medium text-slate-600">Contacts de l&apos;établissement</p>
                <ul className="mt-1 space-y-0.5 text-slate-500">
                  {(contactsEtablissement.get(ticket.id) ?? []).map((c) => (
                    <li key={c.id}>
                      {LABEL_TYPE_CONTACT[c.type] ?? c.type} : {c.valeur}
                      {c.porteur ? ` (${c.porteur})` : ""}
                    </li>
                  ))}
                  {(contactsEtablissement.get(ticket.id) ?? []).length === 0 && (
                    <li className="text-slate-400">Aucune coordonnée connue.</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-600">Contact du parent</p>
                {contactsParent.get(ticket.id) ? (
                  <ul className="mt-1 space-y-0.5 text-slate-500">
                    <li>
                      Email : {contactsParent.get(ticket.id)!.email}{" "}
                      {contactsParent.get(ticket.id)!.emailVerifie ? "(vérifié)" : "(non vérifié)"}
                    </li>
                    {contactsParent.get(ticket.id)!.telephone && (
                      <li>
                        Téléphone : {contactsParent.get(ticket.id)!.telephone}{" "}
                        {contactsParent.get(ticket.id)!.telephoneVerifie
                          ? "(vérifié)"
                          : "(non vérifié)"}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-400">Compte parent introuvable.</p>
                )}
              </div>
            </div>
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
