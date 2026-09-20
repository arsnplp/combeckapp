import { supabase } from "./supabase";
import { PLAN_LIMITS } from "./plan-limits";
import { getUserById } from "./users";
import type { PlanId } from "@/types";

/**
 * Offre de bienvenue au moment où le commerçant sature son plan gratuit.
 *
 * La raison de l'offre est réelle et vérifiable : il a rempli les 30 places de
 * son plan gratuit, donc son programme de fidélité fonctionne. On ne fabrique
 * ni urgence factice ni compte à rebours — l'offre reste valable tant qu'il est
 * dans cette situation, et disparaît d'elle-même dès qu'il change de plan.
 */
export const FIRST_MONTH_DISCOUNT_PERCENT = 50;

/**
 * Identifiant fixe du coupon Stripe. Fixe et non aléatoire pour que l'appel de
 * création soit idempotent : on ne crée jamais un deuxième coupon, même si
 * deux commerçants passent au paiement en même temps.
 */
export const LOYALTY_COUPON_ID = "comeback_fidelite_50";

export interface UpsellState {
  /** Le commerçant a-t-il droit à l'offre en ce moment ? */
  eligible: boolean;
  plan: PlanId;
  customerCount: number;
  /** null = illimité */
  maxClients: number | null;
  percentOff: number;
}

/**
 * Seule source de vérité de l'éligibilité, côté serveur uniquement.
 *
 * Appelée à la fois pour l'affichage ET au moment de créer la session de
 * paiement : l'interface ne peut donc pas « s'auto-attribuer » la réduction en
 * envoyant un drapeau depuis le navigateur.
 */
export async function getUpsellState(merchantId: string): Promise<UpsellState> {
  const merchant = await getUserById(merchantId);
  const plan = (merchant?.plan ?? "starter") as PlanId;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  const maxClients = limits.clients === Infinity ? null : limits.clients;

  // Plan illimité : rien à débloquer, donc aucune offre.
  if (maxClients === null) {
    return { eligible: false, plan, customerCount: 0, maxClients: null, percentOff: FIRST_MONTH_DISCOUNT_PERCENT };
  }

  const { count } = await supabase()
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);
  const customerCount = count ?? 0;

  return {
    // L'offre ne s'adresse qu'au plan gratuit à vie saturé : c'est le seul
    // moment où le commerçant est réellement bloqué par sa limite.
    eligible: plan === "starter" && customerCount >= maxClients,
    plan,
    customerCount,
    maxClients,
    percentOff: FIRST_MONTH_DISCOUNT_PERCENT,
  };
}

/**
 * Récupère le coupon Stripe, le crée s'il n'existe pas encore.
 *
 * Renvoie `null` en cas d'échec au lieu de propager l'erreur : un problème sur
 * le coupon ne doit JAMAIS empêcher un commerçant de payer. Il paiera le prix
 * plein plutôt que de se retrouver devant une page en erreur.
 */
export async function ensureLoyaltyCoupon(
  stripe: {
    coupons: {
      retrieve: (id: string) => Promise<{ id: string; deleted?: boolean; valid?: boolean }>;
      create: (params: Record<string, unknown>) => Promise<{ id: string }>;
    };
  },
): Promise<string | null> {
  try {
    const existing = await stripe.coupons.retrieve(LOYALTY_COUPON_ID);
    if (existing && !existing.deleted) return existing.id;
  } catch {
    // Coupon absent : on le crée juste en dessous.
  }
  try {
    const created = await stripe.coupons.create({
      id: LOYALTY_COUPON_ID,
      percent_off: FIRST_MONTH_DISCOUNT_PERCENT,
      // "once" = uniquement la première facture, donc le premier mois.
      duration: "once",
      name: `Fidélité ComeBack — ${FIRST_MONTH_DISCOUNT_PERCENT} % le premier mois`,
    });
    return created.id;
  } catch (e) {
    // Course entre deux paiements simultanés : le premier a créé le coupon
    // pendant qu'on essayait aussi — on le relit plutôt que d'abandonner.
    try {
      const existing = await stripe.coupons.retrieve(LOYALTY_COUPON_ID);
      if (existing && !existing.deleted) return existing.id;
    } catch { /* vraiment indisponible */ }
    console.error("[upsell] coupon indisponible, paiement au prix plein", e);
    return null;
  }
}
