import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Clairvoie — Transparence sur les signalements",
  description:
    "Canal de signalement horodaté et infalsifiable pour la maltraitance en milieu scolaire et périscolaire, avec triangulation indépendante et tableau de bord public.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getSession();

  return (
    <html lang="fr">
      <body>
        <NavBar identity={identity ? { displayName: identity.displayName, role: identity.role } : null} />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-slate-400">
          Clairvoie — prototype MVP de démonstration. Aucune donnée réelle ne
          doit être saisie dans cet environnement.
        </footer>
      </body>
    </html>
  );
}
