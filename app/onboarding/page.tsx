"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function OnboardingPage() {
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const PHONE_RE = /^[+\d][\d\s().-]{7,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) { setError("Le nom du commerce est requis."); return; }
    if (!PHONE_RE.test(phone.trim())) { setError("Numéro de téléphone invalide."); return; }
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: storeName.trim(), city: city.trim(), phone: phone.trim(), password }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erreur");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Comeback" className="h-8 w-auto object-contain" />
        </div>

        <h1 className="text-[22px] font-bold text-slate-900">Bienvenue !</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          Dernière étape — complétez votre compte pour accéder à votre espace.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Nom du commerce *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex : Boulangerie Dupont"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Ville (optionnel)
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex : Paris"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Téléphone *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Mot de passe *
            </label>
            <p className="text-[11.5px] text-slate-400">
              Pour pouvoir vous connecter avec ou sans Google, au choix.
            </p>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.07em] text-slate-500">
              Confirmer le mot de passe *
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez le mot de passe"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-300 focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Enregistrement…" : "Accéder à mon espace"}
          </button>
        </form>
      </div>
    </div>
  );
}
