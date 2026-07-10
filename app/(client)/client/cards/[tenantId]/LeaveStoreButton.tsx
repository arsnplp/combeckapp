"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

export default function LeaveStoreButton({ tenantId, storeName }: { tenantId: string; storeName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const leave = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Erreur.");
        setLoading(false);
        return;
      }
      router.push("/client/cards");
      router.refresh();
    } catch {
      setError("Erreur réseau.");
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <div className="mt-8 text-center">
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 underline hover:text-red-500 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Quitter ce commerce et supprimer mes données
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-red-100 bg-red-50/60 p-4">
      <p className="text-[13.5px] font-semibold text-red-800">
        Quitter {storeName} ?
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-red-700/80">
        Vos tampons, points, points de parrainage et votre historique chez ce commerce
        seront <strong>définitivement supprimés</strong>. Votre compte ComeBack et vos
        cartes des autres commerces sont conservés. La carte dans votre Wallet cessera
        de fonctionner (supprimez-la manuellement de votre téléphone).
      </p>
      {error && <p className="mt-2 text-[12px] text-red-600 font-medium">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={leave}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Supprimer définitivement
        </button>
        <button
          onClick={() => { setConfirming(false); setError(""); }}
          disabled={loading}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
