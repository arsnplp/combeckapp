"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";

interface PlanStatus {
  isExpired: boolean;
  daysLeft: number | null;
  plan: string;
}

export default function PlanExpirationBanner() {
  const [status, setStatus] = useState<PlanStatus | null>(null);

  useEffect(() => {
    fetch("/api/plan-features")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setStatus({
          isExpired: d.isExpired,
          daysLeft: d.daysLeft,
          plan: d.plan,
        });
      })
      .catch(() => {});
  }, []);

  if (!status) return null;
  if (status.plan === "starter" || status.plan === "pro" || status.plan === "business") {
    if (!status.isExpired && (!status.daysLeft || status.daysLeft > 7)) return null;
  }

  const message = status.isExpired
    ? "Votre essai gratuit a expiré. Veuillez passer à un plan payant pour continuer."
    : `Votre essai gratuit expire dans ${status.daysLeft} jour${status.daysLeft === 1 ? "" : "s"}.`;

  const bgColor = status.isExpired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200";
  const textColor = status.isExpired ? "text-red-700" : "text-amber-700";
  const iconColor = status.isExpired ? "text-red-500" : "text-amber-500";

  return (
    <div className={`rounded-xl border ${bgColor} px-4 py-3 flex items-start gap-3`}>
      {status.isExpired ? (
        <AlertCircle className={`h-5 w-5 flex-shrink-0 ${iconColor} mt-0.5`} />
      ) : (
        <Clock className={`h-5 w-5 flex-shrink-0 ${iconColor} mt-0.5`} />
      )}
      <div className="flex-1">
        <p className={`text-[13.5px] font-semibold ${textColor}`}>{message}</p>
        {status.isExpired && (
          <p className={`text-[12px] ${textColor} mt-1`}>
            <a href="/tarifs" className="underline hover:no-underline font-semibold">
              Choisir un plan
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
