import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { listLiveSubscriptions } from "@/lib/stripe-subs";
import { planFromPriceId } from "@/lib/plan-billing";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

type LiveSub = {
  status?: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  trial_end?: number | null;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string; unit_amount?: number | null } }> };
};

/** Ce qui démarrera au terme de l'essai (plan, période, montant TTC). */
type NextUp = { plan: string; billingCycle: string; amount: number | null; startsAt: string | null } | null;

function nextUpFrom(live: LiveSub[]): NextUp {
  const trial = live.find((s) => s.status === "trialing" && !s.cancel_at_period_end && !s.cancel_at);
  const price = trial?.items?.data?.[0]?.price;
  const found = price?.id ? planFromPriceId(price.id) : null;
  if (!trial || !found) return null;
  return {
    plan: found.plan,
    billingCycle: found.billingCycle,
    amount: typeof price?.unit_amount === "number" ? price.unit_amount / 100 : null,
    startsAt: trial.trial_end ? new Date(trial.trial_end * 1000).toISOString() : null,
  };
}

/**
 * GET — résiliation programmée chez Stripe ?
 *
 * La base ne sait pas qu'un commerçant a résilié depuis le portail Stripe :
 * son plan reste actif jusqu'à l'échéance, puis le cron le met en pause.
 * Sans cette route, l'interface continuait d'annoncer « l'abonnement démarre
 * automatiquement » à quelqu'un qui venait justement de l'arrêter.
 *
 * Renvoie `cancelAt` (date ISO de fin d'accès) ou null, et `nextUp` : pendant
 * un essai, le plan et la période qui démarreront à son terme (Business par
 * défaut, ou ce que le commerçant a choisi depuis). Stripe indisponible :
 * null partout, l'interface garde son affichage habituel plutôt que de casser.
 */
export async function GET() {
  const session = await auth();
  const merchantId = session?.user?.id;
  if (!merchantId || merchantId === "admin") return NextResponse.json({ cancelAt: null, nextUp: null });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ cancelAt: null, nextUp: null });

  try {
    const { data } = await supabase()
      .from("merchants")
      .select("stripe_customer_id")
      .eq("id", merchantId)
      .maybeSingle();
    const customerId = data?.stripe_customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ cancelAt: null, nextUp: null });

    const live = (await listLiveSubscriptions(stripe, customerId)) as unknown as LiveSub[];
    // Un abonnement vivant qui n'est PAS résilié l'emporte : le commerçant
    // continue d'être prélevé, il n'y a rien à annoncer.
    if (live.length === 0 || live.some((s) => !s.cancel_at_period_end && !s.cancel_at)) {
      return NextResponse.json({ cancelAt: null, nextUp: nextUpFrom(live) });
    }
    const ends = live
      .map((s) => s.cancel_at ?? s.trial_end ?? s.current_period_end ?? null)
      .filter((x): x is number => typeof x === "number");
    const cancelAt = ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
    return NextResponse.json({ cancelAt, nextUp: null });
  } catch (e) {
    console.error("[billing/status]", e);
    return NextResponse.json({ cancelAt: null, nextUp: null });
  }
}
