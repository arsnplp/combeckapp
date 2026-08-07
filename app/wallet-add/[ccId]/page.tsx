"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

// Page publique (pas d'auth requise, seul ccId identifie la carte — même
// modèle de confiance que /api/client/cards/wallet et /api/wallet/google-pass,
// déjà publiques). Destinée à être ouverte via le QR affiché sur ordinateur :
// Apple/Google Wallet n'existent que sur mobile, donc un client sur PC doit
// scanner pour continuer sur son téléphone plutôt que cliquer un bouton qui
// ne peut rien faire sur un ordinateur.
export default function WalletAddPage() {
  const { ccId } = useParams<{ ccId: string }>();
  const [platform, setPlatform] = useState<Platform>("other");
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { setPlatform(detectPlatform()); }, []);

  const handleApple = useCallback(() => {
    setLoading("apple");
    setError("");
    // Redirection directe : Safari iOS gère nativement le téléchargement d'un
    // .pkpass et propose "Ajouter à Apple Wallet" sans étape intermédiaire.
    window.location.href = `/api/client/cards/wallet?ccId=${ccId}`;
  }, [ccId]);

  const handleGoogle = useCallback(async () => {
    setLoading("google");
    setError("");
    try {
      const res = await fetch(`/api/wallet/google-pass?ccId=${ccId}`);
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error ?? "Erreur Google Wallet."); setLoading(null); return; }
      window.location.href = data.url;
    } catch {
      setError("Erreur réseau.");
      setLoading(null);
    }
  }, [ccId]);

  const showApple = platform === "ios" || platform === "other";
  const showGoogle = platform === "android" || platform === "other";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
          <span className="text-[22px]">📲</span>
        </div>
        <h1 className="text-[17px] font-bold text-slate-900">Ajoutez votre carte au Wallet</h1>
        <p className="mt-1.5 text-[13px] text-slate-500">Solde et offres toujours à jour, directement sur votre téléphone.</p>

        <div className="mt-6 space-y-2.5">
          {showApple && (
            <button
              onClick={handleApple}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60 transition-opacity"
            >
              {loading === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
              )}
              {loading === "apple" ? "Génération…" : "Ajouter à Apple Wallet"}
            </button>
          )}
          {showGoogle && (
            <button
              onClick={handleGoogle}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60 transition-opacity"
            >
              {loading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#4285F4" />
                  <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" fill="#fff" />
                  <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="#4285F4" />
                </svg>
              )}
              {loading === "google" ? "Génération…" : "Ajouter à Google Wallet"}
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}
