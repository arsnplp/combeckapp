"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import ClientAuthPanel, { type JoinSuccess } from "@/components/client/ClientAuthPanel";

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

export default function JoinPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [card, setCard] = useState<CardMeta | null>(null);

  const [done, setDone] = useState(false);
  const [walletUrl, setWalletUrl] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [doneClientName, setDoneClientName] = useState("");
  const [refParam, setRefParam] = useState<string | null>(null);
  const [ccId, setCcId] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Disable zoom on this page
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");

    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));

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

  const handleJoined = useCallback((data: JoinSuccess) => {
    setDoneClientName(data.clientName);
    setCcId(data.customerCardId ?? "");
    if (card && data.customerId) {
      const params = new URLSearchParams({
        clientId: data.customerId,
        ccId: data.customerCardId,
        name: data.clientName,
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
    setDone(true);
  }, [card]);

  const addToGoogleWallet = useCallback(async () => {
    if (!ccId) return;
    setGoogleLoading(true);
    setWalletError("");
    try {
      const res = await fetch(`/api/wallet/google-pass?ccId=${ccId}`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur Google Wallet");
      window.location.href = data.url;
    } catch {
      setWalletError("Impossible de générer la carte Google Wallet. Réessayez.");
    } finally {
      setGoogleLoading(false);
    }
  }, [ccId]);

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

  const bg = card?.backgroundColor ?? "#1e293b";
  const accent = card?.accentColor ?? "#16a34a";
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
        {done ? (
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
              <div className="mt-2 w-full space-y-2">
                {!isAndroid && (
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
                )}
                {!isIOS && ccId && (
                  <button
                    onClick={addToGoogleWallet}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white disabled:opacity-70 transition-opacity"
                    style={{ background: "#000" }}
                  >
                    {googleLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    {googleLoading ? "Génération en cours…" : "Ajouter à Google Wallet"}
                  </button>
                )}
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
        ) : (
          <ClientAuthPanel
            cardId={cardId}
            refParam={refParam}
            accent={accent}
            onJoined={handleJoined}
          />
        )}
      </div>
    </div>
  );
}
