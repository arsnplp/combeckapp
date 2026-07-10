"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export default function WalletButton({ ccId, walletAdded = false }: { ccId: string; walletAdded?: boolean }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const handleApple = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/client/cards/wallet?ccId=${ccId}`);
      if (!res.ok) { setError("Erreur lors de la génération."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carte-fidelite.pkpass";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch { setError("Erreur réseau."); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/wallet/google-pass?ccId=${ccId}`);
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error ?? "Erreur Google Wallet."); return; }
      // Redirection directe : window.open après un await est bloqué par les
      // bloqueurs de popup mobiles
      window.location.href = data.url;
    } catch { setError("Erreur réseau."); }
    setLoading(false);
  };

  // Affiche les deux boutons sur desktop, uniquement le pertinent sur mobile
  const showApple = platform === "ios" || platform === "other";
  const showGoogle = platform === "android" || platform === "other";

  // Carte déjà dans le wallet : confirmation discrète + re-téléchargement possible
  if (walletAdded) {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <span className="text-[13px] font-semibold text-emerald-700">✓ Carte dans votre Wallet</span>
          <span className="text-[11.5px] text-emerald-600/70">· mise à jour automatique</span>
        </div>
        <div className="mt-1.5 text-center">
          <button
            onClick={showApple ? handleApple : handleGoogle}
            disabled={loading}
            className="text-[11px] text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
          >
            {loading ? "Génération…" : "Retélécharger la carte"}
          </button>
        </div>
        {error && <p className="mt-1 text-center text-[11px] text-red-500">{error}</p>}
      </div>
    );
  }

  // Pas encore ajoutée : boutons mis en avant
  return (
    <div className="mt-4 space-y-2">
      <p className="text-center text-[12px] font-medium text-amber-600">
        📲 Ajoutez votre carte au Wallet : solde toujours à jour et offres reçues directement sur votre téléphone
      </p>
      {showApple && (
        <button
          onClick={handleApple}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3.5 text-[13.5px] font-semibold text-white hover:bg-gray-900 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          )}
          {loading ? "Génération…" : "Ajouter à Apple Wallet"}
        </button>
      )}

      {showGoogle && (
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3.5 text-[13.5px] font-semibold text-white hover:bg-gray-900 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            /* Google Wallet icon inline */
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#4285F4"/>
              <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" fill="#fff"/>
              <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="#4285F4"/>
            </svg>
          )}
          {loading ? "Génération…" : "Ajouter à Google Wallet"}
        </button>
      )}

      {error && <p className="text-center text-[11px] text-red-500">{error}</p>}
      <p className="text-center text-[11px] text-gray-400">
        Mise à jour automatique à chaque visite
      </p>
    </div>
  );
}
