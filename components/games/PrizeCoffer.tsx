"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChevronDown, Gift } from "lucide-react";

export interface Prize {
  merchantId: string;
  code: string;
  name: string;
  emoji: string;
  wonAt: string;
  storeName: string;
  game: string;
}

/**
 * Le coffre à récompenses de jeu.
 *
 * Replié par défaut : un client qui accumule dix lots ne doit pas avoir à
 * faire défiler dix QR codes pour atteindre les jeux. Chaque lot porte son
 * QR, pas seulement un code à lire à voix haute — c'est le même geste qu'une
 * carte de fidélité, et le commerçant le scanne avec le même scanner.
 *
 * Le QR encode l'identifiant complet du lot. Les huit caractères affichés
 * dessous ne servent qu'au repli manuel, si la caméra refuse.
 */
export default function PrizeCoffer({ prizes, defaultOpen = false }: {
  prizes: Prize[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let annule = false;
    Promise.all(prizes.map(async (p) => [p.code, await QRCode.toDataURL(p.code, {
      width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" },
    })] as const))
      .then((paires) => { if (!annule) setQrs(Object.fromEntries(paires)); })
      .catch(() => {});
    return () => { annule = true; };
  }, [open, prizes]);

  if (prizes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Gift className="h-4 w-4 flex-shrink-0 text-amber-700" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-amber-900">
              Le coffre à récompenses de jeu
            </span>
            <span className="block text-[12px] text-amber-800/70">
              {prizes.length} lot{prizes.length > 1 ? "s" : ""} à utiliser quand vous voulez
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-amber-700 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <p className="text-[12px] text-amber-800/70">
            Faites scanner le QR code en caisse. C&apos;est déjà payé, ça ne vous coûte plus rien.
          </p>
          {prizes.map((p) => (
            <div key={p.code} className="rounded-xl bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold text-slate-900">
                  {p.emoji} {p.name}
                </span>
                <span className="flex-shrink-0 text-[11px] text-slate-400">{p.storeName}</span>
              </div>
              <div className="mt-3 flex flex-col items-center">
                {qrs[p.code] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrs[p.code]} alt={`QR code — ${p.name}`} className="h-40 w-40 rounded-lg" />
                ) : (
                  <div className="h-40 w-40 animate-pulse rounded-lg bg-slate-100" />
                )}
                <p className="mt-2 font-mono text-[12px] tracking-widest text-slate-400">
                  {p.code.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
