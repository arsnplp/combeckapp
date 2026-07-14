import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// POST — ouvre le portail Stripe (factures, moyen de paiement, annulation)
export async function POST() {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: merchant } = await supabase().from("merchants")
    .select("stripe_customer_id").ilike("email", session.user.email).maybeSingle();

  if (!merchant?.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun abonnement : souscrivez d'abord un plan." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getcomeback.fr";
  const portal = await stripe.billingPortal.sessions.create({
    customer: merchant.stripe_customer_id,
    return_url: `${appUrl}/parametres`,
  });

  return NextResponse.json({ url: portal.url });
}
