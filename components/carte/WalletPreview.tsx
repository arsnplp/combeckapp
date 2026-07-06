"use client";

import type { LoyaltyCard } from "@/types";
import { useStore } from "@/lib/store-context";

interface WalletPreviewProps {
  card: LoyaltyCard;
  currentStamps?: number;
  points?: number;
  clientName?: string;
  qrDataUrl?: string;
  campaignMessage?: string;
}

// Faithful replica of Apple Wallet generic pass layout
export default function WalletPreview({
  card,
  currentStamps = 0,
  points = 0,
  clientName = "Ehjejenn",
  qrDataUrl,
  campaignMessage,
}: WalletPreviewProps) {
  const { settings } = useStore();
  const bg = card.backgroundColor || "#1a0a00";
  const accent = card.accentColor || "#f59e0b";
  const storeName = settings.name || card.name || "Ma Boutique";
  const logoUrl = settings.logoUrl ? `/api/settings/logo?t=${settings.logoUrl}` : null;

  const isStamps = card.loyaltyMode === "stamps";
  const stampsRequired = card.stampsRequired || 8;

  // Background gradient matching the generated background.png
  const bgStyle = `linear-gradient(160deg, ${bg}cc 0%, ${bg} 60%)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>

      {/* iPhone shell */}
      <div style={{
        width: 290,
        background: "#0a0a0a",
        borderRadius: 40,
        border: "7px solid #1a1a1a",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Status bar */}
        <div style={{ height: 28, background: "#000", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <span style={{ fontSize: 10, color: "#ccc", fontWeight: 700 }}>9:41</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#ccc" }}>●●●</span>
            <span style={{ fontSize: 9, color: "#4ade80" }}>▮</span>
          </div>
        </div>

        {/* Wallet top bar */}
        <div style={{ padding: "5px 14px 4px", background: "#000", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#444" }}>‹ Wallet</span>
          <span style={{ fontSize: 8, color: "#555" }}>Carte Fidélité</span>
          <span style={{ width: 20 }} />
        </div>

        {/* Pass card */}
        <div style={{
          margin: "0 8px 10px",
          borderRadius: 18,
          background: bgStyle,
          overflow: "hidden",
          boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
          position: "relative",
        }}>
          {/* Decorative glow top-right */}
          <div style={{ position: "absolute", top: -40, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${accent}10`, pointerEvents: "none" }} />
          {/* Halftone pattern bottom-left (simplified) */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: 100, height: 100, opacity: 0.15, background: `radial-gradient(circle, ${accent} 1.5px, transparent 1.5px) 0 0 / 12px 12px`, pointerEvents: "none" }} />

          {/* ── Header: logo + store name ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: logoUrl ? "transparent" : `${accent}20`, border: `1px solid ${accent}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {logoUrl
                ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> // eslint-disable-line @next/next/no-img-element
                : <span style={{ fontSize: 14, color: accent }}>♛</span>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.01em" }}>{storeName}</span>
          </div>

          {/* ── Primary field: client name ── */}
          <div style={{ padding: "4px 14px 2px" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{clientName}</p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2, letterSpacing: "0.06em" }}>CLIENT</p>
          </div>

          {/* ── Stamps circles OR points bar ── */}
          <div style={{ padding: "10px 14px 4px" }}>
            {isStamps ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Array.from({ length: stampsRequired }).map((_, i) => (
                  <div key={i} style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: i < currentStamps ? accent : "none",
                    border: `1.5px solid ${accent}`,
                    opacity: i < currentStamps ? 0.85 : 0.35,
                  }} />
                ))}
              </div>
            ) : (
              <div>
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ width: `${Math.min((points / 300) * 100, 100)}%`, height: "100%", background: accent, opacity: 0.8, borderRadius: 4 }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Secondary field: TAMPONS or POINTS ── */}
          <div style={{ padding: "2px 14px 10px" }}>
            <p style={{ fontSize: 8, color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {isStamps ? "TAMPONS" : "POINTS"}
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 1 }}>
              {isStamps ? `${currentStamps} / ${stampsRequired}` : points.toLocaleString("fr-FR")}
            </p>
          </div>

          {/* ── Notification bar ── */}
          <div style={{
            margin: "0 10px 10px",
            borderRadius: 14,
            background: `${accent}12`,
            border: `1px solid ${accent}30`,
            padding: "9px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${accent}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12 }}>🔔</span>
            </div>
            <div style={{ width: 1, height: 28, background: `${accent}25`, flexShrink: 0 }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: campaignMessage ? "rgba(255,255,255,0.92)" : `${accent}40`, lineHeight: 1.3, flex: 1 }}>
              {campaignMessage || "Aucune notification"}
            </p>
          </div>

          {/* ── QR code ── */}
          <div style={{ padding: "4px 14px 14px", display: "flex", justifyContent: "center" }}>
            {qrDataUrl ? (
              <div style={{ width: 110, height: 110, borderRadius: 10, background: "#fff", padding: 5 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR" width={100} height={100} style={{ display: "block", borderRadius: 6 }} />
              </div>
            ) : (
              <div style={{ width: 110, height: 110, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: `1px dashed ${accent}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 28, opacity: 0.2 }}>⬜</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 10, color: "#64748b" }}>Aperçu fidèle Apple Wallet</p>
    </div>
  );
}
