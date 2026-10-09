import { supabase } from "./supabase";

/** Durée de l'essai, en jours. Doit rester alignée sur la page tarifs. */
export const TRIAL_DAYS = 30;

/** Plan dont l'essai donne les fonctionnalités, et qui démarre à son terme. */
export const TRIAL_PLAN = "business" as const;

export type TrialState =
  /** Jamais consommé : le commerçant peut l'activer. */
  | { status: "available" }
  /** Essai en cours. */
  | { status: "active"; endsAt: string; daysLeft: number }
  /** Déjà consommé — ou abonnement payant en cours. */
  | { status: "used"; usedAt: string | null };

/**
 * État de l'essai gratuit pour un commerçant.
 *
 * Seule source de vérité : consultée aussi bien pour l'affichage que juste
 * avant de créer la session de paiement, pour qu'un appel direct à l'API ne
 * puisse pas rejouer un essai déjà consommé.
 */
export async function getTrialState(merchantId: string): Promise<TrialState> {
  const { data } = await supabase()
    .from("merchants")
    .select("plan, trial_used_at, trial_ends_at")
    .eq("id", merchantId)
    .maybeSingle();

  if (!data) return { status: "used", usedAt: null };

  const plan = (data.plan ?? "starter") as string;
  const usedAt = data.trial_used_at as string | null;
  const endsAt = data.trial_ends_at as string | null;

  // Essai en cours — déterminé par `trial_ends_at` seul, jamais par le plan :
  // un abonné Business payant porte le même plan et la même allure.
  if (endsAt && new Date(endsAt).getTime() > Date.now()) {
    const daysLeft = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400_000));
    return { status: "active", endsAt, daysLeft };
  }

  // Essai déjà consommé, ou abonnement payant en cours : rien à proposer.
  if (usedAt || plan === "pro" || plan === "business") {
    return { status: "used", usedAt };
  }

  return { status: "available" };
}

/**
 * Marque l'essai comme consommé, au moment où Stripe confirme que
 * l'abonnement d'essai est bien créé — pas à l'ouverture de la page de
 * paiement : ouvrir puis abandonner ne doit rien consommer.
 *
 * `days` est la durée réellement accordée par Stripe. Elle peut être
 * inférieure à TRIAL_DAYS pour un compte qui avait déjà entamé l'ancien
 * essai sans carte : on ne lui ajoute pas 30 jours par-dessus.
 *
 * Ça n'ouvre pas la porte à un second essai : une fois cette date posée,
 * `getTrialState` renvoie « utilisé » définitivement.
 */
export async function markTrialUsed(merchantId: string, days = TRIAL_DAYS): Promise<void> {
  const endsAt = new Date(Date.now() + days * 86400_000);
  await supabase()
    .from("merchants")
    .update({ trial_used_at: new Date().toISOString(), trial_ends_at: endsAt.toISOString() })
    .eq("id", merchantId);
}
