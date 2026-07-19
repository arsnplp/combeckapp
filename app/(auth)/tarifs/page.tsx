"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Zap, Star, Gift, Loader2 } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    description: "Idéal pour démarrer",
    highlight: false,
    features: [
      "50 clients maximum",
      "1 000 notifications / mois",
      "1 carte de fidélité",
      "Ciblage basique (tous les clients)",
      "Stats sur 7 derniers jours",
      "Support email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "Le choix des commerçants actifs",
    highlight: true,
    features: [
      "100 clients maximum",
      "10 000 notifications / mois",
      "2 cartes de fidélité (tampons + points)",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Stats historique complet + export CSV",
      "Support email prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 99,
    description: "Pour les enseignes en croissance",
    highlight: false,
    features: [
      "Clients illimités",
      "Notifications illimitées",
      "2 cartes de fidélité (tampons + points)",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Stats historique complet + export CSV",
      "Support dédié (< 4h)",
    ],
  },
] as const;

// Affichage sans décimales — aligné sur PLAN_PRICING (annuel arrondi à l'euro)
const annualTotal = (p: number) => Math.round(p * 12 * 0.8);
const annualMonthly = (p: number) => Math.round(annualTotal(p) / 12);

export default function TarifsPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  // Connecté ? (401 = non) — permet de payer directement sans repasser par signup
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plan) { setLoggedIn(true); setCurrentPlan(d.plan); setTrialDaysLeft(d.daysLeft ?? null); }
      })
      .catch(() => {});
  }, []);

  const checkout = async (planId: string) => {
    if (paying) return;
    setPaying(planId);
    setPayError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, billingCycle: billing }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setPayError(data?.error ?? "Paiement indisponible pour le moment.");
    } catch {
      setPayError("Erreur réseau.");
    }
    setPaying(null);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-100 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600">
            <Zap className="h-3.5 w-3.5 text-white" fill="currentColor" />
          </div>
          <span className="text-[15px] font-bold text-slate-900">Comeback</span>
        </div>
        {loggedIn ? (
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
              ← Retour au dashboard
            </Link>
            <Link href="/login" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
              Changer de compte
            </Link>
          </div>
        ) : (
          <Link href="/login" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
            Déjà un compte ? Se connecter
          </Link>
        )}
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 pt-14 pb-6 text-center">
        <h1 className="text-[32px] font-bold leading-tight text-slate-900">
          Choisissez votre plan
        </h1>
        <p className="mt-3 text-[15px] text-slate-500">
          Fidélisez vos clients avec des cartes Apple Wallet et Google Wallet. Sans engagement, résiliable à tout moment.
        </p>

        {/* Essai gratuit — toujours visible pour les nouveaux */}
        {!loggedIn && (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border-2 border-dashed border-green-300 bg-green-50/70 p-5">
            <div className="flex items-center justify-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              <p className="text-[15px] font-bold text-green-900">Nouveau sur ComeBack ?</p>
            </div>
            <p className="mt-1 text-[13px] text-green-800/70">
              <strong>30 jours gratuits avec toutes les fonctionnalités du plan Business</strong> — sans carte bancaire, sans engagement.
            </p>
            <Link
              href="/signup?plan=free"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 active:scale-[0.98]"
            >
              Commencer l&apos;essai gratuit
            </Link>
          </div>
        )}

        {/* Compte en essai gratuit : rappel des jours restants */}
        {loggedIn && currentPlan === "free" && (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-green-200 bg-green-50 px-5 py-3.5">
            <p className="text-[13.5px] text-green-800">
              <Gift className="mr-1.5 inline h-4 w-4 align-[-2px]" />
              {trialDaysLeft !== null
                ? <>Vous êtes en essai gratuit — <strong>{trialDaysLeft} jour{trialDaysLeft > 1 ? "s" : ""} restant{trialDaysLeft > 1 ? "s" : ""}</strong>. Choisissez un plan pour continuer ensuite.</>
                : <>Vous êtes en essai gratuit. Choisissez un plan pour continuer ensuite.</>}
            </p>
          </div>
        )}

        {/* Toggle mensuel / annuel */}
        <div className="mt-7 inline-flex items-center rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setBilling("monthly")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-all ${billing === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition-all ${billing === "annual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Annuel
            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10.5px] font-bold text-green-700">-20 %</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        {payError && (
          <p className="mx-auto mb-4 max-w-md rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600">
            {payError}
          </p>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = loggedIn && currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border ${
                  plan.highlight
                    ? "border-green-500 shadow-[0_0_0_4px_rgba(22,163,74,0.08)] shadow-green-100"
                    : "border-slate-200"
                } bg-white p-6`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      <Star className="h-3 w-3" fill="currentColor" /> Recommandé
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">{plan.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {billing === "annual" && (
                      <span className="text-[20px] font-semibold text-slate-300 line-through">{plan.price}€</span>
                    )}
                    <span className="text-[38px] font-bold leading-none text-slate-900">
                      {billing === "monthly" ? plan.price : annualMonthly(plan.price)}€
                    </span>
                    <span className="text-[14px] text-slate-400">/mois</span>
                    {billing === "annual" && (
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11.5px] font-bold text-green-400">
                        économisez {plan.price * 12 - annualTotal(plan.price)}€
                      </span>
                    )}
                  </div>
                  {billing === "annual" ? (
                    <p className="mt-1 text-[12px] text-slate-400">Facturé {annualTotal(plan.price)}€ / an</p>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-400">Sans engagement</p>
                  )}
                  <p className="mt-1.5 text-[13px] text-slate-500">{plan.description}</p>
                </div>

                <ul className="mb-7 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${plan.highlight ? "text-green-500" : "text-slate-400"}`} />
                      <span className="text-[13px] text-slate-600">{f}</span>
                    </li>
                  ))}
                </ul>

                {loggedIn ? (
                  <button
                    onClick={() => checkout(plan.id)}
                    disabled={!!paying || isCurrent}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${
                      isCurrent
                        ? "border border-slate-200 bg-slate-50 text-slate-400"
                        : plan.highlight
                          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-emerald-600"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {paying === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isCurrent ? "Votre plan actuel" : `Passer au plan ${plan.name}`}
                  </button>
                ) : (
                  <Link
                    href={`/signup?plan=${plan.id}&billing=${billing}`}
                    className={`flex w-full items-center justify-center rounded-xl py-3 text-[14px] font-semibold transition-all active:scale-[0.98] ${
                      plan.highlight
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-emerald-600"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    Choisir {plan.name}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Footnote */}
        <p className="mt-10 text-center text-[12px] text-slate-400">
          Toutes les formules incluent les cartes Apple Wallet et Google Wallet, les notifications push et le dashboard analytics.
          <br />Paiement sécurisé par Stripe. Formule annuelle : -20 %.
        </p>
      </div>
    </div>
  );
}
