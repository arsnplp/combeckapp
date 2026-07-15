"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, Users, Banknote, TrendingUp, Clock, ArrowLeft,
  Check, X, Ban, RotateCcw,
} from "lucide-react";

interface AdminAffiliate {
  id: string; email: string; name: string; commerce: string; phone: string;
  referralCode: string; tier: string; status: string; suspensionReason: string | null;
  bankMethod: string | null; bankDetails: { iban?: string; bic?: string; paypalEmail?: string } | null;
  goal: string | null;
  createdAt: string; activeClients: number; churnedClients: number;
  available: number; pending: number; totalEarned: number; totalWithdrawn: number;
}

interface AdminWithdrawal {
  id: string; affiliateId: string; amount: number; status: string;
  bankMethod: string; bankDetails: { iban?: string; bic?: string; paypalEmail?: string };
  requestedAt: string; adminNotes: string | null;
}

interface AdminData {
  affiliates: AdminAffiliate[];
  withdrawals: AdminWithdrawal[];
  analytics: {
    totalAffiliates: number; activeAffiliates: number;
    commissionsThisMonth: number; totalCommissions: number; totalPaidOut: number;
    pendingWithdrawals: number;
  };
}

const TIER_EMOJI: Record<string, string> = { bronze: "🥉", gold: "🥇", platinum: "💎" };
const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";

