import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  PARENT: "Parent",
  ETABLISSEMENT: "Établissement",
  ASSOCIATION_TIERCE: "Association tierce",
  RECTORAT: "Rectorat",
  ADMIN: "Admin",
};

const ROLE_HOME: Record<string, string> = {
  PARENT: "/parent",
  ETABLISSEMENT: "/etablissement",
  ASSOCIATION_TIERCE: "/association",
  RECTORAT: "/rectorat",
  ADMIN: "/dashboard",
};

export default function NavBar({
  identity,
}: {
  identity: { displayName: string; role: string } | null;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-clairvoie-bleu">
          Clairvoie
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-slate-600 hover:text-clairvoie-bleu">
            Tableau de bord public
          </Link>
          {identity ? (
            <>
              <Link
                href={ROLE_HOME[identity.role] ?? "/"}
                className="text-slate-600 hover:text-clairvoie-bleu"
              >
                {identity.displayName} · {ROLE_LABELS[identity.role] ?? identity.role}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="btn btn-secondary">
                  Se déconnecter
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
