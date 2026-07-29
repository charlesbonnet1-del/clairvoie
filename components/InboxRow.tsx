import Link from "next/link";
import { STATUT_TICKET_LABELS } from "@/lib/labels";

export default function InboxRow({
  href,
  categorie,
  date,
  souscription,
  statut,
}: {
  href: string;
  categorie: string;
  date: Date;
  souscription?: string;
  statut: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{categorie}</p>
        {souscription && <p className="truncate text-xs text-slate-500">{souscription}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`badge badge-${statut}`}>{STATUT_TICKET_LABELS[statut] ?? statut}</span>
        <span className="w-20 text-right text-xs text-slate-400">
          {date.toLocaleDateString("fr-FR")}
        </span>
      </div>
    </Link>
  );
}
