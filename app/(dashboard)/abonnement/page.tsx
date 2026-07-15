"use client";

import { useState, useEffect } from "react";
import { Gift, Loader2, ExternalLink, CreditCard } from "lucide-react";
import PlanChooser from "@/components/billing/PlanChooser";

interface PlanInfo { plan: string; label: string; isExpired: boolean; daysLeft: number | null; }

export default function AbonnementPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo({ plan: d.plan, label: d.label, isExpired: d.isExpired, daysLeft: d.daysLeft }))
      .catch(() => {});
  }, []);

  const openPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data?.error ?? "Erreur.");
    } catch { setError("Erreur réseau."); }
    setPortalLoading(false);
  };

  const isFree = info?.plan === "free";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-green-600">Compte</p>
        <h2 className="mt-1 text-[22px] font-bold text-slate-900">Choisir un plan</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">Votre plan actuel, et changez quand vous voulez.</p>
      </div>

      {/* Plan actuel */}
      {info && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50/60 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              {isFree ? <Gift className="h-5 w-5 text-green-700" /> : <CreditCard className="h-5 w-5 text-green-700" />}
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-900">Plan actuel : {info.label}</p>
              <p className="text-[12.5px] text-slate-500">
                {isFree
                  ? info.daysLeft !== null
                    ? `Essai gratuit (niveau Business) — ${info.daysLeft} jour${info.daysLeft > 1 ? "s" : ""} restant${info.daysLeft > 1 ? "s" : ""}`
                    : "Essai gratuit (niveau Business)"
                  : "Renouvellement automatique — géré par Stripe"}
              </p>
            </div>
          </div>
          {!isFree && (
            <button onClick={openPortal} disabled={portalLoading}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors">
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Factures & résiliation
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mx-auto max-w-md rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600">{error}</p>
      )}

      <PlanChooser currentPlan={info?.plan} />

      <p className="text-center text-[11.5px] text-slate-400">
        Paiement sécurisé par Stripe · Sans engagement · Le changement de plan d&apos;un abonnement en cours se fait
        via le portail Stripe (prorata automatique).
      </p>
    </div>
  );
}
