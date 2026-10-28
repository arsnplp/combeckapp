/**
 * Grille tarifaire et périodes de facturation, sans dépendance serveur :
 * importable aussi bien par les pages (client) que par les routes API.
 *
 * Trois périodes depuis le 28 octobre 2026 :
 *   - mensuel     : prix plein ;
 *   - trimestriel : environ -11 % (Pro 39,99 €, Business 79,99 €) ;
 *   - annuel      : environ -20 % (Pro 144 €, Business 288 €).
 *
 * Le montant d'une période est celui de Stripe, au centime : le prix affiché
 * est le prix facturé. Toute modification ici doit correspondre à un prix
 * Stripe existant (voir scripts/pricing-2026-10/).
 */

export type BillingCycle = "monthly" | "quarterly" | "annual";
export type PaidPlan = "pro" | "business";

export const BILLING_CYCLES: readonly BillingCycle[] = ["monthly", "quarterly", "annual"];

export const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Libellés courts, pour les sélecteurs et les récapitulatifs. */
export const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
};

/** « par mois », « par trimestre », « par an ». */
export const CYCLE_PER: Record<BillingCycle, string> = {
  monthly: "mois",
  quarterly: "trimestre",
  annual: "an",
};

/** Montant TTC facturé à chaque période, pour les nouveaux abonnements. */
export const PLAN_PRICING: Record<PaidPlan, Record<BillingCycle, number>> = {
  pro: { monthly: 14.99, quarterly: 39.99, annual: 144 },
  business: { monthly: 29.99, quarterly: 79.99, annual: 288 },
};

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && (BILLING_CYCLES as readonly string[]).includes(value);
}

/** Période lue dans une URL ou un corps de requête, mensuel par défaut. */
export function parseBillingCycle(value: unknown): BillingCycle {
  return isBillingCycle(value) ? value : "monthly";
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Montant facturé à chaque période. */
export function cycleTotal(plan: PaidPlan, cycle: BillingCycle): number {
  return PLAN_PRICING[plan][cycle];
}

/** Équivalent mensuel d'une période (39,99 € par trimestre → 13,33 €). */
export function cycleMonthly(plan: PaidPlan, cycle: BillingCycle): number {
  return cents(cycleTotal(plan, cycle) / CYCLE_MONTHS[cycle]);
}

/** Ce que coûterait la même durée au tarif mensuel (prix barré). */
export function cycleFullPrice(plan: PaidPlan, cycle: BillingCycle): number {
  return cents(PLAN_PRICING[plan].monthly * CYCLE_MONTHS[cycle]);
}

/** Économie réalisée sur une période par rapport au mensuel. */
export function cycleSavings(plan: PaidPlan, cycle: BillingCycle): number {
  return cents(cycleFullPrice(plan, cycle) - cycleTotal(plan, cycle));
}

/** Remise en pourcentage, arrondie (trimestriel : 11, annuel : 20). */
export function cycleDiscountPercent(plan: PaidPlan, cycle: BillingCycle): number {
  const full = cycleFullPrice(plan, cycle);
  return full > 0 ? Math.round((cycleSavings(plan, cycle) / full) * 100) : 0;
}

/** Montant en euros, à la française : 14,99 · 12 · 13,33. */
export function formatEuros(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

/**
 * Équivalent mensuel d'un prix Stripe, quelle que soit sa période
 * (mois, trimestre = mois × 3, année). Sert à afficher le prix réellement
 * payé par un abonné et à calculer des revenus mensuels comparables.
 */
export function monthlyFromStripePrice(
  unitAmountCents: number,
  interval?: string | null,
  intervalCount?: number | null,
): number {
  const unit = unitAmountCents / 100;
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1;
  const months = interval === "year" ? 12 * count : interval === "month" ? count : 1;
  return cents(unit / months);
}
