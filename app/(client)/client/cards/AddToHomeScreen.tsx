"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare } from "lucide-react";

const DISMISS_KEY = "cb_a2hs_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Déjà installée (mode standalone) ou déjà refusée → rien
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    if (ios) {
      // iOS : pas d'API d'installation — on affiche les instructions
      setVisible(true);
    } else {
      // Android/Chrome : on attend l'événement d'installation natif
      const handler = (e: Event) => {
        e.preventDefault();
        setInstallEvent(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/70 p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl border border-green-100 bg-white" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-green-900">
            Gardez vos cartes à portée de main
          </p>
          {isIOS ? (
            <p className="mt-1 text-[12px] leading-relaxed text-green-800/80">
              Ajoutez ComeBack à votre écran d'accueil : appuyez sur{" "}
              <Share className="inline h-3.5 w-3.5 align-[-2px]" /> <strong>Partager</strong> puis{" "}
              <PlusSquare className="inline h-3.5 w-3.5 align-[-2px]" /> <strong>« Sur l'écran d'accueil »</strong>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-[12px] text-green-800/80">
                Installez l'app pour retrouver vos cartes en un clic.
              </p>
              <button
                onClick={install}
                className="mt-2 rounded-lg bg-green-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Installer
              </button>
            </>
          )}
        </div>
        <button onClick={dismiss} className="flex-shrink-0 text-green-700/40 hover:text-green-700" aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
