import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { listLiveSubscriptions } from "@/lib/stripe-subs";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

type LiveSub = { cancel_at_period_end?: boolean; cancel_at?: number | null; trial_end?: number | null; current_period_end?: number };

/**
 * GET — résiliation programmée chez Stripe ?
 *
 * La base ne sait pas qu'un commerçant a résilié depuis le portail Stripe :
 * son plan reste actif jusqu'à l'échéance, puis le cron le met en pause.
 * Sans cette route, l'interface continuait d'annoncer « l'abonnement démarre
 * automatiquement » à quelqu'un qui venait justement de l'arrêter.
 *
 * Renvoie `cancelAt` (date ISO de fin d'accès) ou null. Stripe indisponible :
 * null, l'interface garde son affichage habituel plutôt que de casser.
 */
export async function GET() {
  const session = await auth();
  const merchantId = session?.user?.id;
  if (!merchantId || merchantId === "admin") return NextResponse.json({ cancelAt: null });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ cancelAt: null });

  try {
    const { data } = await supabase()
      .from("merchants")
      .select("stripe_customer_id")
      .eq("id", merchantId)
      .maybeSingle();
    const customerId = data?.stripe_customer_id as string | undefined;
    if (!customerId) return NextResponse.json({ cancelAt: null });

    const live = (await listLiveSubscriptions(stripe, customerId)) as unknown as LiveSub[];
    // Un abonnement vivant qui n'est PAS résilié l'emporte : le commerçant
    // continue d'être prélevé, il n'y a rien à annoncer.
    if (live.length === 0 || live.some((s) => !s.cancel_at_period_end && !s.cancel_at)) {
      return NextResponse.json({ cancelAt: null });
    }
    const ends = live
      .map((s) => s.cancel_at ?? s.trial_end ?? s.current_period_end ?? null)
      .filter((x): x is number => typeof x === "number");
    const cancelAt = ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
    return NextResponse.json({ cancelAt });
  } catch (e) {
    console.error("[billing/status]", e);
    return NextResponse.json({ cancelAt: null });
  }
}
