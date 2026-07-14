"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Plus, Ticket, Power } from "lucide-react";

interface Promo {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  timesRedeemed: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
}

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");

  // Formulaire
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("10");
  const [duration, setDuration] = useState<"once" | "forever">("once");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promos");
      if (res.ok) {
        const d = await res.json();
        setPromos(d.promos ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, percentOff: Number(percentOff), duration, maxRedemptions: maxRedemptions || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d?.error ?? "Erreur."); }
      else {
        setSuccess(`Code ${d.code} créé — utilisable immédiatement sur la page de paiement.`);
        setCode(""); setMaxRedemptions("");
        await load();
      }
    } catch { setError("Erreur réseau."); }
    setCreating(false);
  };

  const toggle = async (p: Promo) => {
    setActing(p.id);
    await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", promoId: p.id, active: !p.active }),
    });
    await load();
    setActing("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Console admin
        </Link>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-amber-400">Super Admin</p>
        <h1 className="mt-1 text-[22px] font-bold text-white">Codes promo</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">
          Réductions applicables sur la page de paiement Stripe (champ « Ajouter un code promotionnel »).
        </p>
      </div>

      {/* Création */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
        <p className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-white">
          <Plus className="h-4 w-4 text-green-400" /> Créer un code
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BIENVENUE20"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 font-mono text-[13px] text-white placeholder-slate-600 outline-none focus:border-green-500/40" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Réduction (%)</label>
            <input type="number" min={1} max={100} value={percentOff} onChange={(e) => setPercentOff(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[13px] text-white outline-none focus:border-green-500/40" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">S&apos;applique</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value as "once" | "forever")}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[13px] text-white outline-none focus:border-green-500/40">
              <option value="once" className="bg-slate-900">1ère facture seulement</option>
              <option value="forever" className="bg-slate-900">Toutes les factures</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Limite d&apos;utilisations</label>
            <input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="Illimité"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[13px] text-white placeholder-slate-600 outline-none focus:border-green-500/40" />
          </div>
        </div>
        {error && <p className="mt-3 text-[12.5px] text-red-400">{error}</p>}
        {success && <p className="mt-3 text-[12.5px] text-green-400">{success}</p>}
        <button onClick={create} disabled={creating || !code || !percentOff}
          className="mt-4 flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          Créer le code
        </button>
      </div>

      {/* Liste */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
        <p className="mb-4 text-[14px] font-semibold text-white">Tous les codes</p>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
        ) : promos.length === 0 ? (
          <p className="py-4 text-[13px] text-slate-500">Aucun code promo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Réduction</th>
                  <th className="py-2 pr-4">S&apos;applique</th>
                  <th className="py-2 pr-4">Utilisations</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {promos.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td className="py-3 pr-4 font-mono text-[13px] font-bold text-white">{p.code}</td>
                    <td className="py-3 pr-4 text-[13px] text-green-400">
                      {p.percentOff ? `-${p.percentOff} %` : p.amountOff ? `-${p.amountOff} €` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] text-slate-400">
                      {p.duration === "once" ? "1ère facture" : p.duration === "forever" ? "Toutes les factures" : p.duration}
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-slate-300">
                      {p.timesRedeemed}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.active ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-500"}`}>
                        {p.active ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => toggle(p)} disabled={acting === p.id}
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                          p.active
                            ? "border-red-500/20 text-red-400 hover:bg-red-600/20"
                            : "border-green-500/20 text-green-400 hover:bg-green-600/20"
                        }`}>
                        <Power className="h-3 w-3" /> {p.active ? "Désactiver" : "Réactiver"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
