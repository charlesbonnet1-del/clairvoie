"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/config";
import type { CommuneSuggestion } from "@/app/api/geo/communes/route";
import type { EtablissementSuggestion } from "@/app/api/geo/etablissements/route";

const AUTRE_ETABLISSEMENT = "__autre__";

const TYPES_CONTACT_SECONDAIRE = [
  { value: "email", label: "Email" },
  { value: "telephone", label: "Téléphone" },
  { value: "adresse_postale", label: "Adresse postale" },
] as const;

export default function SignalementForm() {
  const [communeQuery, setCommuneQuery] = useState("");
  const [communeSuggestions, setCommuneSuggestions] = useState<CommuneSuggestion[]>([]);
  const [selectedCommune, setSelectedCommune] = useState<CommuneSuggestion | null>(null);
  const [loadingCommunes, setLoadingCommunes] = useState(false);

  const [etablissements, setEtablissements] = useState<EtablissementSuggestion[]>([]);
  const [loadingEtablissements, setLoadingEtablissements] = useState(false);
  const [etablissementChoice, setEtablissementChoice] = useState("");
  const [etablissementManuelNom, setEtablissementManuelNom] = useState("");

  const [contactSecondaireOuvert, setContactSecondaireOuvert] = useState(false);
  const [contactSecondaireType, setContactSecondaireType] = useState<string>("email");
  const [contactSecondaireValeur, setContactSecondaireValeur] = useState("");
  const [contactSecondairePorteur, setContactSecondairePorteur] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedCommune && communeQuery === selectedCommune.nom) {
      setCommuneSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (communeQuery.trim().length < 2) {
      setCommuneSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingCommunes(true);
      try {
        const res = await fetch(`/api/geo/communes?q=${encodeURIComponent(communeQuery.trim())}`);
        const data = await res.json();
        setCommuneSuggestions(data.communes ?? []);
      } catch {
        setCommuneSuggestions([]);
      } finally {
        setLoadingCommunes(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communeQuery]);

  async function choisirCommune(commune: CommuneSuggestion) {
    setSelectedCommune(commune);
    setCommuneQuery(commune.nom);
    setCommuneSuggestions([]);
    setEtablissementChoice("");
    setEtablissements([]);
    setLoadingEtablissements(true);
    try {
      const res = await fetch(`/api/geo/etablissements?codeCommune=${commune.codeInsee}`);
      const data = await res.json();
      setEtablissements(data.etablissements ?? []);
    } catch {
      setEtablissements([]);
    } finally {
      setLoadingEtablissements(false);
    }
  }

  function changerCommuneManuel(value: string) {
    setCommuneQuery(value);
    if (selectedCommune && value !== selectedCommune.nom) {
      setSelectedCommune(null);
      setEtablissements([]);
      setEtablissementChoice("");
    }
  }

  const etablissementSelectionne =
    etablissementChoice && etablissementChoice !== AUTRE_ETABLISSEMENT
      ? etablissements.find((e) => e.uai === etablissementChoice) ?? null
      : null;

  const formValide =
    Boolean(selectedCommune) &&
    Boolean(etablissementChoice) &&
    (etablissementChoice !== AUTRE_ETABLISSEMENT || etablissementManuelNom.trim().length > 0);

  return (
    <form action="/api/signalement" method="post" className="card mt-6 space-y-4">
      <input type="hidden" name="communeCodeInsee" value={selectedCommune?.codeInsee ?? ""} />
      <input type="hidden" name="communeNom" value={selectedCommune?.nom ?? ""} />
      <input type="hidden" name="communeEpci" value={selectedCommune?.epci ?? ""} />
      <input type="hidden" name="communeDepartement" value={selectedCommune?.departement ?? ""} />
      <input
        type="hidden"
        name="etablissementUai"
        value={etablissementChoice === AUTRE_ETABLISSEMENT ? "" : etablissementSelectionne?.uai ?? ""}
      />
      <input
        type="hidden"
        name="etablissementNom"
        value={
          etablissementChoice === AUTRE_ETABLISSEMENT
            ? etablissementManuelNom
            : etablissementSelectionne?.nom ?? ""
        }
      />
      <input
        type="hidden"
        name="etablissementAdresse"
        value={etablissementChoice === AUTRE_ETABLISSEMENT ? "" : etablissementSelectionne?.adresse ?? ""}
      />
      <input
        type="hidden"
        name="contactSecondaireType"
        value={contactSecondaireOuvert ? contactSecondaireType : ""}
      />
      <input
        type="hidden"
        name="contactSecondaireValeur"
        value={contactSecondaireOuvert ? contactSecondaireValeur : ""}
      />
      <input
        type="hidden"
        name="contactSecondairePorteur"
        value={contactSecondaireOuvert ? contactSecondairePorteur : ""}
      />

      <div className="relative">
        <label className="label" htmlFor="commune">
          Commune
        </label>
        <input
          className="input"
          id="commune"
          autoComplete="off"
          placeholder="Tapez le nom de la commune…"
          value={communeQuery}
          onChange={(e) => changerCommuneManuel(e.target.value)}
          required
        />
        {loadingCommunes && <p className="mt-1 text-xs text-slate-400">Recherche…</p>}
        {communeSuggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
            {communeSuggestions.map((c) => (
              <li key={c.codeInsee}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => choisirCommune(c)}
                >
                  {c.nom} <span className="text-xs text-slate-400">— {c.departement}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedCommune && (
          <p className="mt-1 text-xs text-emerald-700">
            {selectedCommune.nom} · {selectedCommune.epci} · {selectedCommune.departement}
          </p>
        )}
      </div>

      {selectedCommune && (
        <div>
          <label className="label" htmlFor="etablissementChoice">
            Établissement concerné
          </label>
          {loadingEtablissements ? (
            <p className="text-xs text-slate-400">Recherche des établissements…</p>
          ) : (
            <select
              className="input"
              id="etablissementChoice"
              value={etablissementChoice}
              onChange={(e) => setEtablissementChoice(e.target.value)}
              required
            >
              <option value="">Sélectionner un établissement…</option>
              {etablissements.map((e) => (
                <option key={e.uai} value={e.uai}>
                  {e.nom} ({e.type})
                </option>
              ))}
              <option value={AUTRE_ETABLISSEMENT}>
                Autre / structure périscolaire non listée…
              </option>
            </select>
          )}
          {etablissements.length === 0 && !loadingEtablissements && (
            <p className="mt-1 text-xs text-slate-400">
              Aucun établissement de l&apos;Éducation nationale trouvé pour cette commune —
              utilisez &laquo;&nbsp;Autre&nbsp;&raquo; si besoin.
            </p>
          )}
          {etablissementChoice === AUTRE_ETABLISSEMENT && (
            <input
              className="input mt-2"
              placeholder="Nom de l'établissement ou de la structure périscolaire"
              value={etablissementManuelNom}
              onChange={(e) => setEtablissementManuelNom(e.target.value)}
              required
            />
          )}
        </div>
      )}

      {etablissementChoice && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3">
          {!contactSecondaireOuvert ? (
            <button
              type="button"
              className="text-xs text-clairvoie-bleuclair underline"
              onClick={() => setContactSecondaireOuvert(true)}
            >
              Vous connaissez un autre moyen de contacter cet établissement ? (optionnel)
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">
                  Moyen de contact secondaire (optionnel)
                </p>
                <button
                  type="button"
                  className="text-xs text-slate-400 underline"
                  onClick={() => {
                    setContactSecondaireOuvert(false);
                    setContactSecondaireValeur("");
                    setContactSecondairePorteur("");
                  }}
                >
                  Annuler
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Cette information vient en complément des coordonnées officielles — elle ne
                sera considérée fiable qu&apos;une fois qu&apos;un contact réel aura réellement
                abouti.
              </p>
              <select
                className="input"
                value={contactSecondaireType}
                onChange={(e) => setContactSecondaireType(e.target.value)}
              >
                {TYPES_CONTACT_SECONDAIRE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder={
                  contactSecondaireType === "email"
                    ? "adresse@exemple.fr"
                    : contactSecondaireType === "telephone"
                      ? "Numéro de téléphone"
                      : "Adresse postale"
                }
                value={contactSecondaireValeur}
                onChange={(e) => setContactSecondaireValeur(e.target.value)}
              />
              {contactSecondaireType === "telephone" && (
                <input
                  className="input"
                  placeholder="Qui détient ce numéro ? (ex. Directeur, Secrétariat)"
                  value={contactSecondairePorteur}
                  onChange={(e) => setContactSecondairePorteur(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="categorie">
          Catégorie
        </label>
        <select className="input" id="categorie" name="categorie" required defaultValue="">
          <option value="">Sélectionner une catégorie…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="contenu">
          Description des faits
        </label>
        <textarea
          className="input"
          id="contenu"
          name="contenu"
          rows={6}
          required
          placeholder="Décrivez les faits observés, avec autant de précision que possible…"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={!formValide}>
        Déposer le signalement
      </button>
    </form>
  );
}
