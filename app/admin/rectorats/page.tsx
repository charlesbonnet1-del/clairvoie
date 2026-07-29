import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getTousLesRectoratContacts,
  getRectoratsAReverifier,
} from "@/lib/rectoratContacts";
import { TYPES_CONTACT_RECTORAT, RECTORAT_REVERIFICATION_MOIS } from "@/config";

const LABEL_STATUT: Record<string, string> = {
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  obsolete_suspecte: "Obsolète suspectée",
};

const BADGE_STATUT: Record<string, string> = {
  a_verifier: "bg-amber-100 text-amber-800",
  verifie: "bg-emerald-100 text-emerald-700",
  obsolete_suspecte: "bg-red-100 text-red-700",
};

export default async function AdminRectoratsPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "ADMIN") {
    redirect("/login");
  }

  const contacts = await getTousLesRectoratContacts();
  const aReverifier = await getRectoratsAReverifier();
  const academiesAReverifier = new Set(aReverifier.map((c) => c.academie));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clairvoie-bleu">
          Annuaire des contacts rectorat
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Table maintenue manuellement (30 académies) — jamais une intégration API
          automatisée. Les coordonnées importées depuis le jeu de données MESRI restent
          « à vérifier » tant qu&apos;un opérateur ne les a pas confirmées. Une entrée non
          revérifiée depuis plus de {RECTORAT_REVERIFICATION_MOIS} mois apparaît ci-dessous
          comme à re-vérifier — cela n&apos;empêche jamais une escalade en cours d&apos;utiliser
          le contact disponible.
        </p>
      </div>

      {searchParams.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Vérification enregistrée.
        </p>
      )}
      {searchParams.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}

      <div className="space-y-4">
        {contacts.map((contact) => {
          const areverifier = academiesAReverifier.has(contact.academie);
          return (
            <div key={contact.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{contact.academie}</p>
                  <p className="text-xs text-slate-500">
                    Source : {contact.source.replaceAll("_", " ")} · Dernière vérification :{" "}
                    {contact.derniereVerification
                      ? contact.derniereVerification.toLocaleDateString("fr-FR")
                      : "jamais"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {areverifier && (
                    <span className="badge bg-orange-100 text-orange-800">À re-vérifier</span>
                  )}
                  <span className={`badge ${BADGE_STATUT[contact.statutVerification] ?? ""}`}>
                    {LABEL_STATUT[contact.statutVerification] ?? contact.statutVerification}
                  </span>
                </div>
              </div>

              <form
                action={`/api/admin/rectorats/${encodeURIComponent(contact.academie)}/verifier`}
                method="post"
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="sm:col-span-2">
                  <label className="label">Type de contact préféré</label>
                  <select
                    name="typeContactPrefere"
                    className="input"
                    defaultValue={contact.typeContactPrefere}
                  >
                    {TYPES_CONTACT_RECTORAT.map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Email médiateur académique</label>
                  <input
                    className="input"
                    name="medieurEmail"
                    defaultValue={contact.medieurEmail ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Téléphone médiateur académique</label>
                  <input
                    className="input"
                    name="medieurTelephone"
                    defaultValue={contact.medieurTelephone ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Email secrétariat général</label>
                  <input
                    className="input"
                    name="secretariatEmail"
                    defaultValue={contact.secretariatEmail ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Téléphone secrétariat général</label>
                  <input
                    className="input"
                    name="secretariatTelephone"
                    defaultValue={contact.secretariatTelephone ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Téléphone standard rectorat</label>
                  <input
                    className="input"
                    name="standardTelephone"
                    defaultValue={contact.standardTelephone ?? ""}
                  />
                </div>
                <div>
                  <label className="label">Adresse standard rectorat</label>
                  <input
                    className="input"
                    name="standardAdresse"
                    defaultValue={contact.standardAdresse ?? ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn btn-primary text-xs">
                    Enregistrer la vérification
                  </button>
                </div>
              </form>
            </div>
          );
        })}
        {contacts.length === 0 && (
          <p className="text-slate-500">
            Aucune fiche de contact rectorat en base — exécutez le seed initial.
          </p>
        )}
      </div>
    </div>
  );
}
