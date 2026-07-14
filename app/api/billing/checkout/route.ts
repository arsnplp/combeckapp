import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { PLAN_PRICING } from "@/lib/plan-billing";

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
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { plan, billingCycle } = await req.json();

    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
      return NextResponse.json({ error: "Cycle invalide." }, { status: 400 });
    }

    // Récupérer le merchant
    const sb = supabase();
    const { data: merchant } = await sb
      .from("merchants")
      .select("id, stripe_customer_id")
      .ilike("email", session.user.email)
      .maybeSingle();

    if (!merchant) {
      return NextResponse.json({ error: "Compte non trouvé." }, { status: 404 });
    }

    // Pricing
    const pricing = PLAN_PRICING[plan as keyof typeof PLAN_PRICING];
    const amount = billingCycle === "monthly" ? pricing.monthly : pricing.annual;
    const description = `Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)} (${billingCycle === "monthly" ? "Mensuel" : "Annuel"})`;

    // Créer ou récupérer customer Stripe
    let customerId = merchant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: { merchantId: merchant.id },
      });
      customerId = customer.id;
      await sb.from("merchants").update({ stripe_customer_id: customerId }).eq("id", merchant.id);
    }

    // Créer checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getcomeback.fr";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "payment",
      locale: "fr",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: description,
              description: "Fidélité digitale — cartes Apple Wallet & Google Wallet",
              images: [`${appUrl}/icon-512.png`],
            },
            unit_amount: Math.round(amount * 100), // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/tarifs?billing=cancel`,
      metadata: { merchantId: merchant.id, plan, billingCycle },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
