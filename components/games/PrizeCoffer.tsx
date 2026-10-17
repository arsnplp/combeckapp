"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChevronDown, Gift, QrCode } from "lucide-react";

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
 * Deux niveaux de repli, parce qu'un client qui accumule dix lots ne doit
 * jamais faire défiler dix QR codes : le coffre s'ouvre sur une simple
 * liste, et c'est en touchant un lot qu'on fait apparaître son QR. Un seul
 * ouvert à la fois — en caisse, on présente un lot, pas une collection.
 *
 * Le QR encode l'identifiant complet du lot. Les huit caractères affichés
 * dessous ne servent qu'au repli manuel, si la caméra refuse.
 */
export default function PrizeCoffer({ prizes, defaultOpen = false }: {
  prizes: Prize[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [actif, setActif] = useState<string | null>(null);
  const [qr, setQr] = useState<{ code: string; data: string } | null>(null);

  // Le QR n'est fabriqué que pour le lot réellement ouvert.
  useEffect(() => {
    if (!actif) { setQr(null); return; }
    let annule = false;
    QRCode.toDataURL(actif, { width: 420, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((data) => { if (!annule) setQr({ code: actif, data }); })
      .catch(() => {});
    return () => { annule = true; };
  }, [actif]);

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
        <div className="px-3 pb-3">
          <p className="px-1 pb-2 text-[12px] text-amber-800/70">
            Touchez un lot pour afficher son QR code, puis faites-le scanner en caisse.
          </p>

          <div className="space-y-1.5">
            {prizes.map((p) => {
              const ouvert = actif === p.code;
              return (
                <div key={p.code} className="overflow-hidden rounded-xl bg-white">
                  <button
                    onClick={() => setActif(ouvert ? null : p.code)}
                    aria-expanded={ouvert}
                    className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
                  >
                    <span className="text-[20px]">{p.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-slate-900">{p.name}</span>
                      <span className="block text-[11.5px] text-slate-400">{p.storeName}</span>
                    </span>
                    <span className={`flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                      ouvert ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      <QrCode className="h-3 w-3" />
                      {ouvert ? "Masquer" : "Afficher"}
                    </span>
                  </button>

                  {ouvert && (
                    <div className="flex flex-col items-center border-t border-slate-100 px-3.5 pb-4 pt-3.5">
                      {qr?.code === p.code ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qr.data} alt={`QR code — ${p.name}`} className="h-48 w-48 rounded-lg" />
                      ) : (
                        <div className="h-48 w-48 animate-pulse rounded-lg bg-slate-100" />
                      )}
                      <p className="mt-2.5 font-mono text-[13px] tracking-widest text-slate-400">
                        {p.code.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">Gagné à {p.game}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
