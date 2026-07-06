"use client";

import { useState, useEffect } from "react";
import { Gift, X, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { ClientCard } from "@/lib/client-lookup";

interface QRData {
  token: string;
  rewardName: string;
  rewardEmoji: string;
  storeName: string;
  cost: number;
  costType: "stamps" | "points" | "referral";
  exp: number;
}

function CountdownTimer({ exp }: { exp: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, exp - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(Math.max(0, exp - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [exp]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isExpiring = remaining < 60000;

  return (
    <div className={`flex items-center gap-1.5 text-[12px] font-medium ${isExpiring ? "text-red-500" : "text-gray-500"}`}>
      <Clock className="h-3.5 w-3.5" />
      {remaining === 0 ? "Expiré" : `Expire dans ${mins}:${secs.toString().padStart(2, "0")}`}
    </div>
  );
}

function QRModal({ qr, onClose }: { qr: QRData; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.default.toDataURL(qr.token, {
        width: 260,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" },
      }).then(setQrDataUrl);
    });
  }, [qr.token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <div className="text-center">
          <span className="text-3xl">{qr.rewardEmoji}</span>
          <h2 className="mt-2 text-[16px] font-bold text-gray-900">{qr.rewardName}</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Chez {qr.storeName}</p>
        </div>

        <div className="mt-5 flex justify-center">
          {qrDataUrl ? (
            <div className="rounded-2xl overflow-hidden border border-gray-100 p-3 bg-white shadow-sm">
              <img src={qrDataUrl} alt="QR Code" width={220} height={220} />
            </div>
          ) : (
            <div className="h-[246px] w-[246px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between px-1">
          <CountdownTimer exp={qr.exp} />
          <span className="text-[11px] text-gray-400">
            -{qr.cost} {qr.costType === "stamps" ? "tampon" + (qr.cost > 1 ? "s" : "") : qr.costType === "referral" ? `pt${qr.cost > 1 ? "s" : ""} parrainage` : "pts"}
          </span>
        </div>

        <p className="mt-3 text-[11px] text-center text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
          Montrez ce QR au comptoir. Il ne peut être utilisé <strong>qu&apos;une seule fois</strong>.
        </p>
      </div>
    </div>
  );
}

interface RewardButtonProps {
  reward: { id: string; name: string; description: string; cost: number; mode: string; emoji: string; referral?: boolean };
  canAfford: boolean;
  customerCardId: string;
}

function RewardButton({ reward, canAfford, customerCardId }: RewardButtonProps) {
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<QRData | null>(null);
  const [error, setError] = useState("");

  const handleRedeem = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCardId, rewardId: reward.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erreur"); setLoading(false); return; }
      setQr(data);
    } catch {
      setError("Erreur réseau.");
    }
    setLoading(false);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{reward.emoji}</span>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">{reward.name}</p>
            {reward.description && (
              <p className="text-[12px] text-gray-400 mt-0.5">{reward.description}</p>
            )}
            <p className="text-[11px] font-semibold text-gray-500 mt-1">
              {reward.cost} {reward.referral
                ? `point${reward.cost > 1 ? "s" : ""} parrainage`
                : reward.mode === "stamps"
                  ? `tampon${reward.cost > 1 ? "s" : ""}`
                  : "points"}
            </p>
          </div>
        </div>
        <button
          onClick={handleRedeem}
          disabled={!canAfford || loading}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all active:scale-95 ${
            canAfford
              ? "bg-gray-900 text-white hover:bg-gray-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          {canAfford ? "Utiliser" : "Insuffisant"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2 -mt-1">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {qr && <QRModal qr={qr} onClose={() => setQr(null)} />}
    </>
  );
}

export default function RedeemSection({
  card,
  customerCardId,
}: {
  card: ClientCard;
  customerCardId: string;
}) {
  const regularRewards = card.rewards.filter((r) => !r.referral);
  const referralRewards = card.rewards.filter((r) => r.referral);

  if (regularRewards.length === 0 && referralRewards.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-[13px] font-semibold text-gray-700 mb-3">Récompenses</p>
        <p className="text-[13px] text-gray-400 bg-white rounded-xl border border-gray-100 px-4 py-4 text-center">
          Aucune récompense disponible pour l&apos;instant.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {regularRewards.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-gray-700 mb-3">Récompenses disponibles</p>
          <div className="space-y-2">
            {regularRewards.map((reward) => {
              const canAfford = reward.mode === "stamps"
                ? card.stamps >= reward.cost
                : card.points >= reward.cost;
              return <RewardButton key={reward.id} reward={reward} canAfford={canAfford} customerCardId={customerCardId} />;
            })}
          </div>
        </div>
      )}
      {referralRewards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-gray-700">Récompenses parrainage</p>
            <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5">
              {card.referralPoints} pt{card.referralPoints > 1 ? "s" : ""} disponible{card.referralPoints > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {referralRewards.map((reward) => {
              const canAfford = card.referralPoints >= reward.cost;
              return <RewardButton key={reward.id} reward={reward} canAfford={canAfford} customerCardId={customerCardId} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
