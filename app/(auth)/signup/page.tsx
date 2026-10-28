"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Check, Star, ArrowLeft } from "lucide-react";
import { isValidPhone } from "@/lib/validation";
import type { PlanId } from "@/types";
import {
  BILLING_CYCLES, CYCLE_LABEL, CYCLE_PER, PLAN_PRICING,
  cycleDiscountPercent, cycleMonthly, cycleTotal, formatEuros, parseBillingCycle,
  type BillingCycle, type PaidPlan,
} from "@/lib/pricing";

// Plus de plan gratuit : seuls l'essai (30 jours, carte demandée) et les plans
// payants s'inscrivent. Un lien ?plan=starter renvoie vers /tarifs.
type SignupPlan = Exclude<PlanId, "starter">;
const PLAN_INFO: Record<SignupPlan, { label: string; price: number; color: string }> = {
  free:     { label: "Essai gratuit", price: 0, color: "text-emerald-700 bg-emerald-50" },
  pro:      { label: "Pro",      price: PLAN_PRICING.pro.monthly,      color: "text-green-700 bg-green-50" },
  business: { label: "Business", price: PLAN_PRICING.business.monthly, color: "text-violet-700 bg-violet-50" },
};

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const planParam = params.get("plan") as SignupPlan | null;
  const plan: SignupPlan = planParam && planParam in PLAN_INFO ? planParam : "free";
  const planInfo = PLAN_INFO[plan];
  // Plan réellement facturé : Business pour l'essai (au terme des 30 jours),
  // sinon le plan choisi.
  const billedPlan: PaidPlan = plan === "free" ? "business" : plan;
  // Période choisie sur le site (?billing=quarterly) ou ici. Pour l'essai,
  // c'est la période facturée au terme des 30 jours.
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(parseBillingCycle(params.get("billing")));
  const billedTotal = formatEuros(cycleTotal(billedPlan, billingCycle));
  const billedPer = CYCLE_PER[billingCycle];

  const [storeName, setStoreName] = useState("");
  const [city, setCity]           = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!planParam || !(planParam in PLAN_INFO)) {
      router.replace("/tarifs");
    }
  }, [planParam, router]);

  const passwordStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColor = ["", "#ef4444", "#f59e0b", "#22c55e"][passwordStrength];
  const strengthLabel = ["", "Trop court", "Moyen", "Bon"][passwordStrength];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedStore = storeName.trim();
    const trimmedPhone = phone.trim();
    if (trimmedStore.length < 2) { setError("Le nom de l'établissement est trop court."); return; }
    if (!EMAIL_RE.test(trimmedEmail)) { setError("Adresse email invalide."); return; }
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (!isValidPhone(trimmedPhone)) { setError("Numéro de téléphone invalide."); return; }
    setLoading(true);
    try {
      // Essai gratuit → route dédiée (compte sans abonnement, email vérifié
      // d'office, l'essai Business est ensuite démarré via Stripe) ; payant →
      // signup classique
      const endpoint = plan === "free" ? "/api/auth/free-trial" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password, storeName: trimmedStore, city: city.trim(), phone: trimmedPhone, plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de la création du compte."); setLoading(false); return; }
      const signInRes = await signIn("credentials", { email: trimmedEmail, password, redirect: false });
      if (signInRes?.error) { setError("Compte créé mais erreur de connexion."); setLoading(false); return; }

      // Essai : on enchaîne directement sur Stripe pour la carte. Rien n'est
      // prélevé aujourd'hui ; c'est cette carte qui permettra à l'abonnement
      // de se poursuivre au 30e jour sans redemander quoi que ce soit.
      // Si Stripe est indisponible ou si le commerçant ferme la page, son
      // compte existe : il arrive sur /bloque, qui lui propose de reprendre
      // l'essai. Il n'y a plus de plan gratuit sur lequel retomber.
      if (plan === "free") {
        try {
          const tr = await fetch("/api/billing/trial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ billingCycle }),
          });
          const trData = await tr.json();
          if (tr.ok && trData.url) { window.location.href = trData.url; return; }
        } catch { /* on continue vers le dashboard */ }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Plan payant → page de paiement Stripe
      const co = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const coData = await co.json();
      if (co.ok && coData.url) {
        window.location.href = coData.url;
        return;
      }
      // Paiement indisponible : le compte existe, sans abonnement. Le
      // dashboard le renvoie vers /bloque pour choisir un plan.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex lg:w-[480px] xl:w-[520px]">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-green-600/20 blur-3xl" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-green-600/10 blur-3xl" />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Comeback" className="h-8 w-auto object-contain" />
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-[28px] font-bold leading-snug text-white">
              Plan <span className="text-green-400">{planInfo.label}</span><br />sélectionné
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
              {plan === "free"
                ? `30 jours · Toutes les fonctionnalités Business · 0 € aujourd'hui, carte demandée. Ensuite : ${billedTotal} € par ${billedPer} TTC, résiliable avant.`
                : billingCycle === "monthly"
                    ? `${billedTotal} € / mois TTC · Sans engagement`
                    : `${billedTotal} € par ${billedPer} TTC (soit ${formatEuros(cycleMonthly(billedPlan, billingCycle))} €/mois, -${cycleDiscountPercent(billedPlan, billingCycle)} %)`}
            </p>
          </div>
          <div className="space-y-2.5">
            {["Carte Apple Wallet personnalisée","Notifications push","Analytics en temps réel","Tableau de bord complet"].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-green-400" />
                <span className="text-[13px] text-slate-300">{f}</span>
              </div>
            ))}
          </div>
          <Link href="/tarifs" className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Changer de plan
          </Link>
        </div>
        <p className="relative text-[11px] text-slate-600">© 2025 Comeback · Tous droits réservés</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-6 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-7 w-auto object-contain" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className={`mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${planInfo.color}`}>
            {plan === "pro" && <Star className="h-3 w-3" fill="currentColor" />}
            {plan === "free"
              ? "Essai gratuit : 30 jours offerts, niveau Business"
              : `Plan ${planInfo.label} : ${formatEuros(cycleMonthly(billedPlan, billingCycle))}€/mois${billingCycle === "monthly" ? "" : `, facturé ${billedTotal}€ par ${billedPer}`}`}
          </div>

          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-slate-900">Créer votre compte</h1>
            <p className="mt-1 text-[14px] text-slate-500">Quelques secondes suffisent</p>
          </div>

          {/* Période de facturation. Pour l'essai : celle qui s'applique au
              terme des 30 jours (rien n'est prélevé avant). */}
          <div className="mb-6">
            {plan === "free" && (
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Après l&apos;essai</p>
            )}
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Période de facturation">
              {BILLING_CYCLES.map((cycle) => {
                const active = billingCycle === cycle;
                const percent = cycleDiscountPercent(billedPlan, cycle);
                return (
                  <button
                    key={cycle}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBillingCycle(cycle)}
                    className={`relative rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                      active ? "border-green-500 bg-green-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {percent > 0 && (
                      <span className="absolute -top-2 right-2 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">-{percent} %</span>
                    )}
                    <p className="text-[13px] font-bold text-slate-900">{CYCLE_LABEL[cycle]}</p>
                    <p className="text-[12px] text-slate-500">{formatEuros(cycleMonthly(billedPlan, cycle))}€/mois</p>
                    <p className={`text-[10.5px] ${cycle === "monthly" ? "text-slate-400" : "font-medium text-green-600"}`}>
                      {cycle === "monthly" ? "Sans engagement" : `${formatEuros(cycleTotal(billedPlan, cycle))}€ / ${CYCLE_PER[cycle]}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Établissement *</label>
                <input required autoFocus value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Le Petit Bistro"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Ville</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Téléphone *</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Mot de passe *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 caractères"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 3 }}>
                    <div className="h-full rounded-full transition-all" style={{ background: strengthColor, width: `${(passwordStrength / 3) * 100}%` }} />
                  </div>
                  <span className="min-w-[52px] text-right text-[11px] font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Création du compte…" : plan === "free" ? "Continuer" : "Créer mon compte"}
            </button>

            {/* Le commerçant doit savoir qu'une page de paiement suit, sinon
                l'arrivée sur Stripe ressemble à une demande de paiement. */}
            {plan === "free" && (
              <p className="text-center text-[12px] leading-relaxed text-slate-500">
                Étape suivante : votre carte, pour que l&apos;essai se poursuive sans coupure.
                <br />
                <strong className="font-semibold text-slate-600">0 € prélevé aujourd&apos;hui.</strong>{" "}
                Puis Business à {billedTotal} € par {billedPer}. Résiliable en un clic avant le 30<sup>e</sup> jour.
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-[13px] text-slate-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-green-600 hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
