"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, CreditCard } from "lucide-react";
import { useStore } from "@/lib/store-context";

const STORAGE_PREFIX = "comeback_tour_done_";

interface Step {
  tourId: string;
  href: string;
  text: string;
}

const STEPS: Step[] = [
  {
    tourId: "cartes",
    href: "/carte",
    text: "Commencez ici : créez votre carte de fidélité. Nom, couleurs, points de bienvenue — en 2 minutes c'est prêt.",
  },
  {
    tourId: "cartes",
    href: "/carte",
    text: "Une fois la carte créée, imprimez le QR code associé et posez-le sur votre comptoir : vos clients le scannent pour recevoir leur carte.",
  },
  {
    tourId: "clients",
    href: "/clients",
    text: "Chaque client qui s'inscrit apparaît ici. Vous voyez enfin qui sont vos habitués.",
  },
  {
    tourId: "scanner",
    href: "/dashboard/scan",
    text: "En caisse, scannez la carte du client pour ajouter un point ou débloquer sa récompense.",
  },
  {
    tourId: "notifications",
    href: "/notifications",
    text: "Et le plus puissant : envoyez une notif à vos clients — une offre, une nouveauté, un rappel. C'est ce qui les fait revenir.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export default function OnboardingTour() {
  const { loyaltyCards, settingsReady } = useStore();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0); // 0 = bienvenue, 1..5 = STEPS[step-1]
  const [rect, setRect] = useState<Rect | null>(null);

  // Clé propre à chaque compte : un compte supprimé puis recréé (même
  // navigateur) doit revoir le tour, il ne doit pas hériter du choix d'un
  // ancien compte qui partageait juste le même appareil.
  const userId = session?.user?.id;
  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  useEffect(() => {
    if (!settingsReady) return;
    if (!storageKey) return; // attend que la session soit résolue
    if (loyaltyCards.length > 0) return;
    if (pathname !== "/dashboard") return; // déclenché uniquement à l'arrivée sur le dashboard vide
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return; // tour pensé pour la sidebar desktop
    if (localStorage.getItem(storageKey) === "1") return;
    setVisible(true);
  }, [settingsReady, loyaltyCards.length, pathname, storageKey]);

  // Avance à l'étape n et navigue réellement sur la page concernée, pour que
  // le commerçant voie la vraie page derrière la bulle (pas juste le menu).
  const goToStep = (n: number) => {
    setStep(n);
    if (n >= 1) router.push(STEPS[n - 1].href);
  };

  const updateRect = useCallback(() => {
    if (step === 0) { setRect(null); return; }
    const tourId = STEPS[step - 1].tourId;
    const el = document.querySelector(`[data-tour="${tourId}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [visible, updateRect]);

  const dismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setVisible(false);
  };

  const finish = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setVisible(false);
    router.push("/carte?create=1");
  };

  if (!visible) return null;

  const padding = 8;
  const spotlight = rect ? {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  } : null;

  // Bulle positionnée à droite de l'élément ciblé, centrée verticalement dessus
  const bubbleWidth = 320;
  const bubbleTop = spotlight
    ? Math.min(Math.max(spotlight.top + spotlight.height / 2 - 70, 16), window.innerHeight - 220)
    : 0;
  const bubbleLeft = spotlight ? spotlight.left + spotlight.width + 18 : 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Bloque les interactions avec le reste de l'app pendant le tour */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Halo sombre avec découpe lumineuse sur l'élément ciblé */}
      <AnimatePresence>
        {spotlight && (
          <motion.div
            key="spotlight"
            initial={false}
            animate={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute rounded-2xl"
            style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)" }}
          />
        )}
        {!spotlight && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div className="w-full max-w-[380px] rounded-[28px] bg-white p-8 text-center shadow-2xl">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
                <span className="text-[26px]">👋</span>
              </div>
              <h2 className="text-[19px] font-semibold text-slate-900">Bienvenue !</h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-500">
                En 5 étapes, on vous montre comment lancer votre programme de fidélité.
              </p>
              <button
                onClick={() => goToStep(1)}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-green-700 active:scale-[0.98]"
              >
                C&apos;est parti
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={dismiss}
                className="mt-3 text-[12.5px] font-medium text-slate-400 transition-colors hover:text-slate-600"
              >
                Passer
              </button>
            </div>
          </motion.div>
        ) : (
          spotlight && (
            <motion.div
              key={`bubble-${step}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0, top: bubbleTop, left: bubbleLeft }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="absolute rounded-2xl bg-white p-5 shadow-2xl"
              style={{ width: bubbleWidth }}
            >
              {/* Petite flèche pointant vers l'élément ciblé */}
              <div className="absolute -left-[7px] top-[26px] h-3.5 w-3.5 rotate-45 bg-white" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-green-600">
                  {step}/{STEPS.length}
                </span>
                <button onClick={dismiss} className="text-slate-300 transition-colors hover:text-slate-500">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2.5 text-[14px] leading-relaxed text-slate-700">
                {STEPS[step - 1].text}
              </p>

              {step < STEPS.length ? (
                <button
                  onClick={() => goToStep(step + 1)}
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
                >
                  Suivant
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-green-700 active:scale-[0.98]"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Créer ma première carte
                </button>
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
