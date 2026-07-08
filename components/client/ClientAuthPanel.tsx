"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Phone, ArrowRight, Loader2, ChevronLeft, UserPlus, LogIn } from "lucide-react";

export interface JoinSuccess {
  customerId: string;
  customerCardId: string;
  clientName: string;
}

interface Props {
  /** Contexte "rejoindre une carte" (page /join). Absent sur /client/login. */
  cardId?: string;
  refParam?: string | null;
  accent?: string;
  /** Appelé après inscription/ajout de carte réussi (contexte join). */
  onJoined?: (data: JoinSuccess) => void;
}

type Mode = "choose" | "new" | "existing";

const GoogleIcon = () => (
  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const inputClass =
  "w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all";

export default function ClientAuthPanel({ cardId, refParam, accent = "#16a34a", onJoined }: Props) {
  const isJoin = !!cardId;
  const [mode, setMode] = useState<Mode>(isJoin ? "choose" : "existing");

  // Champs communs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Champs "nouveau compte" (join uniquement)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const googleHref = isJoin ? `/api/client/auth/google?cardId=${cardId}` : "/api/client/auth/google";

  const submitExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      if (isJoin) {
        // Compte existant + ajout de la carte de ce commerce
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "existing", email: email.trim(), password, cardId, ref: refParam ?? undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data?.error ?? `Erreur serveur (${res.status})`); setLoading(false); return; }
        onJoined?.({ customerId: data.customerId, customerCardId: data.customerCardId, clientName: data.clientName ?? email });
      } else {
        const res = await fetch("/api/client/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password: password || undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data?.error ?? "Erreur"); setLoading(false); return; }
        router.push("/client/cards");
      }
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim()) { setError("Le nom est requis."); return; }
    if (email.trim()) {
      if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
      if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "new", name, email, phone, cardId,
          password: email.trim() ? password : undefined,
          ref: refParam ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? `Erreur serveur (${res.status})`); setLoading(false); return; }
      onJoined?.({ customerId: data.customerId, customerCardId: data.customerCardId, clientName: data.clientName ?? name });
    } catch (err) {
      setError(`Erreur réseau : ${String(err)}`);
      setLoading(false);
    }
  };

  const GoogleButton = () => (
    <>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[12px] text-gray-400">ou</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <a
        href={googleHref}
        className="mt-4 flex w-full h-12 items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-[14px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
      >
        <GoogleIcon />
        Continuer avec Google
      </a>
    </>
  );

  // ── Choix du mode (uniquement en contexte join) ──
  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Étape 1 sur 2</p>
        <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1">Vous avez déjà un<br/>compte ComeBack ?</h2>
        <p className="text-sm text-gray-400 mb-6">Choisissez votre situation pour continuer.</p>

        <button
          onClick={() => { setMode("new"); setError(""); }}
          className="group flex items-center gap-4 rounded-2xl px-5 py-5 text-left transition active:scale-[0.98]"
          style={{ background: accent + "18", border: `2px solid ${accent}40` }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl shrink-0" style={{ background: accent }}>
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base">Créer mon compte</p>
            <p className="text-xs text-gray-500 mt-0.5">Première inscription sur ComeBack</p>
          </div>
          <ChevronLeft className="h-5 w-5 text-gray-300 rotate-180 shrink-0" />
        </button>

        <button
          onClick={() => { setMode("existing"); setError(""); }}
          className="flex items-center gap-4 rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-5 text-left transition hover:border-gray-200 active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-200 shrink-0">
            <LogIn className="h-6 w-6 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-base">J'ai déjà un compte</p>
            <p className="text-xs text-gray-500 mt-0.5">Connectez-vous pour ajouter cette carte</p>
          </div>
          <ChevronLeft className="h-5 w-5 text-gray-300 rotate-180 shrink-0" />
        </button>

        <GoogleButton />

        <p className="text-center text-[11px] text-gray-300 mt-4">
          ComeBack · Programme de fidélité digital
        </p>
      </div>
    );
  }

  // ── Nouveau compte (join uniquement) ──
  if (mode === "new") {
    return (
      <div>
        <button onClick={() => { setMode("choose"); setError(""); }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-5 -ml-1">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-6">Créer mon compte</h2>
        <form onSubmit={submitNew} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom & Nom *" className={inputClass} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className={inputClass} />
          </div>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 XX XX XX XX" className={inputClass} />
          </div>
          {email.trim() && (
            <>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (min. 6 caractères) *" className={inputClass} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe *" className={inputClass} />
              </div>
            </>
          )}
          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full h-12 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl text-[14px] font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>Activer ma carte <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <p className="text-center text-[11px] text-gray-400">
            En continuant, vous acceptez que vos coordonnées soient utilisées par ce commerçant pour la gestion de votre fidélité.
          </p>
        </form>
      </div>
    );
  }

  // ── Connexion compte existant (les deux contextes) ──
  return (
    <div>
      {isJoin && (
        <button onClick={() => { setMode("choose"); setError(""); }}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-5 -ml-1">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
      )}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          {isJoin ? "Me connecter" : "Vos cartes de fidélité"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isJoin
            ? "Entrez les identifiants de votre compte ComeBack pour ajouter cette carte."
            : "Retrouvez tous vos programmes dans un seul endroit."}
        </p>
      </div>

      <form onSubmit={submitExisting} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            className={inputClass}
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isJoin ? "Mot de passe" : "Mot de passe (optionnel)"}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full h-12 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl text-[14px] font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>{isJoin ? "Ajouter cette carte" : "Voir mes cartes"} <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      <GoogleButton />

      <div className="mt-6 flex flex-col items-center gap-2">
        <Link href="/client/forgot-password" className="text-[12px] text-gray-500 hover:text-gray-800 transition-colors">
          Mot de passe oublié ?
        </Link>
        {!isJoin && (
          <p className="text-[12px] text-center text-gray-400">
            Entrez l'email utilisé lors de votre inscription chez un commerçant partenaire.
          </p>
        )}
      </div>
    </div>
  );
}
