"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Smartphone, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "cb_a2hs_dismissed";
const AUTOSHOW_KEY = "cb_a2hs_tuto_shown";

const STEPS = [
  { src: "/tuto/etape-1.jpg", caption: "Ouvrez le menu ••• en bas de Safari" },
  { src: "/tuto/etape-2.jpg", caption: "Appuyez sur « Partager »" },
  { src: "/tuto/etape-3.jpg", caption: "Choisissez « Sur l'écran d'accueil »" },
  { src: "/tuto/etape-4.jpg", caption: "Appuyez sur « Ajouter » — c'est fait !" },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── Carrousel plein écran du tuto ─────────────────────────────────────────────

function TutoModal({ startIndex, welcome, installEvent, onInstall, onClose }: {
  startIndex: number;
  welcome: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  onInstall: () => void;
  onClose: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  // Bloque le scroll de la page derrière
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Positionne le carrousel sur l'étape demandée à l'ouverture
  useEffect(() => {
    const el = trackRef.current;
    if (el && startIndex > 0) el.scrollLeft = startIndex * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95"
    >
      {/* En-tête */}
      <div className="flex items-start gap-3 px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          {welcome ? (
            <>
              <p className="flex items-center gap-1.5 text-[15px] font-bold text-white">
                <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-300" />
                Bienvenue ! Ajoutez un raccourci 📲
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
                Pour ne plus avoir besoin de chercher le lien : vos cartes s'ouvriront
                d'un tap depuis votre écran d'accueil.
              </p>
            </>
          ) : (
            <p className="text-[15px] font-bold text-white">Ajouter ComeBack à l'écran d'accueil</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          aria-label="Fermer le tuto"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Android : installation native en 1 bouton */}
      {installEvent && (
        <div className="px-5 pb-1">
          <button
            onClick={onInstall}
            className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-green-500/25 active:scale-[0.99]"
          >
            Installer l'app en 1 clic
          </button>
          <p className="mt-1.5 text-center text-[11px] text-white/40">ou suivez le tuto ci-dessous</p>
        </div>
      )}

      {/* Carrousel (glissez horizontalement) */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step, i) => (
          <div key={i} className="flex w-full flex-shrink-0 snap-center flex-col items-center justify-center gap-3 px-6 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.src}
              alt={`Étape ${i + 1}`}
              className="max-h-[62vh] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl"
              loading={i === startIndex ? "eager" : "lazy"}
            />
            <p className="text-center text-[13.5px] font-medium text-white">
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[11px] font-bold">{i + 1}</span>
              {step.caption}
            </p>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6 px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 active:bg-white/20"
          aria-label="Étape précédente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-green-400" : "w-2 bg-white/25"}`}
              aria-label={`Étape ${i + 1}`}
            />
          ))}
        </div>
        {index < STEPS.length - 1 ? (
          <button
            onClick={() => goTo(index + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 active:scale-95"
            aria-label="Étape suivante"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-full bg-green-500 px-5 text-[13px] font-bold text-white shadow-lg shadow-green-500/30 active:scale-95"
          >
            J'ai compris
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Bandeau + auto-ouverture à la première visite ─────────────────────────────

export default function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [modal, setModal] = useState<{ index: number; welcome: boolean } | null>(null);

  useEffect(() => {
    // Déjà installée (mode standalone) → rien à proposer
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Android/Chrome : intercepter l'événement d'installation natif
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);

    // Première arrivée sur l'espace (compte tout juste créé) → tuto en grand
    if (!localStorage.getItem(AUTOSHOW_KEY)) {
      localStorage.setItem(AUTOSHOW_KEY, "1");
      const t = setTimeout(() => setModal({ index: 0, welcome: true }), 600);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") { setVisible(false); setModal(null); }
  };

  return (
    <>
      {visible && (
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-4 shadow-lg shadow-green-600/20">
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 text-white/50 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 pr-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-11 w-11 flex-shrink-0 rounded-xl bg-white shadow-md" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-white">
                <Smartphone className="h-4 w-4 flex-shrink-0" />
                Ajoutez l'app à votre téléphone
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-white/75">
                Vos cartes en 1 tap, sans chercher le lien.
              </p>
            </div>
          </div>

          {/* Mini-carrousel du tuto — cliquez pour voir en grand */}
          <div className="mt-3 flex gap-2">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setModal({ index: i, welcome: false })}
                className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-white/20 active:scale-95 transition-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={step.src} alt={`Étape ${i + 1}`} className="h-20 w-full object-cover object-top" loading="lazy" />
                <span className="absolute bottom-1 left-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>

          {installEvent ? (
            <button
              onClick={install}
              className="mt-3 w-full rounded-xl bg-white py-2.5 text-[13px] font-bold text-green-700 shadow-sm active:scale-[0.99]"
            >
              Installer l'app en 1 clic
            </button>
          ) : (
            <button
              onClick={() => setModal({ index: 0, welcome: false })}
              className="mt-3 w-full rounded-xl bg-white py-2.5 text-[13px] font-bold text-green-700 shadow-sm active:scale-[0.99]"
            >
              Voir le tuto (30 secondes)
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <TutoModal
            startIndex={modal.index}
            welcome={modal.welcome}
            installEvent={installEvent}
            onInstall={install}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
