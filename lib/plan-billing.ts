import { supabase } from "./supabase";
import type { PlanId } from "@/types";
import { CYCLE_MONTHS, BILLING_CYCLES, type BillingCycle } from "./pricing";

export { PLAN_PRICING } from "./pricing";
export type { BillingCycle } from "./pricing";

export interface PlanInfo {
  plan: PlanId | "free";
  expiresAt: string | null;
  isExpired: boolean;
  daysLeft: number | null;
}

// La grille (mensuel, trimestriel, annuel) vit dans lib/pricing.ts, importable
// côté client. Starter n'y figure PAS : ce n'est plus une offre (voir
// plan-limits.ts), et il n'a jamais eu de prix Stripe.
//
// Ce sont les prix des NOUVEAUX abonnements. Un abonné existant paie le prix
// porté par son abonnement Stripe, que la grille ne modifie pas : les Pro à
// 9,99 € le restent. Voir scripts/pricing-2026-10/README.md.

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
  billingCycle: BillingCycle,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (billingCycle === "annual" ? 365 : 30 * CYCLE_MONTHS[billingCycle]));

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
function priceIdsFor(plan: string, billingCycle: BillingCycle): string[] {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billingCycle.toUpperCase()}`;
  return (process.env[key] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Plan + cycle depuis un ID de prix Stripe (source de vérité de la facture). */
export function planFromPriceId(priceId: string): { plan: PlanId; billingCycle: BillingCycle } | null {
  // Starter n'a jamais eu de prix Stripe : jamais retourné ici.
  // Anciens prix compris : un abonné resté sur l'ancienne grille garde son plan.
  for (const plan of ["pro", "business"] as PlanId[]) {
    for (const cycle of BILLING_CYCLES) {
      if (priceIdsFor(plan, cycle).includes(priceId)) return { plan, billingCycle: cycle };
    }
  }
  return null;
}

/** ID du prix Stripe des NOUVEAUX abonnements (le premier de la liste en env). */
export function stripePriceId(plan: string, billingCycle: BillingCycle): string | null {
  return priceIdsFor(plan, billingCycle)[0] ?? null;
}

/**
 * Compte sans abonnement actif : plan « free » déjà expiré.
 *
 * Depuis le 27 octobre 2026 il n'y a plus de plan gratuit. Un compte qui n'a
 * ni essai en cours ni abonnement payé est redirigé vers /bloque (voir
 * app/(dashboard)/layout.tsx) : ses données sont conservées, il retrouve tout
 * en démarrant son essai (s'il ne l'a jamais pris) ou en choisissant Pro ou
 * Business. C'est l'état d'un compte qui vient d'être créé, d'un essai résilié
 * arrivé à son terme, ou d'un abonnement arrêté.
 */
export function suspendedPlanFields(now: Date = new Date()): { plan: "free"; plan_expires_at: string } {
  // Une seconde dans le passé : le compte est bloqué dès la première requête,
  // même si elle arrive dans la même milliseconde que sa création.
  return { plan: "free", plan_expires_at: new Date(now.getTime() - 1000).toISOString() };
}

/**
 * Compte créé sans jamais avoir eu de jour d'essai : son échéance est égale à
 * sa date de création (voir suspendedPlanFields). À distinguer des anciens
 * essais sans carte, dont l'échéance tombait 30 jours après la création.
 */
export function isAwaitingFirstTrial(
  user: { plan: string; planExpiresAt?: string | null; createdAt?: string | null } | null | undefined,
): boolean {
  if (!user || user.plan !== "free" || !user.planExpiresAt || !user.createdAt) return false;
  return new Date(user.planExpiresAt).getTime() - new Date(user.createdAt).getTime() <= 86400_000;
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
