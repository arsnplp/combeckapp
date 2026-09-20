"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";

/** Clé de report : une fois écarté, on ne réaffiche pas avant 3 jours. */
const SNOOZE_KEY = "comeback_upsell_snooze";
const SNOOZE_DAYS = 3;

/** localStorage peut lever (navigation privée, cookies bloqués) — jamais fatal. */
function isSnoozed(): boolean {
  try {
    const until = window.localStorage.getItem(SNOOZE_KEY);
    return !!until && Date.now() < Number(until);
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400_000));
  } catch {
    /* sans stockage, le popup réapparaîtra — pas bloquant */
  }
}

interface UpsellState {
  eligible: boolean;
  customerCount?: number;
  maxClients?: number | null;
  percentOff?: number;
}

export default function LimitUpsellModal() {
  const [state, setState] = useState<UpsellState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSnoozed()) return;
    let cancelled = false;
    fetch("/api/upsell")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UpsellState | null) => {
        if (cancelled || !d?.eligible) return;
        setState(d);
        setOpen(true);
      })
      .catch(() => {
        /* une offre commerciale ne doit jamais casser le dashboard */
      });
    return () => { cancelled = true; };
  }, []);

  // Échap pour fermer, et on bloque le défilement de la page derrière.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => { snooze(); setOpen(false); };

  if (!open || !state) return null;

  const percent = state.percentOff ?? 50;
  const max = state.maxClients ?? 30;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upsell-titre"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/25"
      >
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute right-3.5 top-3.5 z-10 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Bandeau : la remise, annoncée d'emblée */}
        <div className="relative bg-gradient-to-br from-green-600 to-emerald-700 px-7 pb-8 pt-9 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(circle at 20% 15%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-inset ring-white/25">
              <Sparkles className="h-3 w-3" /> Offre pour vous
            </span>
            <p className="mt-4 text-[52px] font-black leading-none text-white">−{percent} %</p>
            <p className="mt-1.5 text-[13px] font-medium text-green-50/90">sur votre premier mois</p>
          </div>
        </div>

        <div className="px-7 pb-7 pt-6 text-center">
          <h2 id="upsell-titre" className="text-[19px] font-bold leading-snug text-slate-900">
            Vos {max} places sont prises 🎉
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-600">
            Vous avez atteint la limite de clients du plan gratuit — c&apos;est le signe que votre
            programme de fidélité fonctionne vraiment.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
            Si ComeBack vous plaît, on vous offre <strong className="font-semibold text-slate-900">{percent} %
            sur votre premier mois</strong> pour continuer sans limite.
          </p>

          <a
            href="/abonnement"
            onClick={snooze}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-green-600/25 transition-all hover:from-green-700 hover:to-emerald-700 active:scale-[0.98]"
          >
            En profiter <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={close}
            className="mt-2.5 w-full py-2 text-[12.5px] font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
