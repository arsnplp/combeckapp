"use client";

import { useEffect, useState } from "react";
import { Clock, AlertCircle } from "lucide-react";

interface PlanStatus {
  isExpired: boolean;
  daysLeft: number | null;
  plan: string;
}

/**
 * Bandeau de fin d'essai gratuit — visible en haut de TOUTES les pages du
 * dashboard à partir de J-10, avec bouton vers le choix de plan.
 * (Le cas "expiré" est géré par la page /bloque.)
 */
export default function PlanExpirationBanner() {
  const [status, setStatus] = useState<PlanStatus | null>(null);

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setStatus({ isExpired: d.isExpired, daysLeft: d.daysLeft, plan: d.plan });
      })
      .catch(() => {});
  }, []);

  if (!status) return null;
  // Uniquement l'essai gratuit, à 10 jours ou moins de l'échéance
  if (status.plan !== "free") return null;
  if (status.isExpired) return null; // géré par /bloque
  if (status.daysLeft === null || status.daysLeft > 10) return null;

  const urgent = status.daysLeft <= 3;
  const days = status.daysLeft;

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3.5 ${
      urgent ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
    }`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-red-100" : "bg-amber-100"}`}>
        {urgent
          ? <AlertCircle className="h-5 w-5 text-red-600" />
          : <Clock className="h-5 w-5 text-amber-600" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-bold ${urgent ? "text-red-800" : "text-amber-800"}`}>
          {days === 0
            ? "Dernier jour de votre essai gratuit !"
            : `Votre essai gratuit se termine dans ${days} jour${days > 1 ? "s" : ""}`}
        </p>
        <p className={`text-[12px] ${urgent ? "text-red-700/70" : "text-amber-700/70"}`}>
          {urgent
            ? "Après cette date, votre compte sera suspendu jusqu'au choix d'un plan (vos données restent conservées)."
            : "Choisissez un plan pour continuer sans interruption — vos cartes et clients restent en place."}
        </p>
      </div>
      <a
        href="/abonnement"
        className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-md transition-all active:scale-[0.98] ${
          urgent
            ? "bg-red-600 shadow-red-600/25 hover:bg-red-700"
            : "bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-500/25 hover:from-green-600 hover:to-emerald-700"
        }`}
      >
        Choisir un plan
      </a>
    </div>
  );
}
