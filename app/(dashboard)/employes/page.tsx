"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, Trash2, Loader2, KeyRound, Stamp, Star, Gift,
  AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/utils";

interface EmployeeRow {
  employeeId: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  lastAccessAt: string | null;
  stats: { stampsGiven: number; pointsGiven: number; rewardsValidated: number; actions: number; lastActionAt: string | null };
}

export default function EmployesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [maxEmployees, setMaxEmployees] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const d = await res.json();
        setRows(d.employees ?? []);
        setMaxEmployees(d.maxEmployees);
      }
    } catch { /* réseau */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const atLimit = maxEmployees !== null && rows.length >= maxEmployees;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add"); setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error ?? "Erreur."); setBusy(""); return; }
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
      await load();
    } catch { setError("Erreur réseau."); }
    setBusy("");
  };

  const remove = async (id: string) => {
    setBusy(id);
    await fetch(`/api/employees/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
    setBusy("");
  };

  const changePw = async (id: string) => {
    if (newPw.length < 4) { setError("Mot de passe trop court (4 caractères min.)."); return; }
    setBusy(id); setError("");
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPw }),
    }).catch(() => null);
    if (res && !res.ok) setError("Impossible de changer le mot de passe.");
    setPwFor(null); setNewPw(""); setBusy("");
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">Employés</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Donnez à votre équipe l&apos;accès au scan, sans donner accès à vos réglages.
          </p>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setError(""); }} disabled={atLimit}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Ajouter un employé
          </button>
        )}
      </div>

      {/* Limite du plan */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12.5px] ${
        atLimit ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500"
      }`}>
        {atLimit ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Users className="h-3.5 w-3.5 shrink-0" />}
        {maxEmployees === null
          ? `${rows.length} employé${rows.length > 1 ? "s" : ""} · illimité avec votre plan`
          : `${rows.length}/${maxEmployees} employé${maxEmployees > 1 ? "s" : ""} utilisé${rows.length > 1 ? "s" : ""}`}
        {atLimit && <span className="ml-1">— passez à un plan supérieur pour en ajouter.</span>}
      </div>

      {/* Formulaire d'ajout */}
      {adding && (
        <Card>
          <CardHeader><CardTitle className="text-[14px]">Nouvel employé</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={add} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Prénom & Nom"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-[13.5px] outline-none focus:border-green-400" />
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@employe.fr"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-[13.5px] outline-none focus:border-green-400" />
                <input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mot de passe d'accès"
                  className="h-11 rounded-xl border border-slate-200 px-3 text-[13.5px] outline-none focus:border-green-400" />
              </div>
              <p className="text-[11.5px] text-slate-400">
                Communiquez ce mot de passe à votre employé. Il lui servira à entrer
                dans votre commerce depuis son espace — vous pourrez le changer à tout moment.
              </p>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy === "add"}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                  {busy === "add" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ajouter
                </button>
                <button type="button" onClick={() => { setAdding(false); setError(""); }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] text-slate-600">Annuler</button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste + stats */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Users className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-[14px] font-semibold text-slate-700">Aucun employé</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-slate-400">
            Ajoutez votre équipe pour qu&apos;elle puisse scanner sans accéder à vos
            réglages, votre abonnement ni l&apos;export de vos clients.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.employeeId} className="rounded-xl border border-black/[0.06] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[13px] font-bold text-white">
                    {(r.name || r.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{r.name || r.email}</p>
                    <p className="truncate text-[12px] text-slate-400">{r.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                    r.lastAccessAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {r.lastAccessAt ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                    {r.lastAccessAt ? "Actif" : "En attente"}
                  </span>
                  <button onClick={() => { setPwFor(pwFor === r.employeeId ? null : r.employeeId); setNewPw(""); setError(""); }}
                    title="Changer le mot de passe d'accès"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(r.employeeId)} disabled={busy === r.employeeId}
                    title="Retirer cet employé"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    {busy === r.employeeId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Vue rapide des stats (30 derniers jours) */}
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {([
                  [Stamp, r.stats.stampsGiven, "tampons", "#2563eb"],
                  [Star, r.stats.pointsGiven, "points", "#0891b2"],
                  [Gift, r.stats.rewardsValidated, "récompenses", "#7c3aed"],
                ] as const).map(([Icon, value, label, color], i) => (
                  <div key={i} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                    <p className="mt-1 text-[17px] font-bold leading-none text-slate-900">{value}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                30 derniers jours
                {r.stats.lastActionAt && ` · dernière action ${formatTimeAgo(r.stats.lastActionAt).toLowerCase()}`}
              </p>

              {/* Changement du mot de passe d'accès */}
              {pwFor === r.employeeId && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
                  <input value={newPw} onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Nouveau mot de passe d'accès"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-[13px] outline-none focus:border-green-400" />
                  <button onClick={() => changePw(r.employeeId)} disabled={busy === r.employeeId}
                    className="rounded-lg bg-slate-900 px-4 text-[12.5px] font-semibold text-white disabled:opacity-50">
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[12.5px] font-semibold text-slate-700">Lien à communiquer à votre équipe</p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Vos employés se connectent sur <span className="font-mono text-slate-800">app.getcomeback.fr/employe</span>
        </p>
      </div>
    </div>
  );
}
