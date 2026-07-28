"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, X, Loader2 } from "lucide-react";

interface PlanFeaturesLite {
  plan: string;
  daysLeft: number | null;
  signupChosePlan: string | null;
  businessTrialBannerDismissed: boolean;
  hasUsedBonusBusinessTrial: boolean;
}

// Affichée aux commerçants qui ont choisi un plan directement à l'inscription
// (Starter/Pro/Business) plutôt que l'essai gratuit — leur propose 30 jours
// gratuits niveau Business. Se met à jour tout seul au changement de plan
// puisque tout est relu depuis /api/plan-features à chaque montage.
export default function BusinessTrialBanner() {
  const router = useRouter();
  const [info, setInfo] = useState<PlanFeaturesLite | null>(null);
  const [hidden, setHidden] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/plan-features").then((r) => (r.ok ? r.json() : null)).then((d) => d && setInfo(d)).catch(() => {});
  }, []);

  if (!info || hidden) return null;
  if (!info.signupChosePlan) return null;
  if (info.plan === "business") return null;
  if (info.businessTrialBannerDismissed) return null;
  // Le bonus déjà utilisé ne se propose plus que pendant qu'il court (plan "free")
  if (info.hasUsedBonusBusinessTrial && info.plan !== "free") return null;

  const isLivingTrial = info.plan === "free";

  const dismiss = () => {
    setHidden(true);
    fetch("/api/billing/dismiss-business-trial-banner", { method: "POST" }).catch(() => {});
  };

  const startTrial = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/billing/start-business-trial", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Erreur."); setStarting(false); return; }
      router.refresh();
      const fresh = await fetch("/api/plan-features").then((r) => (r.ok ? r.json() : null));
      if (fresh) setInfo(fresh);
    } catch {
      setError("Erreur réseau.");
    }
    setStarting(false);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100">
        <Gift className="h-4 w-4 text-violet-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-violet-900">
          {isLivingTrial
            ? `Vous profitez de l'essai Business gratuit${info.daysLeft !== null ? ` — ${info.daysLeft} jour${info.daysLeft > 1 ? "s" : ""} restant${info.daysLeft > 1 ? "s" : ""}` : ""}`
            : "Envie de tester toutes les fonctionnalités Business ?"}
        </p>
        <p className="text-[12px] text-violet-700/70">
          {isLivingTrial
            ? "Toutes les fonctionnalités Business sont débloquées jusqu'à la fin de l'essai."
            : "Profitez de 30 jours gratuits, sans carte bancaire — clients illimités, ciblage avancé, notifications automatiques."}
        </p>
        {error && <p className="mt-1 text-[11.5px] text-red-600">{error}</p>}
      </div>
      {!isLivingTrial && (
        <button onClick={startTrial} disabled={starting}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-violet-600/25 transition-all hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60">
          {starting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Essayer Business gratuit
        </button>
      )}
      <button onClick={dismiss} className="flex-shrink-0 text-violet-400 hover:text-violet-600 transition-colors" aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
