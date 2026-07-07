import { PLAN_LIMITS, PLAN_LABELS } from "./plan-limits";
import type { PlanId } from "@/types";

export interface PlanFeatures {
  plan: PlanId;
  label: string;
  maxCards: number;
  canTarget: boolean;
  canReferral: boolean;
  canExportCSV: boolean;
  analyticsHistoryDays: number;
}

export function getPlanFeatures(plan: PlanId): PlanFeatures {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  return {
    plan,
    label: PLAN_LABELS[plan] ?? "Starter",
    maxCards: limits.cards,
    canTarget: limits.targetingAdvanced,
    canReferral: limits.referralEnabled,
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
