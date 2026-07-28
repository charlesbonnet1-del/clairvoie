export default function DateFaitsLigne({
  ticket,
}: {
  ticket: { dateFaits: Date | null; horaireFaits: string | null };
}) {
  if (!ticket.dateFaits && !ticket.horaireFaits) return null;

  return (
    <p className="text-xs text-slate-500">
      Faits situés
      {ticket.dateFaits ? ` le ${ticket.dateFaits.toLocaleDateString("fr-FR")}` : ""}
      {ticket.horaireFaits ? ` · ${ticket.horaireFaits}` : ""}
    </p>
  );
}
