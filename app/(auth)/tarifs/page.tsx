"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Star, Gift, Loader2, Lock } from "lucide-react";
import CycleToggle from "@/components/billing/CycleToggle";
import CyclePrice from "@/components/billing/CyclePrice";
import { parseBillingCycle, cycleTotal, formatEuros, CYCLE_PER, type BillingCycle } from "@/lib/pricing";

// Plus de plan gratuit depuis le 27 octobre 2026 : tout commence par l'essai
// de 30 jours (niveau Business), puis Pro ou Business.
const PLANS = [
  {
    id: "pro",
    name: "Pro",
    price: 14.99,
    description: "Le choix des commerçants actifs",
    highlight: true,
    features: [
      "300 clients maximum",
      "10 000 notifications / mois",
      "Carte de fidélité personnalisée (tampons ou points)",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Stats historique complet + export CSV",
      "Support email prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 29.99,
    description: "Pour les enseignes en croissance",
    highlight: false,
    features: [
      "Clients illimités",
      "Notifications illimitées",
      "Carte de fidélité personnalisée (tampons ou points)",
      "Ciblage avancé (par rang client, inactifs)",
      "Notifications automatiques récurrentes",
      "Stats historique complet + export CSV",
      "Support dédié (< 4h)",
    ],
  },
] as const;


export default function TarifsPage() {
  const router = useRouter();
  // Période reprise de l'URL (?billing=quarterly) : un lien du site garde le choix fait.
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  useEffect(() => {
    setBilling(parseBillingCycle(new URLSearchParams(window.location.search).get("billing")));
  }, []);
  // Connecté ? (401 = non) — permet de payer directement sans repasser par signup
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  // État de l'essai, renvoyé par le serveur : disponible, en cours ou utilisé.
  const [trial, setTrial] = useState<{ status: string; daysLeft?: number } | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plan) { setLoggedIn(true); setCurrentPlan(d.plan); setTrialDaysLeft(d.daysLeft ?? null); }
      })
      .catch(() => {});
    fetch("/api/billing/trial")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTrial(d))
      .catch(() => {});
  }, []);

  /** Démarre l'essai : session Stripe avec carte, 0 € aujourd'hui. */
  const startTrial = async () => {
    if (trialLoading) return;
    setTrialLoading(true);
    setPayError("");
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCycle: billing }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setPayError(data?.error ?? "Impossible de démarrer l'essai.");
    } catch { setPayError("Erreur réseau."); }
    setTrialLoading(false);
  };

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
      // Essai converti en abonnement payant sur place : pas de page Stripe à
      // ouvrir.
      if (res.ok && (data.activated || data.converted)) { router.push("/dashboard"); router.refresh(); return; }
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setPayError(data?.error ?? "Paiement indisponible pour le moment.");
    } catch {
      setPayError("Erreur réseau.");
    }
    setPaying(null);
  };

  const essaiEnCours = trial?.status === "active";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-100 px-6">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-7 w-auto object-contain" />
        </div>
        {loggedIn ? (
          <Link href="/login" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors">
            Changer de compte
          </Link>
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

        {/* Essai gratuit — visible en permanence, dans ses trois états.
            Auparavant le bloc était conditionné à `!loggedIn` : il
            s'affichait le temps que la page découvre la session, puis
            disparaissait. Un commerçant connecté ne voyait donc jamais s'il
            lui restait un essai à prendre. */}
        {!loggedIn ? (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border-2 border-dashed border-green-300 bg-green-50/70 p-5">
            <div className="flex items-center justify-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              <p className="text-[15px] font-bold text-green-900">Nouveau sur ComeBack ?</p>
            </div>
            <p className="mt-1 text-[13px] text-green-800/70">
              <strong>30 jours avec toutes les fonctionnalités du plan Business</strong> — 0 € aujourd&apos;hui, sans engagement.
            </p>
            <Link
              href="/signup?plan=free"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 active:scale-[0.98]"
            >
              Commencer l&apos;essai gratuit
            </Link>
          </div>
        ) : trial?.status === "available" ? (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border-2 border-dashed border-green-300 bg-green-50/70 p-5">
            <div className="flex items-center justify-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              <p className="text-[15px] font-bold text-green-900">Votre essai Business vous attend</p>
            </div>
            <p className="mt-1 text-[13px] text-green-800/70">
              30 jours toutes fonctionnalités débloquées. <strong>0 € aujourd&apos;hui</strong> : la carte
              est demandée pour la suite, puis Business à {formatEuros(cycleTotal("business", billing))} € par {CYCLE_PER[billing]} TTC. Résiliable avant.
            </p>
            <button
              onClick={startTrial}
              disabled={trialLoading}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-60"
            >
              {trialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Activer l&apos;essai
            </button>
          </div>
        ) : trial?.status === "active" ? (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-green-200 bg-green-50 px-5 py-3.5">
            <p className="text-[13.5px] text-green-800">
              <Gift className="mr-1.5 inline h-4 w-4 align-[-2px]" />
              <strong>Essai Business en cours</strong>
              {typeof trial.daysLeft === "number" && <> — {trial.daysLeft} jour{trial.daysLeft > 1 ? "s" : ""} restant{trial.daysLeft > 1 ? "s" : ""}</>}.
              Choisissez un plan pour la suite.
            </p>
          </div>
        ) : trial?.status === "used" ? (
          <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5">
            <p className="text-[13px] text-slate-500">
              <Lock className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
              <strong className="font-semibold text-slate-600">Essai gratuit déjà utilisé.</strong> Il n&apos;est proposé qu&apos;une fois par commerce.
            </p>
          </div>
        ) : null}

        {/* Période de facturation */}
        <div className="mt-7">
          <CycleToggle value={billing} onChange={setBilling} />
        </div>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        {payError && (
          <p className="mx-auto mb-4 max-w-md rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600">
            {payError}
          </p>
        )}
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-2">
          {PLANS.map((plan) => {
            // Pendant l'essai, aucun plan n'est grisé : le commerçant doit
            // pouvoir prendre Business tout de suite pour passer en payant
            // sans attendre la fin des 30 jours. Son plan en base vaut déjà
            // « business » le temps de l'essai — le griser l'aurait enfermé.
            const isCurrent = loggedIn && currentPlan === plan.id && !essaiEnCours;
            const demarrerMaintenant = essaiEnCours && currentPlan === plan.id;
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
                  <div className="mt-2">
                    <CyclePrice plan={plan.id} cycle={billing} />
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
                    {isCurrent ? "Votre plan actuel"
                      : demarrerMaintenant ? "Démarrer l'abonnement maintenant"
                      : `Passer au plan ${plan.name}`}
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
          <br />Tous les prix sont TTC, toutes taxes comprises. Paiement sécurisé par Stripe. Formule annuelle : -20 %.
        </p>
      </div>
    </div>
  );
}
