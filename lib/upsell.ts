import { supabase } from "./supabase";
import { PLAN_LIMITS } from "./plan-limits";
import { getUserById } from "./users";
import { isTrialExpired } from "./plan-billing";
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

/**
 * Pourquoi l'offre est proposée. Les deux moments où le commerçant se heurte
 * à un mur, et donc où la proposition a du sens :
 *  - "limit"       : plan gratuit à vie saturé (30 clients atteints)
 *  - "trial_ended" : essai de 30 jours terminé, compte bloqué
 */
export type UpsellReason = "limit" | "trial_ended";

export interface UpsellState {
  /** Le commerçant a-t-il droit à l'offre en ce moment ? */
  eligible: boolean;
  reason: UpsellReason | null;
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

  // Le nombre de clients sert aussi à personnaliser le message ("vous avez
  // déjà 24 clients fidélisés"), on le lit donc dans les deux cas.
  const { count } = await supabase()
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);
  const customerCount = count ?? 0;

  const base = { plan, customerCount, maxClients, percentOff: FIRST_MONTH_DISCOUNT_PERCENT };

  // Essai terminé : le compte est bloqué sur /bloque tant qu'aucun plan n'est
  // choisi. Rien ne le déloge automatiquement (le cron n'envoie que des
  // rappels), donc l'offre reste visible aussi longtemps qu'il hésite.
  if (isTrialExpired(merchant)) {
    return { ...base, eligible: true, reason: "trial_ended" };
  }

  // Plan gratuit à vie saturé : plus aucun nouveau client ne peut s'inscrire.
  if (maxClients !== null && plan === "starter" && customerCount >= maxClients) {
    return { ...base, eligible: true, reason: "limit" };
  }

  return { ...base, eligible: false, reason: null };
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
