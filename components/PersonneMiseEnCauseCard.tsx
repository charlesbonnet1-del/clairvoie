import type { PersonneMiseEnCause } from "@prisma/client";

export default function PersonneMiseEnCauseCard({
  personne,
}: {
  personne: PersonneMiseEnCause;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-700">Personne mise en cause</p>
      {personne.nom && <p className="text-slate-600">Nom : {personne.nom}</p>}
      {personne.fonction && <p className="text-slate-600">Fonction : {personne.fonction}</p>}
      {personne.dateFaits && (
        <p className="text-slate-600">
          Date des faits : {personne.dateFaits.toLocaleDateString("fr-FR")}
        </p>
      )}
      {personne.horaireFaits && (
        <p className="text-slate-600">Horaire des faits : {personne.horaireFaits}</p>
      )}
      {personne.recurrent && (
        <p className="font-medium text-amber-700">Faits présentés comme récurrents</p>
      )}
    </div>
  );
}
