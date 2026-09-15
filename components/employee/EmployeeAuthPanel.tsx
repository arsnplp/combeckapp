"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, ArrowRight, Loader2, ChevronLeft, UserPlus, LogIn } from "lucide-react";

const inputClass =
  "w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 transition-all";

type Mode = "choose" | "new" | "existing";

export default function EmployeeAuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/employee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Fiche créée par un commerçant mais jamais activée : on bascule
        // directement sur la création de mot de passe.
        if (data?.needsSignup) { setMode("new"); setError(data.error); setLoading(false); return; }
        setError(data?.error ?? "Erreur de connexion.");
        setLoading(false);
        return;
      }
      router.push("/employe");
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/employee/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Erreur."); setLoading(false); return; }
      router.push("/employe");
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  };

  // ── Choix du mode ──
  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="mb-1 text-2xl font-bold leading-tight text-gray-900">Espace employé</h2>
        <p className="mb-6 text-sm text-gray-400">
          Scannez les cartes de vos clients et validez leurs récompenses.
        </p>

        <button
          onClick={() => { setMode("existing"); setError(""); }}
          className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-900 px-5 py-5 text-left transition active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-white">J&apos;ai déjà un compte</p>
            <p className="mt-0.5 text-xs text-white/60">Me connecter à mon espace</p>
          </div>
          <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-white/40" />
        </button>

        <button
          onClick={() => { setMode("new"); setError(""); }}
          className="flex items-center gap-4 rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-5 text-left transition hover:border-gray-200 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-200">
            <UserPlus className="h-6 w-6 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900">Créer mon compte</p>
            <p className="mt-0.5 text-xs text-gray-500">Première connexion en tant qu&apos;employé</p>
          </div>
          <ChevronLeft className="h-5 w-5 shrink-0 rotate-180 text-gray-300" />
        </button>

        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[12.5px] leading-relaxed text-gray-500">
            Votre employeur doit vous ajouter depuis son espace avec cet email.
            Le commerce apparaîtra alors ici, et vous y entrerez avec le mot de
            passe qu&apos;il vous a communiqué.
          </p>
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-300">
          ComeBack · Programme de fidélité digital
        </p>
      </div>
    );
  }

  // ── Création de compte ──
  if (mode === "new") {
    return (
      <div>
        <button onClick={() => { setMode("choose"); setError(""); }}
          className="-ml-1 mb-5 flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <h2 className="mb-1 text-lg font-bold text-gray-900">Créer mon compte employé</h2>
        <p className="mb-6 text-sm text-gray-500">
          Utilisez l&apos;email que votre employeur a enregistré.
        </p>
        <form onSubmit={submitNew} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Prénom & Nom *" className={inputClass} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com" className={inputClass} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe (min. 6 caractères) *" className={inputClass} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer le mot de passe *" className={inputClass} />
          </div>
          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500">{error}</p>
          )}
          <button type="submit" disabled={loading || !name.trim() || !email.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[14px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Créer mon compte <ArrowRight className="h-4 w-4" /></>)}
          </button>
          <p className="text-center text-[11px] text-gray-400">
            Ce mot de passe est le vôtre — votre employeur ne le connaît pas.
          </p>
        </form>
      </div>
    );
  }

  // ── Connexion ──
  return (
    <div>
      <button onClick={() => { setMode("choose"); setError(""); }}
        className="-ml-1 mb-5 flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Retour
      </button>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Me connecter</h2>
        <p className="mt-1 text-sm text-gray-500">Retrouvez les commerces où vous travaillez.</p>
      </div>
      <form onSubmit={submitExisting} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com" required className={inputClass} />
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe" className={inputClass} />
        </div>
        {error && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500">{error}</p>
        )}
        <button type="submit" disabled={loading || !email.trim()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[14px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Voir mes commerces <ArrowRight className="h-4 w-4" /></>)}
        </button>
      </form>
    </div>
  );
}
