"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Stamp, Star, CheckCircle, ArrowLeft, Loader2, Camera } from "lucide-react";
import Link from "next/link";

interface CustomerCard { id: string; customerId: string; cardId: string; stamps: number; points: number; }
interface LoyaltyCard { id: string; name: string; loyaltyMode: "stamps" | "points"; stampsRequired: number; pointsPerEuro: number; backgroundColor: string; accentColor: string; }
interface Customer { id: string; name: string; email: string; phone: string; }

export default function ProcessPage() {
  const { customerCardId } = useParams<{ customerCardId: string }>();

  const [status, setStatus] = useState<"loading" | "unauth" | "notfound" | "ready">("loading");
  const [cc, setCC] = useState<CustomerCard | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<"stamp" | "points" | null>(null);
  const [lastPts, setLastPts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Données lues depuis le serveur (le localStorage peut être vide ou périmé,
  // notamment quand le QR est scanné avec l'appareil photo du téléphone)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/register?ccId=${encodeURIComponent(customerCardId)}`);
        if (cancelled) return;
        if (res.status === 401) { setStatus("unauth"); return; }
        if (!res.ok) { setStatus("notfound"); return; }
        const data = await res.json();
        if (!data.customerCard || !data.customer) { setStatus("notfound"); return; }
        setCC(data.customerCard);
        setCustomer(data.customer);
        setCard(data.loyaltyCard ?? {
          id: data.customerCard.cardId, name: "Carte fidélité", loyaltyMode: "stamps",
          stampsRequired: 8, pointsPerEuro: 1, backgroundColor: "#1e293b", accentColor: "#16a34a",
        });
        setStatus("ready");
      } catch { if (!cancelled) setStatus("notfound"); }
    })();
    return () => { cancelled = true; };
  }, [customerCardId]);

  const vibrate = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /**/ } };

  const addStamp = useCallback(async () => {
    if (!cc || !card || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stamp", customerCardId: cc.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Erreur serveur."); return; }
      // La réponse contient le solde serveur — c'est lui qui fait foi
      setCC({ ...cc, stamps: data.stamps ?? cc.stamps + 1, points: data.points ?? cc.points });
      vibrate([30, 40, 30]);
      setDone("stamp");
    } catch { setError("Erreur réseau."); }
    finally { setLoading(false); }
  }, [cc, card, loading]);

  const addPoints = useCallback(async () => {
    if (!cc || !card || loading) return;
    const euros = parseFloat(amount.replace(",", "."));
    if (isNaN(euros) || euros <= 0) return;
    const pts = Math.round(euros * card.pointsPerEuro);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "points", customerCardId: cc.id, points: pts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Erreur serveur."); return; }
      setCC({ ...cc, stamps: data.stamps ?? cc.stamps, points: data.points ?? cc.points + pts });
      setLastPts(pts);
      vibrate([30, 40, 30]);
      setDone("points");
      setAmount("");
    } catch { setError("Erreur réseau."); }
    finally { setLoading(false); }
  }, [cc, card, amount, loading]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (status === "unauth") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <p className="font-semibold text-white">Connexion requise</p>
        <p className="text-sm text-slate-400">Connectez-vous à votre compte commerçant pour créditer ce client.</p>
        <a href={`/login?callbackUrl=${encodeURIComponent(`/process/${customerCardId}`)}`}
          className="rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white">
          Me connecter
        </a>
      </div>
    );
  }

  if (status === "notfound" || !cc || !card || !customer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <p className="font-semibold text-white">Carte introuvable</p>
        <p className="text-sm text-slate-400">Ce QR ne correspond à aucun client de votre commerce.</p>
        <Link href="/dashboard" className="text-sm text-green-400 underline">Retour au dashboard</Link>
      </div>
    );
  }

  const euros = parseFloat(amount.replace(",", "."));
  const previewPts = !isNaN(euros) && euros > 0 ? Math.round(euros * card.pointsPerEuro) : 0;
  const bg = card.backgroundColor ?? "#1e293b";
  const accent = card.accentColor ?? "#16a34a";

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      <div className="px-5 pt-8 pb-6">
        <Link href="/dashboard" className="mb-6 flex items-center gap-1.5 text-sm text-white opacity-60 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold"
            style={{ background: accent, color: "#000" }}>
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{customer.name}</p>
            <p className="text-sm text-white/60">{card.name}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
          {card.loyaltyMode === "stamps" ? (
            <div>
              <p className="mb-1 text-xs text-white/60">Tampons actuels</p>
              <p className="text-2xl font-bold text-white">{cc.stamps} / {card.stampsRequired}</p>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min((cc.stamps / card.stampsRequired) * 100, 100)}%`, background: accent }} />
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs text-white/60">Points actuels</p>
              <p className="text-2xl font-bold text-white">{cc.points.toLocaleString("fr-FR")} pts</p>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[60vh] rounded-t-3xl bg-white px-6 pt-8 pb-10">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {done === "stamp" ? "+1 tampon ajouté !" : `+${lastPts} points ajoutés !`}
            </h2>
            <p className="text-sm text-slate-500">
              {card.loyaltyMode === "stamps"
                ? `${cc.stamps} / ${card.stampsRequired} tampons`
                : `Total : ${cc.points.toLocaleString("fr-FR")} points`}
            </p>
            <p className="text-xs text-slate-400">La carte Wallet du client se met à jour automatiquement.</p>
            <div className="mt-2 flex w-full flex-col gap-2">
              <Link href="/dashboard/scan"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-green-600/20 active:scale-[0.99]">
                <Camera className="h-4 w-4" /> Scanner un autre client
              </Link>
              <button
                onClick={() => setDone(null)}
                className="w-full rounded-2xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Effectuer une autre action
              </button>
            </div>
          </div>
        ) : card.loyaltyMode === "stamps" ? (
          <>
            <h2 className="mb-1 text-lg font-bold text-slate-900">Ajouter un tampon</h2>
            <p className="mb-8 text-sm text-slate-500">Un tampon par visite / achat.</p>
            <button
              onClick={addStamp}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: accent }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Stamp className="h-5 w-5" />}
              {loading ? "Enregistrement…" : "+1 tampon"}
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">
              Après validation : {Math.min(cc.stamps + 1, card.stampsRequired)} / {card.stampsRequired}
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-bold text-slate-900">Montant de l&apos;achat</h2>
            <p className="mb-6 text-sm text-slate-500">{card.pointsPerEuro} point{card.pointsPerEuro > 1 ? "s" : ""} par euro dépensé.</p>
            <div className="relative mb-4">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 pr-14 text-2xl font-bold text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-semibold text-slate-400">€</span>
            </div>
            {previewPts > 0 && (
              <p className="mb-5 text-center text-sm text-slate-500">
                = <strong className="text-green-600">{previewPts} points</strong> à créditer
              </p>
            )}
            <button
              onClick={addPoints}
              disabled={previewPts === 0 || loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
              style={{ background: accent }}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5" />}
              {loading ? "Enregistrement…" : `Valider ${previewPts > 0 ? `+${previewPts} pts` : ""}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
