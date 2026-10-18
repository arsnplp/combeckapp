"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Check, Apple, Info } from "lucide-react";

interface GeofencingState {
  enabled: boolean;
  message: string;
  label: string | null;
  latitude: number | null;
  address: string;
  city: string;
}

const VARIABLES: Array<[string, string]> = [
  ["{prenom}", "le prénom du client"],
  ["{commerce}", "le nom de votre commerce"],
  ["{tampons_restants}", "tampons avant sa récompense"],
  ["{tampons}", "ses tampons actuels"],
  ["{points}", "ses points actuels"],
];

/**
 * Notification de proximité. Volontairement limitée à Apple Wallet, et le
 * dit : Google a déprécié le champ équivalent, et son remplaçant n'autorise
 * ni texte personnalisé ni rayon choisi. Laisser croire que les clients
 * Android la recevront serait une promesse intenable au comptoir.
 */
export default function ProximitySection() {
  const [state, setState] = useState<GeofencingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/geofencing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState(d))
      .catch(() => {});
  }, []);

  const send = async (patch: { enabled?: boolean; message?: string }) => {
    if (!state || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/geofencing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: state.message, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Enregistrement impossible."); setSaving(false); return; }
      setState((s) => (s ? { ...s, enabled: data.enabled, message: data.message, label: data.label, latitude: data.latitude } : s));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erreur réseau.");
    }
    setSaving(false);
  };

  // L'en-tête est rendu tout de suite, même avant la réponse du serveur :
  // un bloc qui apparaît une seconde après le reste de la page donne
  // l'impression que quelque chose a sauté.
  const entete = (actif: boolean) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin className="h-4 w-4 flex-shrink-0 text-green-600" />
        <h3 className="text-[15px] font-bold text-slate-900">Notification de proximité</h3>
        <span className="flex-shrink-0 rounded-full bg-red-500 px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wide text-white">
          Nouveau
        </span>
        {/* Étiquette raccourcie : « — pas sur Android » la faisait passer
            sur deux lignes dès qu'on réduisait la fenêtre. La précision
            reste dans la description, visible une fois la fonction active. */}
        <span className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">
          <Apple className="h-3 w-3" />
          Apple Wallet
        </span>
      </div>
      {/* Éteinte, la fonction tient en une ligne : inutile d'occuper un
          quart de l'écran pour expliquer quelque chose qui ne tourne pas. */}
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        {actif
          ? "Quand un client passe devant votre commerce, sa carte remonte sur son écran verrouillé avec votre message. Sur iPhone uniquement : Android ne permet pas de texte personnalisé."
          : "Faites remonter votre carte sur l'écran verrouillé des clients qui passent devant."}
      </p>
    </div>
  );

  if (!state) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          {entete(false)}
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-slate-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        {entete(state.enabled)}

        <button
          onClick={() => send({ enabled: !state.enabled })}
          disabled={saving}
          role="switch"
          aria-checked={state.enabled}
          aria-label="Activer la notification de proximité"
          className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            state.enabled ? "bg-green-600" : "bg-slate-300"
          }`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            state.enabled ? "left-6" : "left-1"
          }`} />
        </button>
      </div>

      {!state.enabled ? (
        !state.address.trim() && (
          <p className="mt-3 text-[12px] text-amber-700">
            Renseignez l&apos;adresse de votre commerce dans Paramètres pour pouvoir l&apos;activer.
          </p>
        )
      ) : (
        <>
      {!state.address.trim() && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
            Renseignez l&apos;adresse de votre commerce ci-dessus pour pouvoir l&apos;activer.
          </p>
        )}

        {state.enabled && state.label && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-[12.5px] text-green-800">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Déclenchement à une centaine de mètres de <strong>{state.label}</strong>.</span>
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">{error}</p>
        )}

        <div className="mt-4">
          <label className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
            Message affiché
          </label>
          <input
            value={state.message}
            onChange={(e) => setState({ ...state, message: e.target.value.slice(0, 120) })}
            onBlur={() => state.enabled && send({})}
            placeholder="Votre carte de fidélité {commerce}"
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 outline-none focus:border-green-500"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {VARIABLES.map(([v, desc]) => (
              <button
                key={v}
                type="button"
                title={desc}
                onClick={() => setState({ ...state, message: `${state.message} ${v}`.trim().slice(0, 120) })}
                className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11.5px] text-slate-600 transition-colors hover:bg-slate-200"
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[12px] text-slate-400">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
            Le message se met à jour à chaque tampon. Gardez-le court : l&apos;écran
            verrouillé coupe au-delà d&apos;une ligne.
          </p>
        </div>
        </>
      )}

      {saving && <p className="mt-3 text-[12px] text-slate-400">Enregistrement…</p>}
      {saved && !saving && <p className="mt-3 text-[12px] text-green-600">Enregistré — vos clients recevront la mise à jour.</p>}
    </div>
  );
}
