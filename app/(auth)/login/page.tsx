import { prisma } from "@/lib/prisma";

const ROLE_LABELS: Record<string, string> = {
  PARENT: "Parent",
  ETABLISSEMENT: "Établissement",
  ASSOCIATION_TIERCE: "Association tierce",
  RECTORAT: "Rectorat",
  ADMIN: "Admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const demoAccounts = await prisma.identity.findMany({
    orderBy: { role: "asc" },
    select: { email: true, role: true, displayName: true },
  });

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div className="card space-y-4">
        <h1 className="text-xl font-semibold text-clairvoie-bleu">
          Connexion — démo
        </h1>
        <p className="text-sm text-slate-500">
          Écran de connexion fictif. En production, Clairvoie s&apos;appuierait
          sur FranceConnect / EduConnect ; ici, il ne s&apos;agit que d&apos;une
          simulation de choix de fournisseur d&apos;identité, sans aucun appel
          réel.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <a href="#email-form" className="btn btn-secondary">
            FranceConnect (démo)
          </a>
          <a href="#email-form" className="btn btn-secondary">
            EduConnect (démo)
          </a>
          <a href="#email-form" className="btn btn-secondary">
            Compte Clairvoie (démo)
          </a>
        </div>
      </div>

      <div id="email-form" className="card space-y-4">
        <h2 className="font-semibold text-slate-800">Identifiants de démo</h2>
        {searchParams.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Identifiants invalides. Réessayez.
          </p>
        )}
        <form action="/api/auth/login" method="post" className="space-y-3">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input className="input" type="email" id="email" name="email" required />
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
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Se connecter
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold text-slate-800">Comptes disponibles</h2>
        <p className="mt-1 text-xs text-slate-500">
          Mot de passe pour tous les comptes de démo : <code>demo1234</code>
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {demoAccounts.map((account) => (
              <tr key={account.email} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 font-medium text-slate-700">
                  {ROLE_LABELS[account.role] ?? account.role}
                </td>
                <td className="py-1.5 text-slate-500">{account.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
