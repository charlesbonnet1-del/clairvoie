"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/config";
import type { CommuneSuggestion } from "@/app/api/geo/communes/route";
import type { EtablissementSuggestion } from "@/app/api/geo/etablissements/route";
import type { ContactOfficielAffiche } from "@/app/api/geo/etablissements/[uai]/contacts/route";

const AUTRE_ETABLISSEMENT = "__autre__";

const TYPES_CONTACT_SECONDAIRE = [
  { value: "email", label: "Email" },
  { value: "telephone", label: "Téléphone" },
  { value: "adresse_postale", label: "Adresse postale" },
] as const;

const LABEL_TYPE_CONTACT: Record<string, string> = {
  email: "Email",
  telephone: "Téléphone",
  courrier_recommande_electronique: "Recommandé électronique",
  adresse_postale: "Adresse postale",
};

interface ContactSecondaire {
  id: string;
  type: string;
  valeur: string;
  porteur: string;
}

let prochainId = 0;
function nouveauContactSecondaire(): ContactSecondaire {
  prochainId += 1;
  return { id: `contact-${prochainId}`, type: "email", valeur: "", porteur: "" };
}

export default function SignalementForm() {
  const [communeQuery, setCommuneQuery] = useState("");
  const [communeSuggestions, setCommuneSuggestions] = useState<CommuneSuggestion[]>([]);
  const [selectedCommune, setSelectedCommune] = useState<CommuneSuggestion | null>(null);
  const [loadingCommunes, setLoadingCommunes] = useState(false);

  const [etablissements, setEtablissements] = useState<EtablissementSuggestion[]>([]);
  const [loadingEtablissements, setLoadingEtablissements] = useState(false);
  const [etablissementChoice, setEtablissementChoice] = useState("");
  const [etablissementManuelNom, setEtablissementManuelNom] = useState("");

  const [contactsOfficiels, setContactsOfficiels] = useState<ContactOfficielAffiche[]>([]);
  const [loadingContactsOfficiels, setLoadingContactsOfficiels] = useState(false);

  const [contactsSecondaires, setContactsSecondaires] = useState<ContactSecondaire[]>([]);

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
    setContactsOfficiels([]);
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

  async function choisirEtablissement(uai: string) {
    setEtablissementChoice(uai);
    setContactsOfficiels([]);
    if (!uai || uai === AUTRE_ETABLISSEMENT) return;

    setLoadingContactsOfficiels(true);
    try {
      const res = await fetch(`/api/geo/etablissements/${uai}/contacts`);
      const data = await res.json();
      setContactsOfficiels(data.contacts ?? []);
    } catch {
      setContactsOfficiels([]);
    } finally {
      setLoadingContactsOfficiels(false);
    }
  }

  function changerCommuneManuel(value: string) {
    setCommuneQuery(value);
    if (selectedCommune && value !== selectedCommune.nom) {
      setSelectedCommune(null);
      setEtablissements([]);
      setEtablissementChoice("");
      setContactsOfficiels([]);
    }
  }

  function ajouterContactSecondaire() {
    setContactsSecondaires((liste) => [...liste, nouveauContactSecondaire()]);
  }
  function retirerContactSecondaire(id: string) {
    setContactsSecondaires((liste) => liste.filter((c) => c.id !== id));
  }
  function modifierContactSecondaire(id: string, champ: keyof ContactSecondaire, valeur: string) {
    setContactsSecondaires((liste) =>
      liste.map((c) => (c.id === id ? { ...c, [champ]: valeur } : c))
    );
  }

  const etablissementSelectionne =
    etablissementChoice && etablissementChoice !== AUTRE_ETABLISSEMENT
      ? etablissements.find((e) => e.uai === etablissementChoice) ?? null
      : null;

  const formValide =
    Boolean(selectedCommune) &&
    Boolean(etablissementChoice) &&
    (etablissementChoice !== AUTRE_ETABLISSEMENT || etablissementManuelNom.trim().length > 0);

  const contactsSecondairesJson = JSON.stringify(
    contactsSecondaires
      .filter((c) => c.valeur.trim())
      .map((c) => ({ type: c.type, valeur: c.valeur.trim(), porteur: c.porteur.trim() }))
  );

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
      <input type="hidden" name="contactsSecondairesJson" value={contactsSecondairesJson} />

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
              onChange={(e) => choisirEtablissement(e.target.value)}
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

          {loadingContactsOfficiels && (
            <p className="mt-2 text-xs text-slate-400">Vérification des coordonnées connues…</p>
          )}
          {!loadingContactsOfficiels && contactsOfficiels.length > 0 && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2">
              <p className="text-xs font-medium text-slate-600">
                Coordonnée officielle connue pour cet établissement :
              </p>
              <ul className="mt-1 space-y-0.5">
                {contactsOfficiels.map((c, i) => (
                  <li key={i} className="text-xs text-slate-600">
                    {LABEL_TYPE_CONTACT[c.type] ?? c.type} : {c.valeur}{" "}
                    <span
                      className={
                        c.statutVerification === "verifie"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }
                    >
                      ({c.statutVerification === "verifie" ? "vérifiée" : "non vérifiée"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loadingContactsOfficiels &&
            contactsOfficiels.length === 0 &&
            etablissementChoice &&
            etablissementChoice !== AUTRE_ETABLISSEMENT && (
              <p className="mt-2 text-xs text-slate-400">
                Aucune coordonnée officielle connue pour cet établissement pour le moment.
              </p>
            )}
        </div>
      )}

      {etablissementChoice && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">
              Autres moyens de contact que vous connaissez (optionnel)
            </p>
            <button
              type="button"
              className="text-xs text-clairvoie-bleuclair underline"
              onClick={ajouterContactSecondaire}
            >
              + Ajouter un contact
            </button>
          </div>
          {contactsSecondaires.length === 0 && (
            <p className="text-xs text-slate-400">
              Ces informations viennent en complément des coordonnées officielles — elles ne
              seront considérées fiables qu&apos;une fois qu&apos;un contact réel aura réellement
              abouti.
            </p>
          )}
          {contactsSecondaires.map((contact) => (
            <div key={contact.id} className="space-y-2 rounded-lg bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <select
                  className="input w-auto text-xs"
                  value={contact.type}
                  onChange={(e) => modifierContactSecondaire(contact.id, "type", e.target.value)}
                >
                  {TYPES_CONTACT_SECONDAIRE.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs text-slate-400 underline"
                  onClick={() => retirerContactSecondaire(contact.id)}
                >
                  Retirer
                </button>
              </div>
              <input
                className="input"
                placeholder={
                  contact.type === "email"
                    ? "adresse@exemple.fr"
                    : contact.type === "telephone"
                      ? "Numéro de téléphone"
                      : "Adresse postale"
                }
                value={contact.valeur}
                onChange={(e) => modifierContactSecondaire(contact.id, "valeur", e.target.value)}
              />
              {contact.type === "telephone" && (
                <input
                  className="input"
                  placeholder="Qui détient ce numéro ? (ex. Directeur, Secrétariat)"
                  value={contact.porteur}
                  onChange={(e) =>
                    modifierContactSecondaire(contact.id, "porteur", e.target.value)
                  }
                />
              )}
            </div>
          ))}
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
