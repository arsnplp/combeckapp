import { supabase } from "./supabase";
import type { PlanId } from "@/types";

export interface PlanInfo {
  plan: PlanId | "free";
  expiresAt: string | null;
  isExpired: boolean;
  daysLeft: number | null;
}

// Annuel : ~-20 %, arrondi à l'euro (le prix affiché = le prix facturé)
export const PLAN_PRICING = {
  starter: { monthly: 19, annual: 182 },
  pro: { monthly: 49, annual: 470 },
  business: { monthly: 99, annual: 950 },
} as const;

export function getPlanInfo(plan: string | null, expiresAt: string | null): PlanInfo {
  const now = new Date();
  const expDate = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expDate ? now > expDate : false;
  const daysLeft = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return {
    plan: (plan || "free") as PlanId | "free",
    expiresAt,
    isExpired,
    daysLeft: daysLeft && daysLeft > 0 ? daysLeft : null,
  };
}

export async function createFreeTrial(email: string): Promise<{ id: string; plan_expires_at: string }> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 3 months
  return {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    plan_expires_at: expiresAt.toISOString(),
  };
}

export async function activatePlan(
  merchantId: string,
  plan: PlanId,
  billingCycle: "monthly" | "annual",
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (billingCycle === "monthly" ? 30 : 365));

  await supabase().from("merchants").update({
    plan,
    plan_expires_at: expiresAt.toISOString(),
  }).eq("id", merchantId);
}

/** Active un plan jusqu'à une date précise (fin de période d'abonnement Stripe). */
export async function setPlanUntil(merchantId: string, plan: PlanId, expiresAt: Date): Promise<void> {
  await supabase().from("merchants").update({
    plan,
    plan_expires_at: expiresAt.toISOString(),
  }).eq("id", merchantId);
}

/** Essai gratuit expiré = compte suspendu (service gelé jusqu'au paiement). */
export function isTrialExpired(user: { plan: string; planExpiresAt?: string | null } | null | undefined): boolean {
  if (!user) return false;
  return user.plan === "free" && !!user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
}

/** Plan + cycle depuis un ID de prix Stripe (source de vérité de la facture). */
export function planFromPriceId(priceId: string): { plan: PlanId; billingCycle: "monthly" | "annual" } | null {
  for (const plan of ["starter", "pro", "business"] as PlanId[]) {
    for (const cycle of ["monthly", "annual"] as const) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle === "monthly" ? "MONTHLY" : "ANNUAL"}`;
      if (process.env[key] === priceId) return { plan, billingCycle: cycle };
    }
  }
  return null;
}

/** ID du prix Stripe récurrent (configuré en env) pour un plan + cycle. */
export function stripePriceId(plan: string, billingCycle: "monthly" | "annual"): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billingCycle === "monthly" ? "MONTHLY" : "ANNUAL"}`;
  return process.env[key] ?? null;
}

export async function downgradePlan(merchantId: string): Promise<void> {
  await supabase().from("merchants").update({
    plan: "free",
  }).eq("id", merchantId);
}

export async function checkAndDowngradeExpiredPlans(): Promise<number> {
  const now = new Date().toISOString();
  const { data } = await supabase().from("merchants")
    .select("id")
    .neq("plan", "free")
    .lt("plan_expires_at", now);

  let count = 0;
  for (const merchant of data ?? []) {
    await downgradePlan(merchant.id);
    count++;
    // Affiliation : le client parrainé n'est plus payant → churn + recalcul tier
    try {
      const { markMerchantChurned } = await import("./affiliates");
      await markMerchantChurned(merchant.id);
    } catch (e) {
      console.error("[plan-billing] churn affilié:", e);
    }
  }
  return count;
}
