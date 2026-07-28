import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SignalementForm from "@/components/SignalementForm";

export default async function NouveauSignalementPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "PARENT") {
    redirect("/login");
  }
  if (!identity.emailVerifie || !identity.telephoneVerifie) {
    redirect("/verification-compte");
  }

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

      <SignalementForm />
    </div>
  );
}
