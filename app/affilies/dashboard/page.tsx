"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Loader2, Copy, Check, Share2, Download, LogOut, Wallet,
  Users, TrendingUp, Clock, Banknote, ChevronDown, ChevronUp,
} from "lucide-react";

interface DashboardData {
  profile: {
    name: string; commerce: string; email: string; status: string;
    suspensionReason?: string | null;
    bankMethod?: string | null;
    bankDetails?: { iban?: string; bic?: string; paypalEmail?: string } | null;
    onboarded?: boolean;
    goal?: string | null;
  };
  refLink: string;
  referralCode: string;
  tier: {
    current: string; commissionRate: number; monthlyRevenue: number; activeClients: number;
    nextTier: { tier: string; rate: number; revenueNeeded: number } | null;
  };
  wallet: { availableBalance: number; pendingBalance: number; totalEarned: number; totalWithdrawn: number };
  stats: { activeClients: number; churnedClients: number; totalReferred: number };
  clients: Array<{ name: string; plan: string; monthlyPrice: number; status: string; since: string; lastPayment: string | null }>;
  transactions: Array<{ type: string; amount: number; description: string; date: string }>;
  withdrawals: Array<{ id: string; amount: number; status: string; requestedAt: string; paidAt: string | null; adminNotes: string | null }>;
}

