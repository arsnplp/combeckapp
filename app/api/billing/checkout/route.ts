import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { stripePriceId } from "@/lib/plan-billing";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { plan, billingCycle } = await req.json();

    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
      return NextResponse.json({ error: "Cycle invalide." }, { status: 400 });
    }

    const priceId = stripePriceId(plan, billingCycle);
    if (!priceId) {
      return NextResponse.json({ error: "Tarif non configuré." }, { status: 503 });
    }

    // Récupérer le merchant
    const sb = supabase();
    // Lookup par id de session (l'email de session peut différer de celui en
    // base — cas du compte admin notamment)
    const { data: merchant } = await sb
      .from("merchants")
      .select("id, email, stripe_customer_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!merchant) {
      return NextResponse.json({ error: "Compte non trouvé." }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getcomeback.fr";

    // Créer ou récupérer customer Stripe
    let customerId = merchant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: merchant.email ?? session.user.email ?? undefined,
        metadata: { merchantId: merchant.id },
      });
      customerId = customer.id;
      await sb.from("merchants").update({ stripe_customer_id: customerId }).eq("id", merchant.id);
    }

    // Déjà abonné ? → portail de gestion plutôt qu'un deuxième abonnement
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    if (subs.data.length > 0) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/parametres`,
      });
      return NextResponse.json({ url: portal.url, portal: true });
    }

    // Abonnement récurrent : facturation automatique chaque mois / an
    const metadata = { merchantId: merchant.id, plan, billingCycle };
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      locale: "fr",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata },
      metadata,
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/tarifs?billing=cancel`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
