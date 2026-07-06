"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";

export default function OnboardingPage() {
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) { setError("Le nom du commerce est requis."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: storeName.trim(), city: city.trim() }),
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
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-600">
            <Zap className="h-4 w-4 text-white" fill="currentColor" />
          </div>
          <span className="text-[17px] font-bold text-slate-900">Comeback</span>
        </div>

        <h1 className="text-[22px] font-bold text-slate-900">Bienvenue !</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          Dernière étape — dites-nous comment s'appelle votre commerce.
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
