import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERDICTS, TYPES_CONTACT, RESULTATS_RELANCE_DORMANCE } from "@/config";
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

// Statuts pour lesquels un ticket est visible par l'association tierce,
// même hors file de triangulation (ex. déjà traité, ou parti puis revenu
// via une relance) — les tickets ayant au moins une SignalementDormance
// restent visibles quel que soit leur statut courant.
const STATUTS_VISIBLES_ASSOCIATION = [
  "verification_contact_requise",
  "triangulation_requise",
  "escaladé",
  "trianguléfondé",
  "trianguléinfondé",
  "sans_nouvelle",
];

export default async function AssociationTicketPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "ASSOCIATION_TIERCE") {
    redirect("/login");
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: params.id,
      OR: [
        { statut: { in: STATUTS_VISIBLES_ASSOCIATION } },
        { signalementsDormance: { some: {} } },
      ],
    },
    include: {
      etablissement: { include: { commune: true } },
      signalementsDormance: { orderBy: { signaleLe: "desc" } },
    },
  });
  if (!ticket) notFound();

  const personnes = await recupererPersonnesMiseEnCause({ ticketId: ticket.id, identity });
  const contactsEtablissement = await prisma.contactCanal.findMany({
    where: { etablissementId: ticket.etablissementId },
  });
  const contactParent = await recupererContactParent(ticket.parentPseudoId);
  const relanceEnAttente = ticket.signalementsDormance.find((s) => !s.relanceEffectuee);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/association" className="text-sm text-clairvoie-bleuclair underline">
        ← Retour au tableau de l&apos;association
      </Link>

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
      {searchParams.success === "relance_traitee" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Relance traitée.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <div className="card space-y-3">
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

        {ticket.positionEtablissement && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">
              Position de l&apos;établissement :{" "}
              {ticket.positionEtablissement === "conteste" ? "contesté" : "non contesté"}
            </p>
            {ticket.reponseContenu && <p className="mt-1 text-slate-600">{ticket.reponseContenu}</p>}
          </div>
        )}

        <PersonneMiseEnCauseCard personnes={personnes} />

        <div className="grid gap-3 rounded-lg border border-slate-100 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-medium text-slate-600">Contacts de l&apos;établissement</p>
            <ul className="mt-1 space-y-0.5 text-slate-500">
              {contactsEtablissement.map((c) => (
                <li key={c.id}>
                  {LABEL_TYPE_CONTACT[c.type] ?? c.type} : {c.valeur}
                  {c.porteur ? ` (${c.porteur})` : ""}
                </li>
              ))}
              {contactsEtablissement.length === 0 && (
                <li className="text-slate-400">Aucune coordonnée connue.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-600">Contact du parent</p>
            {contactParent ? (
              <ul className="mt-1 space-y-0.5 text-slate-500">
                <li>
                  Email : {contactParent.email}{" "}
                  {contactParent.emailVerifie ? "(vérifié)" : "(non vérifié)"}
                </li>
                {contactParent.telephone && (
                  <li>
                    Téléphone : {contactParent.telephone}{" "}
                    {contactParent.telephoneVerifie ? "(vérifié)" : "(non vérifié)"}
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-1 text-slate-400">Compte parent introuvable.</p>
            )}
          </div>
        </div>

        {ticket.statut === "verification_contact_requise" && (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs text-slate-500">
              Ce n&apos;est pas un silence de l&apos;établissement — c&apos;est un problème de
              coordonnées. Retrouvez une coordonnée fonctionnelle (recherche manuelle, appel
              direct) et soumettez-la une fois qu&apos;elle a fonctionné.
            </p>
            <form
              action={`/api/signalement/${ticket.id}/proposer-contact`}
              method="post"
              className="flex flex-wrap items-center gap-2"
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
              <input name="porteur" className="input w-auto text-xs" placeholder="Porteur (si téléphone)" />
              <button type="submit" className="btn btn-primary text-xs">
                Confirmer ce contact
              </button>
            </form>
          </div>
        )}

        {["triangulation_requise", "escaladé"].includes(ticket.statut) && (
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
        )}

        {relanceEnAttente && (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs text-amber-700">
              Signalé comme dormant par l&apos;établissement le{" "}
              {relanceEnAttente.signaleLe.toLocaleDateString("fr-FR")}. Le statut du ticket
              n&apos;évolue que lorsque vous traitez la relance ci-dessous.
            </p>
            <form
              action={`/api/signalement/${ticket.id}/relance`}
              method="post"
              className="flex items-center gap-2"
            >
              <select name="resultat" className="input w-auto text-xs" required defaultValue="">
                <option value="" disabled>
                  Résultat de la relance…
                </option>
                {RESULTATS_RELANCE_DORMANCE.map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary text-xs">
                Valider
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
