import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { stripePriceId } from "@/lib/plan-billing";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });
    }
    const { email, password, storeName, city, plan, billingCycle } = await req.json();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe min. 8 caractères." }, { status: 400 });
    }
    if (!storeName || !storeName.trim()) {
      return NextResponse.json({ error: "Nom de commerce requis." }, { status: 400 });
    }
    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
      return NextResponse.json({ error: "Cycle invalide." }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const sb = supabase();

    // Vérifier si email existe
    const { data: existing } = await sb.from("merchants").select("id").ilike("email", normalized).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    // Créer le compte (sans plan pour le moment)
    const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(password, 12);

    // Attribution affilié : cookie posé par /ref/{code}
    const affiliateCode = req.cookies.get("comeback_ref")?.value ?? null;

    await sb.from("merchants").insert({
      id: userId,
      email: normalized,
      password_hash: passwordHash,
      store_name: storeName.trim(),
      city: city?.trim() ?? "",
      plan: "free",
      plan_expires_at: null,
      created_at: new Date().toISOString(),
      email_verified: true,
      is_admin: false,
      affiliate_code: affiliateCode,
    });

    // Créer customer Stripe
    const customer = await stripe.customers.create({
      email: normalized,
      metadata: { merchantId: userId },
    });

    // Mettre à jour le merchant avec stripe_customer_id
    await sb.from("merchants").update({ stripe_customer_id: customer.id }).eq("id", userId);

    // Créer la Stripe Checkout Session (abonnement récurrent)
    const priceId = stripePriceId(plan, billingCycle);
    if (!priceId) {
      return NextResponse.json({ error: "Tarif non configuré." }, { status: 503 });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getcomeback.fr";
    const metadata = { merchantId: userId, plan, billingCycle };
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      locale: "fr",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata },
      metadata,
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/tarifs?billing=cancel`,
    });

    return NextResponse.json({
      ok: true,
      userId,
      email: normalized,
      checkoutUrl: checkoutSession.url,
    });
  } catch (e) {
    console.error("[signup-paid]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
