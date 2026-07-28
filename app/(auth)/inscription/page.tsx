export default function InscriptionPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4">
        <h1 className="text-xl font-semibold text-clairvoie-bleu">
          Créer un compte parent
        </h1>
        <p className="text-sm text-slate-500">
          L&apos;email et le téléphone renseignés devront tous les deux être
          vérifiés avant de pouvoir déposer un signalement — c&apos;est ce qui
          permet à l&apos;association tierce de vous recontacter si besoin.
        </p>

        {searchParams.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {decodeURIComponent(searchParams.error)}
          </p>
        )}

        <form action="/api/auth/inscription" method="post" className="space-y-3">
          <div>
            <label className="label" htmlFor="displayName">
              Nom affiché
            </label>
            <input className="input" id="displayName" name="displayName" required />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" type="email" id="email" name="email" required />
          </div>
          <div>
            <label className="label" htmlFor="telephone">
              Téléphone
            </label>
            <input className="input" type="tel" id="telephone" name="telephone" required />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe
            </label>
            <input
              className="input"
              type="password"
              id="password"
              name="password"
              required
              minLength={4}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Créer mon compte
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <a href="/login" className="text-clairvoie-bleuclair underline">
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
