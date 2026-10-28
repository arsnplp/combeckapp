"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Loader2, AlertTriangle, Gift, Lock } from "lucide-react";
import CycleToggle from "@/components/billing/CycleToggle";
import CyclePrice from "@/components/billing/CyclePrice";
import { cycleMonthly, cycleTotal, formatEuros, CYCLE_PER, type BillingCycle } from "@/lib/pricing";

// Plus de plan gratuit depuis le 27 octobre 2026 : seuls Pro et Business se
// choisissent. Les comptes restés sur l'ancien Starter voient Pro comme une
// montée en gamme (voir planRank).
const PLANS = [
  {
    id: "pro", name: "Pro", price: 14.99, highlight: true,
    features: ["300 clients maximum", "10 000 notifications / mois", "1 carte de fidélité", "Ciblage avancé + notifications auto", "Historique complet + export CSV"],
  },
  {
    id: "business", name: "Business", price: 29.99, highlight: false,
    features: ["Clients & notifications illimités", "1 carte de fidélité", "Ciblage avancé + notifications auto", "Support dédié (< 4h)"],
  },
] as const;

const fmt = formatEuros;
/** Prix du premier mois remisé, arrondi au centime comme le fera Stripe. */
const firstMonth = (p: number, percent: number) => Math.round(p * (100 - percent)) / 100;

interface Usage { clients: number; cards: number; }

