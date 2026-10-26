import { supabase } from "./supabase";
import type { PlanId } from "@/types";

export interface PlanInfo {
  plan: PlanId | "free";
  expiresAt: string | null;
  isExpired: boolean;
  daysLeft: number | null;
}

// Annuel : ~-20 %, arrondi à l'euro (le prix affiché = le prix facturé)
// Starter n'apparaît PAS ici : il est gratuit à vie et ne passe jamais par
// Stripe (voir activateStarterFree ci-dessous).
//
// Grille du 26 octobre 2026 (avant : Pro 9,99 € / 96 €, Business 39,99 € /
// 384 €). Ce sont les prix des NOUVEAUX abonnements. Un abonné existant paie
// le prix porté par son abonnement Stripe, que ce tableau ne modifie pas :
// les Pro à 9,99 € le restent. Voir scripts/pricing-2026-10/README.md.
export const PLAN_PRICING = {
  pro: { monthly: 14.99, annual: 144 },
  business: { monthly: 29.99, annual: 288 },
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
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 jours d'essai
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

/**
 * IDs de prix Stripe configurés pour un plan + cycle.
 *
 * La variable d'environnement peut lister plusieurs IDs séparés par des
 * virgules : le PREMIER est le prix des nouveaux abonnements, les suivants
 * sont d'anciens prix encore portés par des abonnés existants. Exemple :
 *   STRIPE_PRICE_PRO_MONTHLY=price_nouveau_1499,price_ancien_999
 *
 * Ne jamais retirer un ancien ID tant qu'un abonnement l'utilise : sans lui,
 * planFromPriceId ne reconnaît plus l'abonnement au renouvellement.
 */
function priceIdsFor(plan: string, billingCycle: "monthly" | "annual"): string[] {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billingCycle === "monthly" ? "MONTHLY" : "ANNUAL"}`;
  return (process.env[key] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Plan + cycle depuis un ID de prix Stripe (source de vérité de la facture). */
export function planFromPriceId(priceId: string): { plan: PlanId; billingCycle: "monthly" | "annual" } | null {
  // Starter est gratuit (pas de prix Stripe) — jamais retourné ici.
  // Anciens prix compris : un abonné resté sur l'ancienne grille garde son plan.
  for (const plan of ["pro", "business"] as PlanId[]) {
    for (const cycle of ["monthly", "annual"] as const) {
      if (priceIdsFor(plan, cycle).includes(priceId)) return { plan, billingCycle: cycle };
    }
  }
  return null;
}

/** ID du prix Stripe des NOUVEAUX abonnements (le premier de la liste en env). */
export function stripePriceId(plan: string, billingCycle: "monthly" | "annual"): string | null {
  return priceIdsFor(plan, billingCycle)[0] ?? null;
}

/**
 * Active le plan Starter gratuit à vie (pas d'expiration — contrairement à
 * l'essai qui est du niveau Business mais limité à 30 jours). N'annule PAS
 * un abonnement Stripe existant : c'est à l'appelant (route qui a le client
 * Stripe sous la main) de le faire avant d'appeler cette fonction.
 */
export async function activateStarterFree(merchantId: string): Promise<void> {
  await supabase().from("merchants").update({
    plan: "starter",
    plan_expires_at: null,
  }).eq("id", merchantId);
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
