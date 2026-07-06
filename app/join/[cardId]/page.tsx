"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Loader2, UserPlus, LogIn, ChevronLeft } from "lucide-react";

interface CardMeta {
  id: string;
  name: string;
  welcomeMessage: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  loyaltyMode: "stamps" | "points";
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
}

type Mode = null | "new" | "existing";

export default function JoinPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [card, setCard] = useState<CardMeta | null>(null);
  const [mode, setMode] = useState<Mode>(null);

  // New account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Existing account fields
  const [exEmail, setExEmail] = useState("");
  const [exPassword, setExPassword] = useState("");

  const [step, setStep] = useState<"form" | "loading" | "done">("form");
  const [error, setError] = useState("");
  const [walletUrl, setWalletUrl] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [doneClientName, setDoneClientName] = useState("");
  const [refParam, setRefParam] = useState<string | null>(null);

  useEffect(() => {
    // Disable zoom on this page
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setRefParam(ref);
    const d = params.get("d");
    if (!d) return;
    try {
      let json: string;
      try {
        const bytes = Uint8Array.from(atob(d), (c) => c.charCodeAt(0));
        json = new TextDecoder().decode(bytes);
      } catch {
        json = atob(d);
      }
      setCard(JSON.parse(json));
    } catch { /* ignore */ }
    fetch("/api/wallet/pass?warm=1").catch(() => {});
  }, []);

  const downloadWallet = useCallback(async () => {
    if (!walletUrl) return;
    setWalletLoading(true);
    setWalletError("");
    try {
      const res = await fetch(walletUrl);
      if (!res.ok) throw new Error("Échec de génération");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carte-fidelite.pkpass";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setWalletError("Impossible de générer la carte. Réessayez.");
    } finally {
      setWalletLoading(false);
    }
  }, [walletUrl]);

  const handleSubmit = async () => {
    setError("");

    if (mode === "new") {
      if (!name.trim()) { setError("Le nom est requis."); return; }
      if (email.trim()) {
        if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
        if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
      }
    } else {
      if (!exEmail.trim()) { setError("L'email est requis."); return; }
      if (!exPassword) { setError("Le mot de passe est requis."); return; }
    }

    setStep("loading");
    try {
      const body =
        mode === "new"
          ? { mode: "new", name, email, phone, cardId, welcomePoints: card?.welcomePoints ?? 0, password: email.trim() ? password : undefined, ref: refParam ?? undefined }
          : { mode: "existing", email: exEmail, password: exPassword, cardId, welcomePoints: card?.welcomePoints ?? 0, ref: refParam ?? undefined };

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setStep("form");
        setError(data?.error ?? `Erreur serveur (${res.status})`);
        return;
      }
      const { customerId, customerCardId, clientName } = data;
      setDoneClientName(clientName ?? (mode === "new" ? name : exEmail));
      if (card && customerId) {
        const params = new URLSearchParams({
          clientId: customerId,
          ccId: customerCardId,
          name: clientName ?? name,
          type: card.loyaltyMode,
          stamps: "0",
          required: String(card.stampsRequired),
          points: String(card.welcomePoints ?? 0),
          store: card.name,
          accent: card.accentColor,
          bg: card.backgroundColor,
        });
        setWalletUrl(`/api/wallet/pass?${params.toString()}`);
      }
      setStep("done");
    } catch (e) {
      setStep("form");
      setError(`Erreur réseau : ${String(e)}`);
    }
  };

  const bg = card?.backgroundColor ?? "#1e293b";
  const accent = card?.accentColor ?? "#2563eb";
  const text = card?.textColor ?? "#ffffff";

  if (!card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 text-sm">
        QR invalide ou expiré.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      {/* Card header */}
      <div className="px-6 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: accent, color: "#000" }}>
            {card.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: text }}>{card.name}</p>
            <p className="text-sm opacity-60" style={{ color: text }}>Carte de fidélité</p>
          </div>
        </div>
        <p className="text-sm opacity-70" style={{ color: text }}>{card.welcomeMessage}</p>
        <div className="mt-4 rounded-2xl p-4" style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
          {card.loyaltyMode === "stamps" ? (
            <p className="text-sm font-medium" style={{ color: accent }}>
              Collectez {card.stampsRequired} tampons → récompense 🎁
            </p>
          ) : (
            <p className="text-sm font-medium" style={{ color: accent }}>
              {card.pointsPerEuro} point{card.pointsPerEuro > 1 ? "s" : ""} par euro dépensé
              {card.welcomePoints > 0 && ` · ${card.welcomePoints} pts offerts à l'inscription`}
            </p>
          )}
        </div>
      </div>

      {/* White sheet */}
      <div className="flex-1 rounded-t-3xl bg-white px-6 pt-8 pb-10">
        {step === "done" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Bienvenue {doneClientName.split(" ")[0]} !
            </h2>
            <p className="text-sm text-slate-500">
              Votre carte <strong>{card.name}</strong> est activée.
              {card.welcomePoints > 0 && (
                <span className="block mt-1 font-semibold text-green-600">{card.welcomePoints} points de bienvenue ajoutés 🎁</span>
              )}
            </p>
            {walletUrl && (
              <div className="mt-2 w-full">
                <button
                  onClick={downloadWallet}
                  disabled={walletLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white disabled:opacity-70 transition-opacity"
                  style={{ background: "#000" }}
                >
                  {walletLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  )}
                  {walletLoading ? "Génération en cours…" : "Ajouter à Apple Wallet"}
                </button>
                {walletError && (
                  <p className="mt-2 text-center text-xs text-red-500">{walletError}</p>
                )}
              </div>
            )}
            <a
              href="/client/cards"
              className="w-full flex items-center justify-center rounded-xl py-3 text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Voir mes cartes →
            </a>
            <p className="text-xs text-slate-400">
              Votre commerçant peut voir votre compte. Montrez ce message à la caisse.
            </p>
          </div>

        ) : mode === null ? (
          /* ── Landing / mode selection ── */
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Étape 1 sur 2</p>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight mb-1">Vous avez déjà un<br/>compte ComeBack ?</h2>
            <p className="text-sm text-slate-400 mb-6">Choisissez votre situation pour continuer.</p>

            <button
              onClick={() => setMode("new")}
              className="group flex items-center gap-4 rounded-2xl px-5 py-5 text-left transition active:scale-[0.98]"
              style={{ background: accent + "18", border: `2px solid ${accent}40` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl shrink-0" style={{ background: accent }}>
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900 text-base">Créer mon compte</p>
                <p className="text-xs text-slate-500 mt-0.5">Première inscription sur ComeBack</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-slate-300 rotate-180 shrink-0" />
            </button>

            <button
              onClick={() => setMode("existing")}
              className="flex items-center gap-4 rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-5 text-left transition hover:border-slate-200 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 shrink-0">
                <LogIn className="h-6 w-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900 text-base">J'ai déjà un compte</p>
                <p className="text-xs text-slate-500 mt-0.5">Connectez-vous pour ajouter cette carte</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-slate-300 rotate-180 shrink-0" />
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[11px] text-slate-300">ou</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <a
              href={`/api/client/auth/google?cardId=${cardId}&welcomePoints=${card?.welcomePoints ?? 0}`}
              className="flex items-center gap-4 rounded-2xl border-2 border-slate-100 bg-white px-5 py-4 text-left transition hover:border-slate-200 active:scale-[0.98]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <div className="flex-1">
                <p className="font-bold text-slate-900 text-base">Continuer avec Google</p>
                <p className="text-xs text-slate-500 mt-0.5">Connexion ou inscription en 1 clic</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-slate-300 rotate-180 shrink-0" />
            </a>

            <p className="text-center text-[11px] text-slate-300 mt-4">
              ComeBack · Programme de fidélité digital
            </p>
          </div>

        ) : mode === "new" ? (
          /* ── New account form ── */
          <>
            <button onClick={() => { setMode(null); setError(""); }}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-5 -ml-1">
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-6">Créer mon compte</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Prénom & Nom *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@exemple.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Téléphone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 XX XX XX XX"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
              </div>
              {email.trim() && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Mot de passe *</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caractères"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmer le mot de passe *</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
                  </div>
                </>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={handleSubmit} disabled={step === "loading"}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: accent }}>
                {step === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Activer ma carte
              </button>
              <p className="text-center text-[11px] text-slate-400">
                En continuant, vous acceptez que vos coordonnées soient utilisées par ce commerçant pour la gestion de votre fidélité.
              </p>
            </div>
          </>

        ) : (
          /* ── Existing account form ── */
          <>
            <button onClick={() => { setMode(null); setError(""); }}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-5 -ml-1">
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Me connecter</h2>
            <p className="text-sm text-slate-500 mb-6">Entrez les identifiants de votre compte ComeBack existant.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email *</label>
                <input type="email" value={exEmail} onChange={(e) => setExEmail(e.target.value)} placeholder="jean@exemple.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Mot de passe *</label>
                <input type="password" value={exPassword} onChange={(e) => setExPassword(e.target.value)} placeholder="Votre mot de passe ComeBack"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={handleSubmit} disabled={step === "loading"}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: accent }}>
                {step === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ajouter cette carte
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
