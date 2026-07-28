import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GRAVITES } from "@/config";

const CATEGORIES = [
  "Violence physique",
  "Violence verbale ou psychologique",
  "Harcèlement entre élèves",
  "Négligence de surveillance",
  "Autre",
];

export default async function NouveauSignalementPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "PARENT") {
    redirect("/login");
  }

  const etablissements = await prisma.etablissement.findMany({
    include: { commune: true },
    orderBy: { nom: "asc" },
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-clairvoie-bleu">Nouveau signalement</h1>
      <p className="mt-2 text-sm text-slate-500">
        Ce formulaire crée une entrée horodatée et infalsifiable. Vous pourrez
        suivre son traitement depuis votre espace parent.
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Veuillez compléter tous les champs requis.
        </p>
      )}

      <form action="/api/signalement" method="post" className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="etablissementId">
            Établissement concerné
          </label>
          <select className="input" id="etablissementId" name="etablissementId" required>
            <option value="">Sélectionner un établissement…</option>
            {etablissements.map((etab) => (
              <option key={etab.id} value={etab.id}>
                {etab.nom} — {etab.commune.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="categorie">
            Catégorie
          </label>
          <select className="input" id="categorie" name="categorie" required>
            <option value="">Sélectionner une catégorie…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="gravite">
            Gravité perçue
          </label>
          <select className="input" id="gravite" name="gravite" required>
            <option value="">Sélectionner…</option>
            {GRAVITES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="contenu">
            Description des faits
          </label>
          <textarea
            className="input"
            id="contenu"
            name="contenu"
            rows={6}
            required
            placeholder="Décrivez les faits observés, avec autant de précision que possible…"
          />
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Déposer le signalement
        </button>
      </form>
    </div>
  );
}
