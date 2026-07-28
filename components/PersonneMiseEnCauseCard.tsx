import type { PersonneMiseEnCause } from "@prisma/client";

export default function PersonneMiseEnCauseCard({
  personnes,
}: {
  personnes: PersonneMiseEnCause[];
}) {
  if (personnes.length === 0) return null;

  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-2">
      <p className="font-medium text-slate-700">
        {personnes.length > 1 ? "Personnes mises en cause" : "Personne mise en cause"}
      </p>
      {personnes.map((personne) => (
        <div key={personne.id} className={personnes.length > 1 ? "border-t border-slate-200 pt-2 first:border-0 first:pt-0" : undefined}>
          {personne.nom && <p className="text-slate-600">Nom : {personne.nom}</p>}
          {personne.fonction && <p className="text-slate-600">Fonction : {personne.fonction}</p>}
          {personne.recurrent && (
            <p className="font-medium text-amber-700">Faits présentés comme récurrents</p>
          )}
        </div>
      ))}
    </div>
  );
}