const TIER_STYLE: Record<string, { label: string; emoji: string; cls: string }> = {
  bronze:   { label: "Bronze",   emoji: "🥉", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  gold:     { label: "Gold",     emoji: "🥇", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  platinum: { label: "Platinum", emoji: "💎", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

const TX_LABEL: Record<string, string> = {
  commission_added: "Commission",
  pending_to_available: "Déblocage",
  withdrawal_requested: "Demande de retrait",
  withdrawn: "Retrait payé",
  commission_refunded: "Commission annulée",
};

const WD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "En attente", cls: "bg-amber-50 text-amber-600" },
  approved: { label: "Approuvé — paiement sous 2-3 j", cls: "bg-blue-50 text-blue-600" },
  paid:     { label: "Payé", cls: "bg-emerald-50 text-emerald-600" },
  rejected: { label: "Refusé", cls: "bg-red-50 text-red-500" },
};

const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function AffiliateDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wdMessage, setWdMessage] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [bankMethod, setBankMethod] = useState("virement");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankSaved, setBankSaved] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliates/dashboard");
      if (res.status === 401) { router.push("/affilies"); return; }
      const d = await res.json();
      // Onboarding pas encore fait → parcours d'accueil d'abord
      if (d?.profile && d.profile.onboarded === false) { router.push("/affilies/onboarding"); return; }
      setData(d);
      if (d.profile?.bankMethod) setBankMethod(d.profile.bankMethod);
      if (d.profile?.bankDetails?.iban) setIban(d.profile.bankDetails.iban);
      if (d.profile?.bankDetails?.bic) setBic(d.profile.bankDetails.bic);
      if (d.profile?.bankDetails?.paypalEmail) setPaypalEmail(d.profile.bankDetails.paypalEmail);
    } catch { /* réseau */ }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.refLink) {
      QRCode.toDataURL(data.refLink, { width: 220, margin: 1 }).then(setQr).catch(() => {});
    }
  }, [data?.refLink]);

  const copyLink = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({ title: "ComeBack — fidélité digitale", url: data.refLink }).catch(() => {});
    } else copyLink();
  };

  const saveBank = async () => {
    const res = await fetch("/api/affiliates/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankMethod, iban, bic, paypalEmail }),
    });
    if (res.ok) {
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 2000);
      await load();
    }
  };

  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    setWdMessage("");
    try {
      const res = await fetch("/api/affiliates/withdraw", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setWdMessage(d?.error ?? "Erreur.");
      else { setWdMessage(`✅ Demande de ${eur(d.amount)} envoyée — traitement sous 2-3 jours.`); await load(); }
    } catch { setWdMessage("Erreur réseau."); }
    finally { setWithdrawing(false); }
  };

  const logout = async () => {
    await fetch("/api/affiliates/logout", { method: "POST" });
    router.push("/affilies");
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/affiliates/me", { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d?.error ?? "Erreur.");
        setDeleting(false);
        return;
      }
      router.push("/affilies");
    } catch {
      setDeleteError("Erreur réseau.");
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-gray-300" /></div>;
  }

  const tierStyle = TIER_STYLE[data.tier.current] ?? TIER_STYLE.bronze;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-gray-400">Bonjour 👋</p>
          <h1 className="text-[22px] font-bold text-gray-900">{data.profile.name}</h1>
          <p className="text-[13px] text-gray-500">{data.profile.commerce}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700">
          <LogOut className="h-3.5 w-3.5" /> Déconnexion
        </button>
      </div>

      {data.profile.status === "suspended" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          ⚠️ Compte suspendu : {data.profile.suspensionReason ?? "contactez le support"}. Les nouvelles commissions sont gelées.
        </div>
      )}

      {/* Tier — basé sur le CA mensuel généré */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[14px] font-bold ${tierStyle.cls}`}>
            {tierStyle.emoji} {tierStyle.label}
          </span>
          <span className="text-[13px] text-gray-500">
            Commission : <strong className="text-gray-900">{Math.round(data.tier.commissionRate * 100)} %</strong>
          </span>
        </div>
        <p className="mt-2 text-[13px] text-gray-500">
          Vos clients actifs paient <strong className="text-gray-800">{eur(data.tier.monthlyRevenue)}</strong> / mois
          {data.tier.nextTier && (
            <> — encore <strong className="text-gray-800">{eur(data.tier.nextTier.revenueNeeded)}</strong> pour
            passer {TIER_STYLE[data.tier.nextTier.tier]?.label ?? data.tier.nextTier.tier} ({Math.round(data.tier.nextTier.rate * 100)} %) 🔥</>
          )}
        </p>
      </div>

      {/* Cagnotte */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-green-600" />
          <p className="text-[14px] font-semibold text-gray-900">Ma cagnotte</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-green-700/60">Disponible</p>
            <p className="mt-1 text-[24px] font-bold text-green-700">{eur(data.wallet.availableBalance)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-amber-700/60">
              <Clock className="h-3 w-3" /> En attente (18 j)
            </p>
            <p className="mt-1 text-[24px] font-bold text-amber-600">{eur(data.wallet.pendingBalance)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-400">
          <span>Total gagné : <strong className="text-gray-600">{eur(data.wallet.totalEarned)}</strong></span>
          <span>Total retiré : <strong className="text-gray-600">{eur(data.wallet.totalWithdrawn)}</strong></span>
        </div>

        <button
          onClick={withdraw}
          disabled={withdrawing || data.wallet.availableBalance < 20}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-[13.5px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-all"
        >
          {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
          Demander le retrait ({eur(data.wallet.availableBalance)})
        </button>
        {data.wallet.availableBalance < 20 && (
          <p className="mt-1.5 text-center text-[11px] text-gray-400">Minimum de retrait : 20 €</p>
        )}
        {wdMessage && <p className="mt-2 text-center text-[12.5px] text-gray-600">{wdMessage}</p>}

        {/* Retraits en cours */}
        {data.withdrawals.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-gray-50 pt-3">
            {data.withdrawals.slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-gray-500">{new Date(w.requestedAt).toLocaleDateString("fr-FR")} — {eur(w.amount)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${WD_STATUS[w.status]?.cls ?? ""}`}>
                  {WD_STATUS[w.status]?.label ?? w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infos de paiement */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <button onClick={() => setShowBank((v) => !v)} className="flex w-full items-center justify-between">
          <p className="text-[14px] font-semibold text-gray-900">
            💳 Mes informations de paiement
            {!data.profile.bankMethod && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">À compléter</span>}
          </p>
          {showBank ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showBank && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              {(["virement", "wise", "paypal"] as const).map((m) => (
                <button key={m} onClick={() => setBankMethod(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors ${bankMethod === m ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
                  {m === "virement" ? "Virement" : m === "wise" ? "Wise" : "PayPal"}
                </button>
              ))}
            </div>
            {bankMethod === "paypal" ? (
              <input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="Email PayPal"
                className="h-11 w-full rounded-xl border border-gray-200 px-3.5 text-[13.5px] outline-none focus:border-green-400" />
            ) : (
              <>
                <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3.5 text-[13.5px] outline-none focus:border-green-400" />
                <input value={bic} onChange={(e) => setBic(e.target.value)} placeholder="BIC (optionnel)"
                  className="h-11 w-full rounded-xl border border-gray-200 px-3.5 text-[13.5px] outline-none focus:border-green-400" />
              </>
            )}
            <button onClick={saveBank}
              className="h-10 w-full rounded-xl bg-gray-900 text-[13px] font-semibold text-white hover:bg-gray-800">
              {bankSaved ? "✓ Enregistré" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      {/* Lien de parrainage */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="mb-3 text-[14px] font-semibold text-gray-900">🔗 Votre lien partenaire</p>
        <p className="break-all rounded-xl bg-gray-50 px-3.5 py-2.5 text-[12.5px] text-gray-600">{data.refLink}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={copyLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié !" : "Copier"}
          </button>
          <button onClick={() => setShowQr((v) => !v)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
            QR Code
          </button>
          <button onClick={shareLink}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
            <Share2 className="h-3.5 w-3.5" /> Partager
          </button>
        </div>
        {showQr && qr && (
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR lien partenaire" className="h-44 w-44 rounded-xl ring-1 ring-black/[0.06]" />
          </div>
        )}
      </div>

      {/* Clients */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
            <Users className="h-4 w-4 text-green-600" /> Mes clients
          </p>
          <p className="text-[12px] text-gray-400">
            {data.stats.activeClients} actif{data.stats.activeClients > 1 ? "s" : ""} · {data.stats.churnedClients} parti{data.stats.churnedClients > 1 ? "s" : ""}
          </p>
        </div>
        {data.clients.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-gray-400">
            Aucun client pour l'instant — partagez votre lien pour commencer à gagner.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.clients.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[13.5px] font-medium text-gray-800">{c.name}</p>
                  <p className="text-[11.5px] text-gray-400">
                    Plan {c.plan} · depuis le {new Date(c.since).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                  {c.status === "active" ? "Actif" : "Parti"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <button onClick={() => setShowTx((v) => !v)} className="flex w-full items-center justify-between">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
            <TrendingUp className="h-4 w-4 text-green-600" /> Historique
          </p>
          {showTx ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showTx && (
          <>
            <div className="mt-3 divide-y divide-gray-50">
              {data.transactions.length === 0 && (
                <p className="py-3 text-center text-[13px] text-gray-400">Aucune opération.</p>
              )}
              {data.transactions.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] text-gray-700">{TX_LABEL[t.type] ?? t.type}</p>
                    <p className="text-[11px] text-gray-400">{t.description} · {new Date(t.date).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`text-[13.5px] font-semibold ${["commission_added", "pending_to_available"].includes(t.type) ? "text-emerald-600" : t.type === "commission_refunded" ? "text-red-500" : "text-gray-600"}`}>
                    {["commission_refunded", "withdrawn", "withdrawal_requested"].includes(t.type) ? "−" : "+"}{eur(t.amount)}
                  </span>
                </div>
              ))}
            </div>
            <a href="/api/affiliates/export"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50">
              <Download className="h-3.5 w-3.5" /> Exporter en CSV
            </a>
          </>
        )}
      </div>

      <p className="text-center text-[11px] text-gray-300">
        Commission de {Math.round(data.tier.commissionRate * 100)} % sur chaque paiement, débloquée après 18 jours de garantie.
      </p>

      {/* ── Suppression du compte (RGPD) ── */}
      <div className="pb-6">
        {!confirmDelete ? (
          <div className="text-center">
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11.5px] text-gray-300 underline transition-colors hover:text-red-500"
            >
              Supprimer mon compte partenaire
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <p className="text-[13.5px] font-semibold text-red-800">
              Supprimer définitivement votre compte partenaire ?
            </p>
            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-red-700/80">
              <li>• Votre cagnotte sera <strong>définitivement perdue</strong>
                {(data.wallet.availableBalance > 0 || data.wallet.pendingBalance > 0) &&
                  <> ({eur(data.wallet.availableBalance + data.wallet.pendingBalance)} actuellement)</>}
                {" "}— faites d&apos;abord un retrait si besoin</li>
              <li>• Les demandes de retrait en cours seront annulées</li>
              <li>• Votre lien partenaire cessera de fonctionner, plus aucune commission future</li>
              <li>• Votre historique est anonymisé (obligation comptable) — action irréversible</li>
            </ul>
            {deleteError && <p className="mt-2 text-[12px] font-medium text-red-600">{deleteError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Supprimer définitivement
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
