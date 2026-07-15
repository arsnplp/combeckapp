import { PLAN_LIMITS, PLAN_LABELS } from "./plan-limits";
import { getPlanInfo, type PlanInfo } from "./plan-billing";
import type { PlanId } from "@/types";

export interface PlanFeatures extends PlanInfo {
  plan: PlanId;
  label: string;
  maxCards: number;
  canTarget: boolean;
  canReferral: boolean;
  canRecurring: boolean;
  canExportCSV: boolean;
  analyticsHistoryDays: number;
}

export function getPlanFeatures(plan: PlanId, expiresAt?: string | null): PlanFeatures {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  const planInfo = getPlanInfo(plan, expiresAt ?? null);
  return {
    ...planInfo,
    plan: (plan || "starter") as PlanId,
    label: PLAN_LABELS[plan] ?? "Starter",
    maxCards: limits.cards,
    canTarget: limits.targetingAdvanced,
    canReferral: limits.referralEnabled,
    canRecurring: ["pro", "business", "free"].includes(plan),
    canExportCSV: limits.csvExport,
    analyticsHistoryDays: limits.analyticsHistoryDays,
  };
}

// API côté client pour récupérer les capacités du plan actuel
export async function fetchPlanFeatures(): Promise<PlanFeatures | null> {
  try {
    const res = await fetch("/api/plan-features");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
