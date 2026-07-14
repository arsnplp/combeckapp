"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Check, Star, ArrowLeft } from "lucide-react";
import type { PlanId } from "@/types";

const PLAN_INFO: Record<PlanId, { label: string; price: number; color: string }> = {
  free:     { label: "Essai gratuit", price: 0, color: "text-emerald-700 bg-emerald-50" },
  starter:  { label: "Starter",  price: 19, color: "text-slate-600 bg-slate-100" },
  pro:      { label: "Pro",      price: 49, color: "text-green-700 bg-green-50" },
  business: { label: "Business", price: 99, color: "text-violet-700 bg-violet-50" },
};

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const planParam = params.get("plan") as PlanId | null;
  const plan: PlanId = planParam && planParam in PLAN_INFO ? planParam : "starter";
  const planInfo = PLAN_INFO[plan];
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    params.get("billing") === "annual" ? "annual" : "monthly",
  );

  const [storeName, setStoreName] = useState("");
  const [city, setCity]           = useState("");
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
    if (trimmedStore.length < 2) { setError("Le nom de l'établissement est trop court."); return; }
    if (!EMAIL_RE.test(trimmedEmail)) { setError("Adresse email invalide."); return; }
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    setLoading(true);
    try {
      // Essai gratuit → route dédiée (90 jours d'expiration) ; payant → signup classique
      const endpoint = plan === "free" ? "/api/auth/free-trial" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password, storeName: trimmedStore, city: city.trim(), plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de la création du compte."); setLoading(false); return; }
      const signInRes = await signIn("credentials", { email: trimmedEmail, password, redirect: false });
      if (signInRes?.error) { setError("Compte créé mais erreur de connexion."); setLoading(false); return; }

      if (plan === "free") {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Plan payant → Stripe Checkout directement
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
      // Paiement indisponible : le compte existe, on continue vers le dashboard
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
          <img src="/logo.png" alt="Comeback" className="h-8 w-auto object-contain brightness-0 invert" />
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-[28px] font-bold leading-snug text-white">
              Plan <span className="text-green-400">{planInfo.label}</span><br />sélectionné
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
              {plan === "free"
                ? "Gratuit pendant 3 mois · Sans carte bancaire"
                : billingCycle === "annual"
                  ? `${Math.round(planInfo.price * 12 * 0.8)}€ / an (soit ${Math.round(Math.round(planInfo.price * 12 * 0.8) / 12)}€/mois, -20 %)`
                  : `${planInfo.price}€ / mois · Sans engagement`}
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
              ? "Essai gratuit — 3 mois offerts"
              : `Plan ${planInfo.label} — ${billingCycle === "annual" ? `${Math.round(Math.round(planInfo.price * 12 * 0.8) / 12)}€/mois facturé annuellement` : `${planInfo.price}€/mois`}`}
          </div>

          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-slate-900">Créer votre compte</h1>
            <p className="mt-1 text-[14px] text-slate-500">Quelques secondes suffisent</p>
          </div>

          {/* Choix du cycle de facturation (plans payants) */}
          {plan !== "free" && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  billingCycle === "monthly" ? "border-green-500 bg-green-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="text-[13px] font-bold text-slate-900">Mensuel</p>
                <p className="text-[12px] text-slate-500">{planInfo.price}€ / mois</p>
                <p className="text-[10.5px] text-slate-400">Sans engagement</p>
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  billingCycle === "annual" ? "border-green-500 bg-green-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="absolute -top-2 right-2 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">-20 %</span>
                <p className="text-[13px] font-bold text-slate-900">Annuel</p>
                <p className="text-[12px] text-slate-500">{Math.round(Math.round(planInfo.price * 12 * 0.8) / 12)}€ / mois</p>
                <p className="text-[10.5px] text-green-600 font-medium">{Math.round(planInfo.price * 12 * 0.8)}€ facturé 1× / an</p>
              </button>
            </div>
          )}

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
              {loading ? "Création du compte…" : "Créer mon compte"}
            </button>
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
