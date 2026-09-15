"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Store, ChevronRight, LogOut, ScanLine } from "lucide-react";

interface MerchantEntry {
  merchantId: string;
  storeName: string;
  city: string;
  active: boolean;
  lastAccessAt: string | null;
}

export default function EmployeeHome() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<MerchantEntry[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MerchantEntry | null>(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/me");
      if (!res.ok) { router.push("/employe/login"); return; }
      const data = await res.json();
      setName(data.name || data.email);
      setMerchants(data.merchants ?? []);
      // Commerce déjà déverrouillé (service en cours) → droit au scan
      if (data.unlockedMerchantId) router.push(`/employe/scan`);
    } catch { /* réseau : on laisse la liste vide */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || unlocking) return;
    setUnlocking(true); setError("");
    try {
      const res = await fetch("/api/employee/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: selected.merchantId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? "Accès refusé."); setUnlocking(false); return; }
      router.push("/employe/scan");
    } catch {
      setError("Erreur réseau.");
      setUnlocking(false);
    }
  };

  const leave = async (merchantId: string) => {
    setLeaving(merchantId);
    await fetch("/api/employee/leave", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId }),
    }).catch(() => {});
    setLeaving("");
    setSelected(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Saisie du mot de passe d'accès ──
  if (selected) {
    return (
      <div>
        <button onClick={() => { setSelected(null); setPassword(""); setError(""); }}
          className="-ml-1 mb-5 text-sm text-gray-400 transition-colors hover:text-gray-700">
          ← Retour
        </button>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[15px] font-bold text-white">
            {selected.storeName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-gray-900">{selected.storeName}</p>
            {selected.city && <p className="text-[12px] text-gray-400">{selected.city}</p>}
          </div>
        </div>

        <form onSubmit={unlock} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe d'accès" autoComplete="off"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-[14px] text-gray-900 placeholder-gray-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500">{error}</p>
          )}
          <button type="submit" disabled={unlocking || !password}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[14px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50">
            {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ScanLine className="h-4 w-4" /> Accéder au scan</>}
          </button>
          <p className="text-center text-[11.5px] text-gray-400">
            Ce mot de passe vous a été donné par le commerce. Il est demandé une
            fois par service, pas à chaque scan.
          </p>
        </form>

        <button
          onClick={() => leave(selected.merchantId)}
          disabled={leaving === selected.merchantId}
          className="mt-8 flex w-full items-center justify-center gap-1.5 text-[12px] text-gray-400 underline transition-colors hover:text-red-500"
        >
          {leaving === selected.merchantId && <Loader2 className="h-3 w-3 animate-spin" />}
          Quitter ce commerce
        </button>
      </div>
    );
  }

  // ── Liste des commerces ──
  return (
    <div>
      <div className="mb-6">
        <p className="text-[13px] font-medium text-gray-400">Bonjour 👋</p>
        <h1 className="mt-0.5 text-[22px] font-bold text-gray-900">{name}</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {merchants.length === 0
            ? "Aucun commerce pour l'instant"
            : `${merchants.length} commerce${merchants.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {merchants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
            <Store className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-[15px] font-semibold text-gray-900">En attente d&apos;un employeur</p>
          <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-relaxed text-gray-500">
            Demandez au commerce de vous ajouter avec votre email. Le commerce
            apparaîtra ici automatiquement.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {merchants.map((m) => (
            <button
              key={m.merchantId}
              onClick={() => { setSelected(m); setPassword(""); setError(""); }}
              className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:border-gray-200 hover:shadow-sm active:scale-[0.99]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[13px] font-bold text-white">
                {m.storeName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-gray-900">{m.storeName}</p>
                {m.city && <p className="text-[12px] text-gray-400">{m.city}</p>}
              </div>
              <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </button>
          ))}
        </div>
      )}

      <button
        onClick={async () => {
          await fetch("/api/employee/logout", { method: "POST" }).catch(() => {});
          window.location.href = "/employe/login";
        }}
        className="mt-10 flex w-full items-center justify-center gap-1.5 text-[12px] text-gray-400 transition-colors hover:text-gray-600"
      >
        <LogOut className="h-3 w-3" /> Se déconnecter
      </button>
    </div>
  );
}
