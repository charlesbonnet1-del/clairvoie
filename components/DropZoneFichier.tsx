"use client";

import { useRef, useState, type DragEvent } from "react";

export default function DropZoneFichier({
  name,
  label,
  onFileChange,
}: {
  name: string;
  label: string;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function assignFile(file: File | null) {
    if (file && inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    setFileName(file?.name ?? null);
    onFileChange?.(file);
  }

  return (
    <div>
      <div
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          setDragActive(false);
          assignFile(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-4 text-center text-xs transition-colors ${
          dragActive ? "border-clairvoie-bleu bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <p className="text-slate-600">{label}</p>
        {fileName ? (
          <p className="mt-1 font-medium text-slate-800">{fileName}</p>
        ) : (
          <p className="mt-1 text-slate-400">Cliquez ou glissez-déposez le fichier ici</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        className="hidden"
        onChange={(e) => assignFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
