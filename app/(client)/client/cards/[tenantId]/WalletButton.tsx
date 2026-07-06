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

export default function WalletButton({ ccId }: { ccId: string }) {
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
      window.open(data.url, "_blank", "noopener");
    } catch { setError("Erreur réseau."); }
    setLoading(false);
  };

  // Affiche les deux boutons sur desktop, uniquement le pertinent sur mobile
  const showApple = platform === "ios" || platform === "other";
  const showGoogle = platform === "android" || platform === "other";

  return (
    <div className="mt-4 space-y-2">
      {showApple && (
        <button
          onClick={handleApple}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/apple-wallet-badge.svg" alt="" className="h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {loading ? "Génération…" : "Ajouter à Apple Wallet"}
        </button>
      )}

      {showGoogle && (
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50"
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