export default function PlanChooser({ currentPlan }: { currentPlan?: string | null }) {
  const router = useRouter();
  // Remise « premier mois » : l'éligibilité vient du serveur (jamais déduite
  // ici) et ne vaut qu'en mensuel, exactement comme au moment du paiement.
  const [upsellPercent, setUpsellPercent] = useState<number | null>(null);
  // Plan lu au serveur : sert de filet quand la page parente ne l'a pas encore
  // transmis (elle le charge en parallèle) ou ne le transmet pas du tout.
  const [serverPlan, setServerPlan] = useState<string | null>(null);
  // Essai gratuit : état renvoyé par le serveur (disponible / en cours /
  // utilisé). Affiché en permanence au-dessus des plans.
  const [trial, setTrial] = useState<{ status: string; daysLeft?: number; days?: number } | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  // Résiliation programmée chez Stripe (portail) : date de fin d'accès.
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  // Modale d'avertissement avant de choisir un plan inférieur au niveau d'essai (Business)
  const [warnPlan, setWarnPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/upsell")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setUpsellPercent(d?.eligible ? (d.percentOff ?? 50) : null);
        if (d?.plan) setServerPlan(d.plan);
      })
      .catch(() => {});
    fetch("/api/billing/trial")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTrial(d))
      .catch(() => {});
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCancelAt(d?.cancelAt ?? null))
      .catch(() => {});
  }, []);

  const startTrial = async () => {
    if (trialLoading) return;
    setTrialLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCycle: billing }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data?.error ?? "Impossible de démarrer l'essai.");
    } catch { setError("Erreur réseau."); }
    setTrialLoading(false);
  };

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
      // Essai converti en abonnement payant sur place : pas de page Stripe à
      // ouvrir.
      if (res.ok && (data.activated || data.converted)) { router.push("/dashboard"); router.refresh(); return; }
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setError(data?.error ?? "Paiement indisponible.");
    } catch { setError("Erreur réseau."); }
    setPaying(null);
  };

  // Niveau de fonctionnalités de chaque plan. L'essai gratuit ("free") donne
  // accès au niveau Business, d'où son rang maximal.
  const planRank = (id?: string | null): number => {
    // Compte qui n'a jamais pris son essai : il n'a rien à perdre, aucun
    // avertissement de descente en gamme.
    if (id === "free" && trial?.status === "available") return 0;
    switch (id) {
      case "starter": return 1;
      case "pro": return 2;
      case "business":
      case "free": return 3;
      // Plan inconnu (ex. page /bloque qui ne le transmet pas) : on suppose le
      // niveau le plus élevé pour continuer d'avertir en cas de doute.
      default: return 3;
    }
  };

  const choosePlan = (planId: string) => {
    // N'avertir QUE si le commerçant descend en gamme. Depuis le plan gratuit,
    // passer à Pro est une amélioration : lui annoncer « vous perdez… »
    // serait faux et le découragerait de s'abonner.
    if (planRank(planId) < planRank(currentPlan ?? serverPlan)) { setWarnPlan(planId); return; }
    startCheckout(planId);
  };

  // Ce que le commerçant PERD en choisissant ce plan (vs Business / essai)
  const lossesFor = (planId: string): string[] => {
    const losses: string[] = [];
    if (planId === "pro") {
      losses.push(
        usage && usage.clients > 300
          ? `Limite de 300 clients : vous en avez déjà ${usage.clients}, vous ne pourrez plus en accueillir de nouveaux`
          : `Limité à 300 clients (vous en avez ${usage?.clients ?? 0})`,
        "Notifications plafonnées à 10 000 / mois",
        "Pas de support dédié (< 4h)",
      );
    }
    return losses;
  };

  const warnedPlan = PLANS.find((p) => p.id === warnPlan);
  // Pendant l'essai, aucun plan n'est grisé : prendre Business tout de suite
  // doit rester possible pour basculer en payant avant le terme des 30 jours.
  const essaiEnCours = trial?.status === "active";

  return (
    <div className="space-y-5">
      {/* Essai gratuit — toujours visible : disponible, en cours, ou utilisé */}
      {trial && (
        trial.status === "available" ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border-2 border-dashed border-green-300 bg-green-50/60 px-5 py-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold text-slate-900">
                Essai Business offert : {trial.days ?? 30} jours
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">
                Toutes les fonctionnalités débloquées. <strong className="font-semibold">0 € aujourd&apos;hui</strong>,
                carte demandée pour la suite : à la fin des {trial.days ?? 30} jours, l&apos;abonnement
                Business à {fmt(cycleTotal("business", billing))} € par {CYCLE_PER[billing]} TTC démarre automatiquement. Résiliable à tout moment avant.
              </p>
            </div>
            <button
              onClick={startTrial}
              disabled={trialLoading}
              className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-md shadow-green-600/20 transition-all hover:from-green-700 hover:to-emerald-700 active:scale-[0.98] disabled:opacity-60"
            >
              {trialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Activer l&apos;essai
            </button>
          </div>
        ) : trial.status === "active" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-3.5">
            <Gift className="h-4.5 w-4.5 flex-shrink-0 text-green-700" />
            <p className="min-w-0 flex-1 text-[13.5px] text-slate-700">
              {cancelAt ? (
                <>
                  <strong className="font-bold text-slate-900">Essai résilié.</strong> Aucun prélèvement
                  n&apos;aura lieu. Vous gardez l&apos;accès jusqu&apos;au{" "}
                  {new Date(cancelAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })},
                  puis votre compte sera mis en pause, données conservées. Changé d&apos;avis ? Choisissez
                  un plan ci-dessous, ou annulez la résiliation dans « Factures &amp; résiliation ».
                </>
              ) : (
                <>
                  <strong className="font-bold text-slate-900">Essai Business en cours</strong> : il reste{" "}
                  {trial.daysLeft} jour{(trial.daysLeft ?? 0) > 1 ? "s" : ""}. À son terme, l&apos;abonnement
                  Business démarre automatiquement. Pour arrêter avant, sans rien payer : « Factures &amp;
                  résiliation », sur la page Abonnement.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5">
            <Lock className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <p className="min-w-0 flex-1 text-[13px] text-slate-500">
              <strong className="font-semibold text-slate-600">Essai gratuit déjà utilisé.</strong>{" "}
              Il n&apos;est proposé qu&apos;une fois par commerce.
            </p>
          </div>
        )
      )}

      {/* Période de facturation */}
      <div className="flex justify-center">
        <CycleToggle value={billing} onChange={setBilling} />
      </div>

      {error && (
        <p className="mx-auto max-w-md rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600">{error}</p>
      )}

      {/* Cartes */}
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id && !essaiEnCours;
          const demarrerMaintenant = essaiEnCours && currentPlan === plan.id;
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
              {billing === "monthly" && upsellPercent ? (
                <>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[16px] font-semibold text-slate-300 line-through">{fmt(plan.price)}€</span>
                    <span className="text-[30px] font-bold leading-none text-slate-900">{fmt(firstMonth(plan.price, upsellPercent))}€</span>
                    <span className="text-[13px] text-slate-400">le 1er mois TTC</span>
                    <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10.5px] font-bold text-white">−{upsellPercent} %</span>
                  </div>
                  {/* Le prix qui s'appliquera ensuite, annoncé clairement :
                      le commerçant ne doit pas découvrir le plein tarif au 2e mois. */}
                  <p className="mt-0.5 text-[11.5px] text-slate-400">puis {fmt(plan.price)}€ / mois TTC · sans engagement</p>
                </>
              ) : (
                <div className="mt-1.5">
                  <CyclePrice plan={plan.id} cycle={billing} size="md" />
                </div>
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
                {isCurrent ? "Plan actuel"
                  : demarrerMaintenant ? "Démarrer maintenant"
                  : `Choisir ${plan.name}`}
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
                Garder toutes mes fonctionnalités : Business ({fmt(cycleMonthly("business", billing))}€/mois)
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
