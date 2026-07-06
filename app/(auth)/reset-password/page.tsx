"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur."); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-[14px] text-slate-500">Lien invalide.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-[13px] text-slate-700 underline">Demander un nouveau lien</Link>
      </div>
    );
  }

  return done ? (
    <div className="text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-green-100 mx-auto mb-4">
        <CheckCircle className="h-7 w-7 text-green-600" />
      </div>
      <h1 className="text-[20px] font-bold text-slate-900 mb-2">Mot de passe modifié !</h1>
      <p className="text-[14px] text-slate-500">Redirection vers la connexion…</p>
    </div>
  ) : (
    <>
      <h1 className="text-[22px] font-bold text-slate-900 mb-1">Nouveau mot de passe</h1>
      <p className="text-[14px] text-slate-500 mb-6">Choisissez un nouveau mot de passe pour votre compte.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe (8 car. min.)"
            required
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmer le mot de passe"
            required
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-[14px] font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enregistrer le nouveau mot de passe
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <Suspense fallback={<div className="text-center text-[14px] text-slate-400">Chargement…</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
