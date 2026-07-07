"use client";

import Link from "next/link";
import { Check, Zap, Star } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    description: "Idéal pour démarrer",
    highlight: false,
    features: [
      "150 clients maximum",
      "10 000 notifications / mois",
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
      "Clients illimités",
      "50 000 notifications / mois",
      "3 cartes de fidélité",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Parrainage avec bonus",
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
      "Cartes de fidélité illimitées",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Parrainage avec bonus",
      "Stats historique complet + export CSV",
      "Support dédié (< 4h)",
    ],
  },
] as const;

export default function TarifsPage() {
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
        <Link href="/login" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
          Déjà un compte ? Se connecter
        </Link>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 pt-14 pb-10 text-center">
        <h1 className="text-[32px] font-bold leading-tight text-slate-900">
          Choisissez votre plan
        </h1>
        <p className="mt-3 text-[15px] text-slate-500">
          Fidélisez vos clients avec des cartes Apple Wallet. Sans engagement, résiliable à tout moment.
        </p>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
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
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-[38px] font-bold leading-none text-slate-900">{plan.price}€</span>
                  <span className="mb-1 text-[14px] text-slate-400">/mois</span>
                </div>
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

              <Link
                href={`/signup?plan=${plan.id}`}
                className={`flex w-full items-center justify-center rounded-xl py-2.5 text-[14px] font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Choisir {plan.name}
              </Link>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="mt-10 text-center text-[12px] text-slate-400">
          Toutes les formules incluent la carte Apple Wallet, les notifications push et le dashboard analytics.
          <br />Limite de 2 cartes max par compte (1 à tampons + 1 à points).
        </p>
      </div>
    </div>
  );
}
