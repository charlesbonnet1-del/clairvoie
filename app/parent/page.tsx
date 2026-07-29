import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUTS_SUITE_JUDICIAIRE, DELAI_CLOTURE_PARENT_JOURS } from "@/config";
import { STATUT_TICKET_LABELS } from "@/lib/labels";
import DateFaitsLigne from "@/components/DateFaitsLigne";
import PlainteDirecteForm from "@/components/PlainteDirecteForm";

export default async function ParentPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "PARENT") {
    redirect("/login");
  }

  const tickets = await prisma.ticket.findMany({
    where: { parentPseudoId: identity.pseudoId },
    include: { etablissement: true, suitesJudiciaires: true },
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

      {searchParams.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Action effectuée avec succès.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      {tickets.length === 0 && (
        <p className="text-slate-500">Vous n&apos;avez déposé aucun signalement pour le moment.</p>
      )}

      <div className="space-y-4">
        {tickets.map((ticket) => {
          const revocable =
            ticket.statut === "clôturé_accord_mutuel" &&
            ticket.clotureRevocableJusqua &&
            ticket.clotureRevocableJusqua > new Date();
          const peutCloturer =
            ticket.gravite !== "grave" &&
            ["ouvert", "attente_cloture_parent"].includes(ticket.statut);
          const plainteDirecteDeclaree = ticket.suitesJudiciaires.find(
            (s) => s.origine === "plainte_directe_parent" || s.origine === "les_deux"
          );

          return (
            <div key={ticket.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{ticket.categorie}</p>
                  <p className="text-xs text-slate-500">
                    {ticket.etablissement.nom} · déposé le{" "}
                    {ticket.createdAt.toLocaleDateString("fr-FR")}
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

              {ticket.statut === "attente_cloture_parent" && (
                <p className="text-xs text-teal-700">
                  L&apos;établissement n&apos;a pas contesté ce signalement. Confirmez la
                  clôture ci-dessous, sans quoi il sera transmis automatiquement au
                  rectorat après {DELAI_CLOTURE_PARENT_JOURS} jours sans action de votre part.
                </p>
              )}

              {ticket.gravite === "grave" &&
                ["ouvert", "triangulation_requise", "escaladé", "escaladé_rectorat"].includes(
                  ticket.statut
                ) && (
                  <p className="text-xs text-amber-700">
                    Signalement classé grave : la clôture ne peut se faire que
                    par validation de l&apos;association tierce, pas par
                    accord mutuel direct.
                  </p>
                )}

              <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                {peutCloturer && (
                  <form action={`/api/signalement/${ticket.id}/cloturer`} method="post">
                    <input type="hidden" name="action" value="cloturer" />
                    <button type="submit" className="btn btn-secondary text-xs">
                      Demander la clôture par accord mutuel
                    </button>
                  </form>
                )}
                {revocable && (
                  <form action={`/api/signalement/${ticket.id}/cloturer`} method="post">
                    <input type="hidden" name="action" value="retracter" />
                    <button type="submit" className="btn btn-secondary text-xs">
                      Annuler la clôture (rétractation, jusqu&apos;au{" "}
                      {ticket.clotureRevocableJusqua!.toLocaleString("fr-FR")})
                    </button>
                  </form>
                )}

                <form
                  action={`/api/signalement/${ticket.id}/suite-judiciaire`}
                  method="post"
                  encType="multipart/form-data"
                  className="flex flex-wrap items-center gap-2"
                >
                  <select name="statut" className="input w-auto text-xs" required>
                    <option value="">Déclarer une suite judiciaire…</option>
                    {STATUTS_SUITE_JUDICIAIRE.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    name="documentJustificatif"
                    className="text-xs"
                    aria-label="Document justificatif (optionnel, ex. courrier de classement sans suite)"
                  />
                  <button type="submit" className="btn btn-secondary text-xs">
                    Déclarer
                  </button>
                </form>
              </div>

              <div className="border-t border-slate-100 pt-3">
                {plainteDirecteDeclaree ? (
                  <p className="text-xs text-slate-500">
                    Vous avez indiqué avoir déposé plainte directement auprès de la
                    police/gendarmerie (auto-déclaratif, non vérifié).
                  </p>
                ) : (
                  <PlainteDirecteForm ticketId={ticket.id} />
                )}
              </div>

              {ticket.suitesJudiciaires.length > 0 && (
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="font-medium text-slate-600">
                    Suites déclarées (auto-déclaratif, non vérifié) :
                  </p>
                  <ul className="list-disc pl-4">
                    {ticket.suitesJudiciaires.map((s) => (
                      <li key={s.id}>
                        {s.statut.replaceAll("_", " ")}
                        {s.origine === "plainte_directe_parent" || s.origine === "les_deux"
                          ? " · plainte déposée directement par la famille"
                          : ""}
                        {s.documentRef ? ` · document : ${s.documentRef}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
