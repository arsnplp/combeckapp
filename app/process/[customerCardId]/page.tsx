"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Stamp, Star, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface CustomerCard { id: string; customerId: string; cardId: string; stamps: number; points: number; }
interface LoyaltyCard { id: string; name: string; loyaltyMode: "stamps" | "points"; stampsRequired: number; pointsPerEuro: number; backgroundColor: string; accentColor: string; }
interface Customer { id: string; name: string; email: string; phone: string; }

function loadLocal<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveLocal<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export default function ProcessPage() {
  const { customerCardId } = useParams<{ customerCardId: string }>();

  const [cc, setCC] = useState<CustomerCard | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<"stamp" | "points" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ccs: CustomerCard[] = loadLocal("cc_customer_cards", []);
    const found = ccs.find((c) => c.id === customerCardId);
    if (!found) return;
    setCC(found);

    const cards: LoyaltyCard[] = loadLocal("cc_loyalty_cards", []);
    const c = cards.find((c) => c.id === found.cardId);
    if (c) setCard(c);

    const customers: Customer[] = loadLocal("cc_customers", []);
    const cu = customers.find((c) => c.id === found.customerId);
    if (cu) setCustomer(cu);
  }, [customerCardId]);

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
      if (!res.ok) { setError("Erreur serveur."); return; }

      const newStamps = Math.min(cc.stamps + 1, card.stampsRequired);
      const updated = { ...cc, stamps: newStamps, lastActivity: new Date().toISOString() };
      setCC(updated);
      const ccs: CustomerCard[] = loadLocal("cc_customer_cards", []);
      saveLocal("cc_customer_cards", ccs.map((c) => c.id === cc.id ? updated : c));
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
      if (!res.ok) { setError("Erreur serveur."); return; }

      const updated = { ...cc, points: cc.points + pts, lastActivity: new Date().toISOString() };
      setCC(updated);
      const ccs: CustomerCard[] = loadLocal("cc_customer_cards", []);
      saveLocal("cc_customer_cards", ccs.map((c) => c.id === cc.id ? updated : c));
      setDone("points");
    } catch { setError("Erreur réseau."); }
    finally { setLoading(false); }
  }, [cc, card, amount, loading]);

  const bg = card?.backgroundColor ?? "#1e293b";
  const accent = card?.accentColor ?? "#2563eb";

  if (!cc || !card || !customer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-center px-6">
        <p className="text-white font-semibold">Carte introuvable</p>
        <p className="text-slate-400 text-sm">Ce QR n'est pas reconnu ou la carte a été retirée.</p>
        <Link href="/dashboard" className="text-green-400 text-sm underline">Retour au dashboard</Link>
      </div>
    );
  }

  const euros = parseFloat(amount.replace(",", "."));
  const previewPts = !isNaN(euros) && euros > 0 ? Math.round(euros * card.pointsPerEuro) : 0;

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      <div className="px-5 pt-8 pb-6">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm mb-6 opacity-60 hover:opacity-100 text-white">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center text-base font-bold"
            style={{ background: accent, color: "#000" }}>
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-white text-lg">{customer.name}</p>
            <p className="text-white/60 text-sm">{card.name}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.1)" }}>
          {card.loyaltyMode === "stamps" ? (
            <div>
              <p className="text-white/60 text-xs mb-1">Tampons actuels</p>
              <p className="text-white text-2xl font-bold">{cc.stamps} / {card.stampsRequired}</p>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min((cc.stamps / card.stampsRequired) * 100, 100)}%`, background: accent }} />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white/60 text-xs mb-1">Points actuels</p>
              <p className="text-white text-2xl font-bold">{cc.points.toLocaleString("fr-FR")} pts</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-t-3xl bg-white min-h-[60vh] px-6 pt-8 pb-10">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {done === "stamp" ? "+1 tampon ajouté !" : `+${previewPts > 0 ? previewPts : "..."} points ajoutés !`}
            </h2>
            <p className="text-sm text-slate-500">
              {card.loyaltyMode === "stamps"
                ? `${cc.stamps} / ${card.stampsRequired} tampons`
                : `Total : ${cc.points.toLocaleString("fr-FR")} points`}
            </p>
            <p className="text-xs text-slate-400">La carte Wallet du client se met à jour automatiquement.</p>
            <button
              onClick={() => setDone(null)}
              className="mt-4 rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Effectuer une autre action
            </button>
          </div>
        ) : card.loyaltyMode === "stamps" ? (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Ajouter un tampon</h2>
            <p className="text-sm text-slate-500 mb-8">Un tampon par visite / achat.</p>
            <button
              onClick={addStamp}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-5 text-white font-semibold text-base transition active:scale-[0.98] disabled:opacity-60"
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
            <h2 className="text-lg font-bold text-slate-900 mb-1">Montant de l'achat</h2>
            <p className="text-sm text-slate-500 mb-6">{card.pointsPerEuro} point{card.pointsPerEuro > 1 ? "s" : ""} par euro dépensé.</p>
            <div className="relative mb-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-bold text-slate-900 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 pr-14"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-semibold text-slate-400">€</span>
            </div>
            {previewPts > 0 && (
              <p className="text-center text-sm text-slate-500 mb-5">
                = <strong className="text-green-600">{previewPts} points</strong> à créditer
              </p>
            )}
            <button
              onClick={addPoints}
              disabled={previewPts === 0 || loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-white font-semibold text-base transition active:scale-[0.98] disabled:opacity-40"
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
