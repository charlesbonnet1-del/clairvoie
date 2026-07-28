import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="card space-y-4">
        <h1 className="text-3xl font-bold text-clairvoie-bleu">
          Clairvoie
        </h1>
        <p className="text-lg text-slate-700">
          Un canal de signalement horodaté et infalsifiable pour la
          maltraitance en milieu scolaire et périscolaire, avec triangulation
          par une association tierce indépendante, escalade automatique en
          cas de silence, et un tableau de bord public agrégé et anonymisé.
        </p>
        <p className="text-sm text-slate-500">
          Clairvoie ne surveille rien et n&apos;enregistre aucun enfant.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="btn btn-primary">
            Voir le tableau de bord public
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Se connecter (démo)
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold text-clairvoie-bleu">Parents</h2>
          <p className="mt-1 text-sm text-slate-600">
            Déposez un signalement, suivez son traitement, déclarez une
            éventuelle suite judiciaire.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold text-clairvoie-bleu">Établissements</h2>
          <p className="mt-1 text-sm text-slate-600">
            Répondez aux signalements reçus avant l&apos;escalade automatique.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold text-clairvoie-bleu">Association tierce</h2>
          <p className="mt-1 text-sm text-slate-600">
            Triangulez les signalements et rendez un verdict indépendant.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold text-clairvoie-bleu">Rectorat</h2>
          <p className="mt-1 text-sm text-slate-600">
            Suivez les signalements escaladés pour silence de l&apos;établissement.
          </p>
        </div>
      </section>
    </div>
  );
}
