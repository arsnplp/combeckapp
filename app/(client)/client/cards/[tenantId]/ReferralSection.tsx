"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Share2 } from "lucide-react";

interface Props {
  cardId: string;
  cardName: string;
  loyaltyMode: "stamps" | "points";
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  welcomeMessage: string;
  backgroundColor: string;
  accentColor: string;
  customerCardId: string;
  referral: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
  referralCount: number;
  referralPoints: number;
}

export default function ReferralSection({
  cardId, cardName, loyaltyMode, stampsRequired, pointsPerEuro,
  welcomePoints, welcomeMessage, backgroundColor, accentColor,
  customerCardId, referral, referralCount, referralPoints,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    const cardData = JSON.stringify({
      id: cardId, name: cardName, welcomeMessage: welcomeMessage || "",
      backgroundColor, accentColor, textColor: "#ffffff",
      loyaltyMode, stampsRequired, pointsPerEuro, welcomePoints,
    });
    const utf8Bytes = new TextEncoder().encode(cardData);
    let binary = "";
    utf8Bytes.forEach((b) => { binary += String.fromCharCode(b); });
    const d = btoa(binary);
    const url = `${origin}/join/${cardId}?d=${encodeURIComponent(d)}&ref=${customerCardId}`;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [cardId, cardName, welcomeMessage, backgroundColor, accentColor, loyaltyMode, stampsRequired, pointsPerEuro, welcomePoints, customerCardId]);

  const handleShare = async () => {
    const origin = window.location.origin;
    const cardData = JSON.stringify({
      id: cardId, name: cardName, welcomeMessage: welcomeMessage || "",
      backgroundColor, accentColor, textColor: "#ffffff",
      loyaltyMode, stampsRequired, pointsPerEuro, welcomePoints,
    });
    const utf8Bytes = new TextEncoder().encode(cardData);
    let binary = "";
    utf8Bytes.forEach((b) => { binary += String.fromCharCode(b); });
    const d = btoa(binary);
    const url = `${origin}/join/${cardId}?d=${encodeURIComponent(d)}&ref=${customerCardId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Rejoins ${cardName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg flex-shrink-0"
          style={{ background: accentColor + "20" }}
        >
          🤝
        </div>
        <div>
          <p className="text-[15px] font-semibold text-slate-900">Programme parrainage</p>
          <p className="text-[12px] text-slate-400">1 point de parrainage par ami invité</p>
        </div>
      </div>

      {/* Compteurs — toujours visibles (le client garde ses points acquis
          même si le commerçant désactive le programme) */}
      <div className="flex items-center justify-around py-3 mb-4 rounded-xl bg-slate-50">
        <div className="text-center">
          <p className="text-[26px] font-bold text-slate-900">{referralCount}</p>
          <p className="text-[11px] text-slate-400">ami{referralCount > 1 ? "s" : ""} parrainé{referralCount > 1 ? "s" : ""}</p>
        </div>
        <div className="h-10 w-px bg-slate-200" />
        <div className="text-center">
          <p className="text-[26px] font-bold text-slate-900">{referralPoints}</p>
          <p className="text-[11px] text-slate-400">point{referralPoints > 1 ? "s" : ""} disponible{referralPoints > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* QR + partage — uniquement si le programme est actif */}
      {referral.enabled ? (
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-black/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR parrainage" className="h-36 w-36" />
            </div>
          ) : (
            <div className="h-44 w-44 animate-pulse rounded-2xl bg-slate-100" />
          )}
          <p className="text-center text-[12px] text-slate-400 leading-relaxed max-w-[220px]">
            Faites scanner ce QR à un ami. Il obtient sa carte et vous gagnez 1 point de parrainage.
          </p>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Share2 className="h-4 w-4" />
            {copied ? "Lien copié !" : "Partager le lien"}
          </button>
        </div>
      ) : (
        <p className="text-center text-[12px] text-slate-400">
          Le programme de parrainage est actuellement désactivé — vos points restent utilisables.
        </p>
      )}
    </div>
  );
}
