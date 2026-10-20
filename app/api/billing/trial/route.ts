import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { stripePriceId } from "@/lib/plan-billing";
import { getTrialState, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/trial";
import { listLiveSubscriptions } from "@/lib/stripe-subs";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Même version épinglée que /api/billing/checkout : les codes promo créés
  // par l'espace admin ne sont pas reconnus d'une version d'API à l'autre.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

/** GET — état de l'essai pour le commerçant connecté. */
export async function GET() {
  const session = await auth();
  const merchantId = session?.user?.id;
  if (!merchantId || merchantId === "admin") {
    return NextResponse.json({ status: "used", usedAt: null });
  }
  try {
    const state = await getTrialState(merchantId);
    return NextResponse.json({ ...state, days: TRIAL_DAYS, plan: TRIAL_PLAN });
  } catch (e) {
    // Un problème ici ne doit pas casser la page des plans.
    console.error("[trial] état indisponible", e);
    return NextResponse.json({ status: "used", usedAt: null });
  }
}

/** POST — démarre l'essai : session Stripe avec carte, 0 € aujourd'hui. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const merchantId = session?.user?.id;
    if (!merchantId || merchantId === "admin") {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    // Éligibilité relue en base : l'interface ne peut pas rejouer un essai
    // déjà consommé en appelant cette route directement.
    const state = await getTrialState(merchantId);
    if (state.status !== "available") {
      return NextResponse.json(
        { error: state.status === "active" ? "Votre essai est déjà en cours." : "Vous avez déjà utilisé votre essai gratuit." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });

    const priceId = stripePriceId(TRIAL_PLAN, "monthly");
    if (!priceId) return NextResponse.json({ error: "Tarif non configuré." }, { status: 503 });

    const sb = supabase();
    const { data: merchant } = await sb
      .from("merchants")
      .select("id, email, stripe_customer_id, plan, plan_expires_at")
      .eq("id", merchantId)
      .maybeSingle();
    if (!merchant) return NextResponse.json({ error: "Compte non trouvé." }, { status: 404 });

    let customerId = merchant.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: merchant.email ?? session.user?.email ?? undefined,
        metadata: { merchantId: merchant.id },
      });
      customerId = customer.id as string;
      await sb.from("merchants").update({ stripe_customer_id: customerId }).eq("id", merchant.id);
    }
    if (!customerId) {
      return NextResponse.json({ error: "Client Stripe indisponible." }, { status: 503 });
    }

    // Déjà un abonnement en cours : il n'y a pas d'essai à démarrer par-dessus.
    // Essai compris — un abonnement `trialing` est un abonnement.
    const live = await listLiveSubscriptions(stripe, customerId);
    if (live.length > 0) {
      return NextResponse.json({ error: "Vous avez déjà un abonnement en cours." }, { status: 409 });
    }

    // Comptes créés avant le passage à l'essai avec carte : ils sont sur le
    // plan « free », un essai de 30 jours sans carte déjà entamé. Leur en
    // ouvrir un second ferait 60 jours gratuits. On reprend donc le temps
    // qu'il leur reste au lieu de repartir de zéro — ils ne perdent rien,
    // leur accès se prolonge simplement jusqu'à la date déjà promise.
    let trialDays = TRIAL_DAYS;
    if (merchant.plan === "free" && merchant.plan_expires_at) {
      const left = Math.ceil((new Date(merchant.plan_expires_at).getTime() - Date.now()) / 86400_000);
      // Stripe refuse un essai de moins d'un jour.
      trialDays = Math.min(TRIAL_DAYS, Math.max(1, left));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getcomeback.fr";
    const metadata = { merchantId: merchant.id, plan: TRIAL_PLAN, billingCycle: "monthly", trial: "1", trialDays: String(trialDays) };

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      locale: "fr",
      line_items: [{ price: priceId, quantity: 1 }],
      // La carte est exigée dès maintenant bien que rien ne soit prélevé :
      // sans elle, Stripe n'aurait aucun moyen de prélever au terme de
      // l'essai et l'abonnement s'arrêterait là.
      payment_method_collection: "always",
      // Un code promo saisi ici s'applique selon sa propre durée : un coupon
      // « forever » à -50 % réduit donc aussi tous les prélèvements suivants.
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: trialDays,
        metadata,
        ...(process.env.STRIPE_TAX_RATE_ID ? { default_tax_rates: [process.env.STRIPE_TAX_RATE_ID] } : {}),
      },
      metadata,
      success_url: `${appUrl}/dashboard?trial=started`,
      cancel_url: `${appUrl}/abonnement?trial=cancel`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[trial]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
