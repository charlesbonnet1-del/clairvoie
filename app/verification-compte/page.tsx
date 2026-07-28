import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function VerificationComptePage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const identity = await getSession();
  if (!identity || identity.role !== "PARENT") {
    redirect("/login");
  }
  if (identity.emailVerifie && identity.telephoneVerifie) {
    redirect("/parent");
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold text-clairvoie-bleu">
          Vérifiez votre email et votre téléphone
        </h1>
        <p className="text-sm text-slate-500">
          Un signalement ne peut être déposé qu&apos;une fois les deux
          coordonnées vérifiées — c&apos;est ce qui garantit à
          l&apos;association tierce de pouvoir vous recontacter si besoin.
        </p>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Démo — aucun email ni SMS n&apos;est réellement envoyé. Les codes
          sont affichés ci-dessous, comme s&apos;ils venaient d&apos;être reçus.
        </p>
      </div>

      {searchParams.error?.startsWith("code_invalide") && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Code incorrect. Réessayez.
        </p>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Email — {identity.email}</h2>
          {identity.emailVerifie && <span className="badge bg-emerald-100 text-emerald-700">Vérifié</span>}
        </div>
        {!identity.emailVerifie && (
          <>
            <p className="text-xs text-slate-400">
              Code de démonstration : <code className="font-mono">{identity.codeVerificationEmail}</code>
            </p>
            <form action="/api/auth/verification-compte" method="post" className="flex gap-2">
              <input type="hidden" name="canal" value="email" />
              <input className="input" name="code" placeholder="Code à 6 chiffres" required />
              <button type="submit" className="btn btn-primary whitespace-nowrap">
                Vérifier
              </button>
            </form>
          </>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Téléphone — {identity.telephone}</h2>
          {identity.telephoneVerifie && (
            <span className="badge bg-emerald-100 text-emerald-700">Vérifié</span>
          )}
        </div>
        {!identity.telephoneVerifie && (
          <>
            <p className="text-xs text-slate-400">
              Code de démonstration :{" "}
              <code className="font-mono">{identity.codeVerificationTelephone}</code>
            </p>
            <form action="/api/auth/verification-compte" method="post" className="flex gap-2">
              <input type="hidden" name="canal" value="telephone" />
              <input className="input" name="code" placeholder="Code à 6 chiffres" required />
              <button type="submit" className="btn btn-primary whitespace-nowrap">
                Vérifier
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
