"use client";

import { useState, useEffect, useCallback } from "react";
import { Repeat, Plus, Trash2, Loader2, Lock, Clock } from "lucide-react";

interface RecurringItem {
  id: string;
  message: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  active: boolean;
  lastSentAt: string | null;
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function frequencyLabel(item: RecurringItem): string {
  const h = `${item.hour}h`;
  if (item.frequency === "daily") return `Chaque jour à ${h}`;
  if (item.frequency === "weekly") return `Chaque ${WEEKDAYS[item.dayOfWeek ?? 1].toLowerCase()} à ${h}`;
  return `Le ${item.dayOfMonth ?? 1} de chaque mois à ${h}`;
}

export default function RecurringNotifications() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [planAllowed, setPlanAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Formulaire
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(10);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      // Vérifier d'abord le plan
      const planRes = await fetch("/api/plan-features");
      if (!planRes.ok) {
        setLoading(false);
        setPlanAllowed(false);
        return;
      }
      const planData = await planRes.json();
      setPlanAllowed(planData.canRecurring ?? false);

      if (planData.canRecurring) {
        // Charger les items que si éligible
        const res = await fetch("/api/notifications/recurring");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!message.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notifications/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, frequency, dayOfWeek, dayOfMonth, hour }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur."); return; }
      setMessage(""); setShowForm(false);
      await load();
    } catch { setError("Erreur réseau."); }
    finally { setSaving(false); }
  };

  const toggle = async (item: RecurringItem) => {
    setError("");
    const res = await fetch("/api/notifications/recurring", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur.");
      return;
    }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, active: !i.active } : i));
  };

  const remove = async (id: string) => {
    await fetch("/api/notifications/recurring", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const locked = !loading && !planAllowed;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
            <Repeat className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-900">Notifications automatiques</p>
            <p className="text-[12px] text-slate-500">Envois récurrents programmés — comptent dans votre quota mensuel</p>
          </div>
        </div>
        {!locked && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Nouvelle
          </button>
        )}
      </div>

      {/* Contenu (grisé si plan non éligible) */}
      <div className={locked ? "pointer-events-none select-none opacity-40" : ""}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {/* Formulaire de création */}
            {showForm && !locked && (
              <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex : Pensez à venir valider vos tampons cette semaine ! 🎁"
                  maxLength={300}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] text-slate-800 outline-none placeholder:text-slate-300 focus:border-green-300 focus:ring-2 focus:ring-green-100"
                  rows={2}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none">
                    <option value="daily">Chaque jour</option>
                    <option value="weekly">Chaque semaine</option>
                    <option value="monthly">Chaque mois</option>
                  </select>
                  {frequency === "weekly" && (
                    <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none">
                      {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  )}
                  {frequency === "monthly" && (
                    <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Le {d}</option>)}
                    </select>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none">
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => <option key={h} value={h}>{h}h00</option>)}
                    </select>
                  </div>
                  <button
                    onClick={create}
                    disabled={!message.trim() || saving}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Créer
                  </button>
                </div>
              </div>
            )}

            {/* Liste */}
            {items.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-slate-400">
                Aucune notification automatique. Créez-en une pour relancer vos clients sans y penser.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <button
                      onClick={() => toggle(item)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${item.active ? "bg-green-500" : "bg-slate-200"}`}
                      aria-label={item.active ? "Désactiver" : "Activer"}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${item.active ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13.5px] ${item.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                        {item.message}
                      </p>
                      <p className="text-[11.5px] text-slate-400">
                        {frequencyLabel(item)}
                        {item.lastSentAt && ` · Dernier envoi : ${new Date(item.lastSentAt).toLocaleDateString("fr-FR")}`}
                      </p>
                    </div>
                    <button onClick={() => remove(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="px-5 pb-3 text-[12px] text-red-500">{error}</p>}
          </>
        )}
      </div>

      {/* Overlay verrou plan */}
      {locked && (
        <div className="absolute inset-x-0 bottom-0 top-[61px] flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Lock className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Réservé aux plans Pro et Business</p>
              <p className="text-[11.5px] text-slate-500">Passez au plan supérieur pour automatiser vos relances.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
