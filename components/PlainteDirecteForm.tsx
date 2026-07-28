"use client";

import { useState } from "react";
import DropZoneFichier from "./DropZoneFichier";

export default function PlainteDirecteForm({ ticketId }: { ticketId: string }) {
  const [fichier, setFichier] = useState<File | null>(null);

  return (
    <form
      action={`/api/signalement/${ticketId}/plainte-directe`}
      method="post"
      encType="multipart/form-data"
      className="space-y-2"
    >
      <p className="text-xs text-slate-600">
        J&apos;ai déposé plainte directement auprès de la police/gendarmerie —
        joignez le récépissé de dépôt de plainte pour l&apos;enregistrer
        (obligatoire, jamais transmis à l&apos;établissement) :
      </p>
      <DropZoneFichier
        name="recepisse"
        label="Récépissé de dépôt de plainte"
        onFileChange={setFichier}
      />
      <button type="submit" className="btn btn-secondary text-xs" disabled={!fichier}>
        Enregistrer la plainte
      </button>
    </form>
  );
}
