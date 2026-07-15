"use client";

import { useState, useEffect } from "react";
import { Check, Star, Loader2, AlertTriangle } from "lucide-react";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 19, highlight: false,
    features: ["50 clients maximum", "1 000 notifications / mois", "1 carte de fidélité", "Stats sur 7 jours"],
  },
  {
    id: "pro", name: "Pro", price: 49, highlight: true,
    features: ["Clients illimités", "50 000 notifications / mois", "3 cartes de fidélité", "Ciblage avancé + notifications auto", "Historique complet + export CSV"],
  },
  {
    id: "business", name: "Business", price: 99, highlight: false,
    features: ["Tout illimité (clients, notifs, cartes)", "Ciblage avancé + notifications auto", "Support dédié (< 4h)"],
  },
] as const;

const annualTotal = (p: number) => Math.round(p * 12 * 0.8);
const annualMonthly = (p: number) => Math.round(annualTotal(p) / 12);

interface Usage { clients: number; cards: number; }

export default function PlanChooser({ currentPlan }: { currentPlan?: string | null }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  // Modale d'avertissement avant de choisir un plan inférieur au niveau d'essai (Business)
  const [warnPlan, setWarnPlan] = useState<string | null>(null);

  useEffect(() => {
    // Usage réel pour rendre l'avertissement concret
    Promise.all([
      fetch("/api/register").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([reg, settings]) => {
      setUsage({
        clients: reg?.customers?.length ?? 0,
        cards: settings?.loyaltyCards?.length ?? 0,
      });
    });
  }, []);

  const startCheckout = async (planId: string) => {
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

  const choosePlan = (planId: string) => {
    // Starter / Pro = perte de fonctionnalités vs l'essai (niveau Business) → avertir
    if (planId !== "business") { setWarnPlan(planId); return; }
    startCheckout(planId);
  };

  // Ce que le commerçant PERD en choisissant ce plan (vs Business / essai)
  const lossesFor = (planId: string): string[] => {
    const losses: string[] = [];
    if (planId === "starter") {
      losses.push(
        usage && usage.clients > 50
          ? `Limite de 50 clients — vous en avez déjà ${usage.clients} : vous ne pourrez plus en accueillir de nouveaux`
          : `Limité à 50 clients (vous en avez ${usage?.clients ?? 0})`,
        usage && usage.cards > 1
          ? `1 seule carte de fidélité active — vos ${usage.cards - 1} autre${usage.cards > 2 ? "s" : ""} carte${usage.cards > 2 ? "s" : ""} seront gelées : plus aucune nouvelle inscription dessus (les clients et soldes existants sont conservés)`
          : "1 seule carte de fidélité",
        "❌ Notifications automatiques récurrentes désactivées",
        "❌ Ciblage avancé (rangs, clients inactifs) désactivé",
        "❌ Export CSV de votre base clients désactivé",
        "Statistiques limitées aux 7 derniers jours (au lieu de 2 ans)",
        "1 000 notifications / mois maximum (au lieu d'illimité)",
      );
    } else if (planId === "pro") {
      losses.push(
        usage && usage.cards > 3
          ? `3 cartes de fidélité actives maximum — vous en avez ${usage.cards} : les autres seront gelées (données conservées)`
          : "3 cartes de fidélité maximum",
        "Notifications plafonnées à 50 000 / mois",
        "Pas de support dédié (< 4h)",
      );
    }
    return losses;
  };

  const warnedPlan = PLANS.find((p) => p.id === warnPlan);

  return (
    <div className="space-y-5">
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

      {/* Cartes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
                isCurrent ? "border-green-500 shadow-[0_0_0_4px_rgba(22,163,74,0.08)]"
                : plan.highlight ? "border-green-300" : "border-slate-200"
              }`}>
              {isCurrent ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    <Check className="h-3 w-3" /> Votre plan
                  </span>
                </div>
              ) : plan.highlight && (
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
                onClick={() => choosePlan(plan.id)}
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
                {isCurrent ? "Plan actuel" : `Choisir ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Modale d'avertissement downgrade ── */}
      {warnedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setWarnPlan(null)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-[16px] font-bold text-slate-900">
                Attention : avec {warnedPlan.name}, vous perdez…
              </p>
            </div>

            <ul className="mt-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              {lossesFor(warnedPlan.id).map((l) => (
                <li key={l} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-900/80">
                  <span className="mt-0.5 flex-shrink-0 text-amber-500">•</span> {l}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
              Pendant votre essai vous utilisiez le <strong>niveau Business</strong>. Vos données ne sont
              pas supprimées, mais ces fonctionnalités seront <strong>désactivées immédiatement</strong> avec
              le plan {warnedPlan.name}.
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => { setWarnPlan(null); startCheckout("business"); }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-[14px] font-bold text-white shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                Garder toutes mes fonctionnalités — Business ({billing === "monthly" ? "99€/mois" : "79€/mois"})
              </button>
              <button
                onClick={() => { const p = warnedPlan.id; setWarnPlan(null); startCheckout(p); }}
                className="h-10 w-full rounded-xl border border-slate-200 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Continuer avec {warnedPlan.name} malgré tout
              </button>
              <button onClick={() => setWarnPlan(null)}
                className="w-full text-center text-[11.5px] text-slate-400 underline">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
