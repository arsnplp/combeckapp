"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Star, CreditCard, Bell, BarChart3 } from "lucide-react";

const FEATURES = [
  { icon: CreditCard, label: "Carte Apple Wallet", desc: "Vos clients gardent leur carte dans le portefeuille" },
  { icon: Bell, label: "Notifications push", desc: "Envoyez des offres ciblées instantanément" },
  { icon: BarChart3, label: "Analytics temps réel", desc: "Suivez la fidélité et les visites" },
  { icon: Star, label: "Programmes sur-mesure", desc: "Tampons, points, rangs — personnalisables" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const verified = params.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Adresse email invalide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", { email: trimmedEmail, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email ou mot de passe incorrect.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — Branding ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex lg:w-[480px] xl:w-[520px]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-green-600/20 blur-3xl" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-green-600/10 blur-3xl" />

        {/* Logo */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-8 w-auto object-contain brightness-0 invert" />
        </div>

        {/* Hero */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-[28px] font-bold leading-snug text-white">
              Le programme de fidélité<br />
              <span className="text-green-400">pensé pour les pros</span>
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
              Créez votre carte Apple Wallet, fidélisez vos clients<br />et boostez vos revenus en quelques minutes.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.07]">
                  <Icon className="h-3.5 w-3.5 text-green-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{label}</p>
                  <p className="text-[12px] text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-[11px] text-slate-600">© 2025 Comeback · Tous droits réservés</p>
      </div>

      {/* ── Right panel — Form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-7 w-auto object-contain" />
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-[22px] font-bold text-slate-900">Connexion</h1>
            <p className="mt-1 text-[14px] text-slate-500">Accédez à votre espace fidélité</p>
          </div>

          {verified && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
              Email vérifié ! Vous pouvez maintenant vous connecter.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">Mot de passe</label>
                <Link href="/forgot-password" className="text-[12px] text-green-600 hover:text-green-700 transition-colors">Mot de passe oublié ?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[12px] text-slate-400">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>

          <p className="mt-6 text-center text-[13px] text-slate-500">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-semibold text-green-600 hover:underline">
              Créer un compte
            </Link>
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Mentions légales</Link>
            <Link href="/cgu" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">CGU</Link>
            <Link href="/politique-de-confidentialite" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Politique de confidentialité</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
