import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getPlanFeatures } from "@/lib/plan-features";
import { supabase } from "@/lib/supabase";
import { listLiveSubscriptions } from "@/lib/stripe-subs";
import type { PlanId } from "@/types";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

type LivePrice = { unit_amount?: number | null; recurring?: { interval?: string } | null };

/**
 * Prix mensuel réellement payé par le commerçant, lu sur son abonnement
 * Stripe. Un abonné resté sur l'ancienne grille (Pro à 9,99 €) doit voir son
 * vrai prix, pas celui des nouveaux abonnements. `null` si introuvable : on
 * retombe alors sur le prix de la grille.
 */
async function actualMonthlyPrice(merchantId: string): Promise<number | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const { data } = await supabase()
    .from("merchants")
    .select("stripe_customer_id")
    .eq("id", merchantId)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) return null;
  const live = await listLiveSubscriptions(stripe, customerId);
  const price = (live[0]?.items?.data?.[0] as { price?: LivePrice } | undefined)?.price;
  if (typeof price?.unit_amount !== "number") return null;
  const unit = price.unit_amount / 100;
  return price.recurring?.interval === "year" ? Math.round((unit / 12) * 100) / 100 : unit;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await getUserById(session.user.id);
  const plan = (user?.plan ?? "starter") as PlanId;
  const features = getPlanFeatures(plan, user?.planExpiresAt);

  if (plan === "pro" || plan === "business") {
    try {
      const paid = await actualMonthlyPrice(session.user.id);
      if (paid !== null) features.priceMonthly = paid;
    } catch (e) {
      // Stripe indisponible : on garde le prix de la grille plutôt que de casser la page.
      console.error("[plan-features] prix réel indisponible", e);
    }
  }

  return NextResponse.json(features);
}
