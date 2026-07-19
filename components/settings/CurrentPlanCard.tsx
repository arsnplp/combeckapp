"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, Gift, ArrowRight, Crown, Loader2 } from "lucide-react";
import { fetchPlanFeatures, type PlanFeatures } from "@/lib/plan-features";

// Détails d'affichage par plan — alignés sur PLAN_LIMITS
const PLAN_DISPLAY: Record<string, {
  features: string[];
  next: { label: string } | null;
  accent: string; border: string; bg: string; text: string; sub: string;
}> = {
  free: {
    features: ["Toutes les fonctionnalités débloquées", "Clients & notifications illimités", "2 cartes de fidélité", "Parrainage & ciblage avancé"],
    next: { label: "Choisir un plan" },
    accent: "#16a34a", border: "rgba(22,163,74,0.25)",
    bg: "linear-gradient(135deg, rgba(22,163,74,0.08), rgba(5,150,105,0.04))",
    text: "text-green-700", sub: "text-green-700/60",
  },
  starter: {
    features: ["Jusqu'à 50 clients", "1 000 notifications / mois", "1 carte de fidélité", "Parrainage inclus"],
    next: { label: "Passer au plan Pro" },
    accent: "#475569", border: "rgba(71,85,105,0.2)",
    bg: "linear-gradient(135deg, rgba(71,85,105,0.06), rgba(100,116,139,0.03))",
    text: "text-slate-700", sub: "text-slate-500",
  },
  pro: {
    features: ["Jusqu'à 100 clients", "10 000 notifications / mois", "2 cartes de fidélité", "Ciblage avancé + export CSV"],
    next: { label: "Passer au plan Business" },
    accent: "#d97706", border: "rgba(245,158,11,0.25)",
    bg: "linear-gradient(135deg, rgba(245,158,11,0.09), rgba(217,119,6,0.04))",
    text: "text-amber-700", sub: "text-amber-700/60",
  },
  business: {
    features: ["Clients illimités", "Notifications illimitées", "2 cartes de fidélité", "Toutes les fonctionnalités incluses"],
    next: null,
    accent: "#7c3aed", border: "rgba(124,58,237,0.25)",
    bg: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(109,40,217,0.04))",
    text: "text-violet-700", sub: "text-violet-700/60",
  },
};

export default function CurrentPlanCard() {
  const [info, setInfo] = useState<PlanFeatures | null>(null);

  useEffect(() => {
    fetchPlanFeatures().then(setInfo);
  }, []);

  if (!info) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const isTrial = info.plan === "free";
  const d = PLAN_DISPLAY[info.plan] ?? PLAN_DISPLAY.starter;
  const expiryDate = info.expiresAt
    ? new Date(info.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl p-6" style={{ background: d.bg, border: `1px solid ${d.border}` }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            {isTrial ? <Gift className="h-4 w-4" style={{ color: d.accent }} />
              : info.plan === "business" ? <Crown className="h-4 w-4" style={{ color: d.accent }} />
              : <Zap className="h-4 w-4" style={{ color: d.accent }} />}
            <p className={`text-sm font-bold ${d.text}`}>
              {isTrial ? "Essai gratuit" : `Plan ${info.label}`}
            </p>
            {info.plan === "business" && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10.5px] font-semibold text-violet-700">
                Plan maximum ✨
              </span>
            )}
          </div>
          <p className={`text-xs ${d.sub}`}>
            {isTrial
              ? (info.isExpired ? "Essai terminé" : expiryDate ? `Fin de l'essai le ${expiryDate}` : "")
              : expiryDate ? `Renouvellement le ${expiryDate}` : "Abonnement actif"}
          </p>
          <ul className="mt-3 space-y-1">
            {d.features.map((f) => (
              <li key={f} className={`flex items-center gap-2 text-xs ${d.text} opacity-80`}>
                <CheckCircle className="h-3 w-3" style={{ color: d.accent }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-right">
          {isTrial ? (
            info.daysLeft !== null && (
              <div className={`rounded-xl px-3.5 py-2 ${(info.daysLeft ?? 0) <= 10 ? "bg-amber-100" : "bg-green-100"}`}>
                <p className={`text-2xl font-bold leading-none ${(info.daysLeft ?? 0) <= 10 ? "text-amber-600" : "text-green-700"}`}>
                  {info.daysLeft}
                </p>
                <p className={`mt-0.5 text-[10.5px] font-medium ${(info.daysLeft ?? 0) <= 10 ? "text-amber-600/70" : "text-green-700/60"}`}>
                  jour{(info.daysLeft ?? 0) > 1 ? "s" : ""} restant{(info.daysLeft ?? 0) > 1 ? "s" : ""}
                </p>
              </div>
            )
          ) : (
            info.priceMonthly !== null && (
              <>
                <p className="text-2xl font-bold" style={{ color: d.accent }}>{info.priceMonthly}€</p>
                <p className={`text-xs ${d.sub}`}>/mois</p>
              </>
            )
          )}
        </div>
      </div>

      {d.next && (
        <a
          href="/abonnement"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-[13.5px] font-bold text-white shadow-md shadow-green-600/20 transition-all hover:from-green-700 hover:to-emerald-700 active:scale-[0.99]"
        >
          {d.next.label} <ArrowRight className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
