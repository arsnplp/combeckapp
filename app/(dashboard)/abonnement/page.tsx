"use client";

import { useState, useEffect } from "react";
import { Check, Star, Gift, Loader2, ExternalLink, CreditCard } from "lucide-react";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 19, highlight: false,
    features: ["150 clients maximum", "10 000 notifications / mois", "1 carte de fidélité", "Stats sur 7 jours"],
  },
  {
    id: "pro", name: "Pro", price: 49, highlight: true,
    features: ["Clients illimités", "50 000 notifications / mois", "3 cartes de fidélité", "Ciblage avancé + notifications auto", "Parrainage avec bonus", "Historique complet + export CSV"],
  },
  {
    id: "business", name: "Business", price: 99, highlight: false,
    features: ["Tout illimité (clients, notifs, cartes)", "Ciblage avancé + notifications auto", "Parrainage avec bonus", "Support dédié (< 4h)"],
  },
] as const;

const annualTotal = (p: number) => Math.round(p * 12 * 0.8);
const annualMonthly = (p: number) => Math.round(annualTotal(p) / 12);

interface PlanInfo { plan: string; label: string; isExpired: boolean; daysLeft: number | null; }

export default function AbonnementPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo({ plan: d.plan, label: d.label, isExpired: d.isExpired, daysLeft: d.daysLeft }))
      .catch(() => {});
  }, []);

  const checkout = async (planId: string) => {
    if (paying) return;
    setPaying(planId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, billingCycle: billing }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data?.error ?? "Paiement indisponible.");
    } catch { setError("Erreur réseau."); }
    setPaying(null);
  };

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
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 ${
          isFree && info.isExpired ? "border-red-200 bg-red-50/60" : "border-green-200 bg-green-50/60"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isFree && info.isExpired ? "bg-red-100" : "bg-green-100"}`}>
              {isFree ? <Gift className={`h-5 w-5 ${info.isExpired ? "text-red-600" : "text-green-700"}`} /> : <CreditCard className="h-5 w-5 text-green-700" />}
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-900">
                Plan actuel : {info.label}
              </p>
              <p className="text-[12.5px] text-slate-500">
                {isFree
                  ? info.isExpired
                    ? "Essai gratuit expiré — choisissez un plan pour continuer"
                    : info.daysLeft !== null
                      ? `Essai gratuit — ${info.daysLeft} jour${info.daysLeft > 1 ? "s" : ""} restant${info.daysLeft > 1 ? "s" : ""}`
                      : "Essai gratuit"
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

      {/* Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-xl bg-slate-100 p-1">
          <button onClick={() => setBilling("monthly")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-all ${billing === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            Mensuel
          </button>
          <button onClick={() => setBilling("annual")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all ${billing === "annual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            Annuel <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10.5px] font-bold text-green-700">-20 %</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-auto max-w-md rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600">{error}</p>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = info?.plan === plan.id;
          return (
            <div key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
                isCurrent ? "border-green-500 shadow-[0_0_0_4px_rgba(22,163,74,0.08)]"
                : plan.highlight ? "border-green-300" : "border-slate-200"
              }`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    <Check className="h-3 w-3" /> Votre plan
                  </span>
                </div>
              )}
              {!isCurrent && plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    <Star className="h-3 w-3" fill="currentColor" /> Recommandé
                  </span>
                </div>
              )}

              <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">{plan.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {billing === "annual" && (
                  <span className="text-[16px] font-semibold text-slate-300 line-through">{plan.price}€</span>
                )}
                <span className="text-[30px] font-bold leading-none text-slate-900">
                  {billing === "monthly" ? plan.price : annualMonthly(plan.price)}€
                </span>
                <span className="text-[13px] text-slate-400">/mois</span>
                {billing === "annual" && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10.5px] font-bold text-green-400">
                    économisez {plan.price * 12 - annualTotal(plan.price)}€
                  </span>
                )}
              </div>
              {billing === "annual" && (
                <p className="mt-0.5 text-[11.5px] text-slate-400">Facturé {annualTotal(plan.price)}€ / an</p>
              )}

              <ul className="mb-5 mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                    <span className="text-[12.5px] text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => checkout(plan.id)}
                disabled={!!paying || isCurrent}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${
                  isCurrent
                    ? "border border-slate-200 bg-slate-50 text-slate-400"
                    : plan.highlight
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-emerald-600"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {paying === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCurrent ? "Plan actuel" : `Passer au plan ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11.5px] text-slate-400">
        Paiement sécurisé par Stripe · Sans engagement · Le changement de plan d&apos;un abonnement en cours se fait
        via le portail Stripe (prorata automatique).
      </p>
    </div>
  );
}