export default function AdminAffiliatesPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/affiliates");
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload: Record<string, string>) => {
    setActing(payload.withdrawalId ?? payload.affiliateId ?? "");
    await fetch("/api/admin/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
    setActing("");
  };

  if (loading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-600" /></div>;
  }

  const affiliateById = new Map(data.affiliates.map((a) => [a.id, a]));
  const pendingWds = data.withdrawals.filter((w) => ["pending", "approved"].includes(w.status));
  const filtered = data.affiliates.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.commerce.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Console admin
        </Link>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-amber-400">Super Admin</p>
        <h1 className="mt-1 text-[22px] font-bold text-white">Programme d'affiliation</h1>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Users, label: "Affiliés", value: data.analytics.totalAffiliates, sub: `${data.analytics.activeAffiliates} avec clients actifs`, color: "#22c55e" },
          { icon: TrendingUp, label: "Commissions ce mois", value: eur(data.analytics.commissionsThisMonth), sub: `${eur(data.analytics.totalCommissions)} au total`, color: "#f59e0b" },
          { icon: Banknote, label: "Payé aux affiliés", value: eur(data.analytics.totalPaidOut), color: "#8b5cf6" },
          { icon: Clock, label: "Retraits à traiter", value: data.analytics.pendingWithdrawals, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${s.color}20` }}>
                <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
              </div>
              <p className="text-[11.5px] font-medium text-slate-400">{s.label}</p>
            </div>
            <p className="text-[22px] font-bold leading-none text-white">{s.value}</p>
            {s.sub && <p className="mt-1 text-[10.5px] text-slate-500">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Retraits en attente */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
        <p className="mb-4 text-[14px] font-semibold text-white">
          🔔 Retraits à traiter <span className="text-slate-500">({pendingWds.length})</span>
        </p>
        {pendingWds.length === 0 ? (
          <p className="py-2 text-[13px] text-slate-500">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-3">
            {pendingWds.map((w) => {
              const aff = affiliateById.get(w.affiliateId);
              const bank = w.bankDetails?.paypalEmail
                ? `PayPal : ${w.bankDetails.paypalEmail}`
                : `IBAN : ${w.bankDetails?.iban ?? "?"}${w.bankDetails?.bic ? ` / BIC : ${w.bankDetails.bic}` : ""}`;
              return (
                <div key={w.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-white">
                        {aff?.name ?? "?"} <span className="text-slate-500">({aff?.commerce ?? "?"})</span>
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {eur(w.amount)} · {w.bankMethod} · demandé le {new Date(w.requestedAt).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-500">{bank}</p>
                      {w.status === "approved" && (
                        <p className="mt-0.5 text-[11px] font-medium text-blue-400">Approuvé — en attente du paiement</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {w.status === "pending" && (
                        <button onClick={() => act({ action: "approve", withdrawalId: w.id })} disabled={acting === w.id}
                          className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-1.5 text-[12px] font-medium text-blue-300 hover:bg-blue-600/30">
                          <Check className="h-3.5 w-3.5" /> Approuver
                        </button>
                      )}
                      <button onClick={() => act({ action: "mark-paid", withdrawalId: w.id })} disabled={acting === w.id}
                        className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-600/20 px-3 py-1.5 text-[12px] font-medium text-green-300 hover:bg-green-600/30">
                        <Banknote className="h-3.5 w-3.5" /> Marquer payé
                      </button>
                      <button onClick={() => { const n = prompt("Raison du refus ?") ?? undefined; act({ action: "reject", withdrawalId: w.id, ...(n ? { notes: n } : {}) }); }}
                        disabled={acting === w.id}
                        className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-600/20 px-3 py-1.5 text-[12px] font-medium text-red-300 hover:bg-red-600/30">
                        <X className="h-3.5 w-3.5" /> Refuser
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tous les affiliés */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-white">Tous les affiliés</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher…"
            className="h-8 w-48 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[12px] text-white placeholder-slate-500 outline-none focus:border-green-500/40" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4">Affilié</th>
                <th className="py-2 pr-4">Tier</th>
                <th className="py-2 pr-4">Clients</th>
                <th className="py-2 pr-4">Cagnotte</th>
                <th className="py-2 pr-4">Total gagné (à vie)</th>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((a) => (
                <tr key={a.id} className={a.status === "suspended" ? "opacity-50" : ""}>
                  <td className="py-3 pr-4">
                    <p className="text-[13px] font-medium text-white">{a.name}</p>
                    <p className="text-[11px] text-slate-500">{a.commerce} · {a.email}</p>
                    <p className="text-[11px] text-slate-400">📞 {a.phone || "—"}</p>
                    {a.goal && <p className="text-[10.5px] text-slate-500">🎯 {a.goal}</p>}
                    {a.status === "suspended" && (
                      <p className="text-[10.5px] text-red-400">Suspendu : {a.suspensionReason}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[13px]">{TIER_EMOJI[a.tier] ?? ""} {a.tier}</td>
                  <td className="py-3 pr-4 text-[13px] text-slate-300">
                    {a.activeClients} <span className="text-[11px] text-slate-500">({a.churnedClients} partis)</span>
                  </td>
                  <td className="py-3 pr-4 text-[12.5px] text-slate-300">
                    <span className="text-green-400">{eur(a.available)}</span>
                    {a.pending > 0 && <span className="text-amber-400"> +{eur(a.pending)} ⏳</span>}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-[12.5px] font-semibold text-slate-200">{eur(a.totalEarned)}</p>
                    {a.totalWithdrawn > 0 && (
                      <p className="text-[10.5px] text-slate-500">dont {eur(a.totalWithdrawn)} versés</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[11.5px] text-slate-400">{a.referralCode}</td>
                  <td className="py-3">
                    <div className="flex flex-col gap-1">
                      {a.available >= 0.01 && (
                        <button
                          onClick={() => {
                            const v = prompt(`Montant du virement effectué à ${a.name} (disponible : ${eur(a.available)}) :`, String(a.available));
                            if (v === null) return;
                            const amount = parseFloat(v.replace(",", "."));
                            if (!amount || amount <= 0) { alert("Montant invalide."); return; }
                            if (!confirm(`Confirmer : virement de ${eur(amount)} marqué comme effectué. Sa cagnotte disponible sera réduite d'autant.`)) return;
                            act({ action: "manual-payout", affiliateId: a.id, amount: String(amount) });
                          }}
                          className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-600/20 px-2 py-1 text-[11px] font-medium text-green-300 hover:bg-green-600/30"
                        >
                          <Banknote className="h-3 w-3" /> Virement fait
                        </button>
                      )}
                      {a.status === "active" ? (
                        <button onClick={() => { const r = prompt("Raison de la suspension ?") ?? "Suspendu par l'administrateur"; act({ action: "suspend", affiliateId: a.id, reason: r }); }}
                          className="flex items-center gap-1 rounded-lg border border-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-600/20">
                          <Ban className="h-3 w-3" /> Suspendre
                        </button>
                      ) : (
                        <button onClick={() => act({ action: "reactivate", affiliateId: a.id })}
                          className="flex items-center gap-1 rounded-lg border border-green-500/20 px-2 py-1 text-[11px] text-green-400 hover:bg-green-600/20">
                          <RotateCcw className="h-3 w-3" /> Réactiver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[13px] text-slate-500">Aucun affilié.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
