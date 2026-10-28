import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { stripePriceId } from "@/lib/plan-billing";
import { isBillingCycle } from "@/lib/pricing";
import { notifyAdminEmail } from "@/lib/mailer";
import { getUpsellState, ensureLoyaltyCoupon } from "@/lib/upsell";
import { listLiveSubscriptions, enEssai } from "@/lib/stripe-subs";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Version épinglée : les codes promo créés par app/api/admin/promos/route.ts
  // (qui épingle la même version pour la même raison) ne sont pas reconnus
  // par une session Checkout créée sous une version d'API différente —
  // "Ce code n'est pas valide" alors que le code est bien actif côté Stripe.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { plan, billingCycle } = await req.json();

    // Plus de plan gratuit depuis le 27 octobre 2026 : Starter n'est plus
    // proposé. Pour arrêter, le commerçant résilie depuis « Factures &
    // résiliation » (portail Stripe) ; son compte est suspendu au terme de la
    // période déjà réglée, données conservées.
    if (plan === "starter") {
      return NextResponse.json(
        { error: "Le plan gratuit n'existe plus. Choisissez Pro ou Business." },
        { status: 400 },
      );
    }
    if (!plan || !["pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    if (!isBillingCycle(billingCycle)) {
      return NextResponse.json({ error: "Cycle invalide." }, { status: 400 });
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

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Paiement non configuré." }, { status: 503 });
    }

    const priceId = stripePriceId(plan, billingCycle);
    if (!priceId) {
      return NextResponse.json({ error: "Tarif non configuré." }, { status: 503 });
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

    // Déjà abonné ? → portail de gestion plutôt qu'un deuxième abonnement.
    // Un essai en cours compte : il porte déjà une carte et un abonnement.
    const live = await listLiveSubscriptions(stripe, customerId);

    // ── Essai en cours : on choisit ce qui démarrera à son terme ────────
    // Depuis le 28 octobre 2026, choisir un plan pendant l'essai ne fait rien
    // payer : le commerçant garde ses 30 jours gratuits et toutes les
    // fonctionnalités Business, et c'est le plan (et la période) choisi qui
    // démarre au terme de l'essai, à la place de Business mensuel.
    //
    // On remplace simplement le prix de l'abonnement d'essai : même
    // abonnement, même carte, même date de fin d'essai, aucune facture
    // aujourd'hui (`proration_behavior: "none"`, et surtout pas de
    // `trial_end`). Une résiliation programmée est levée au passage : choisir
    // un plan, c'est vouloir continuer.
    //
    // La base n'est pas touchée : le plan reste « business » jusqu'au terme
    // de l'essai, puis `invoice.paid` pose le plan réellement facturé (lu sur
    // le prix de l'abonnement, voir planFromPriceId).
    const essai = live.find((s) => enEssai(s)) as (typeof live[number] & { trial_end?: number | null }) | undefined;
    if (essai) {
      const itemId = essai.items?.data?.[0]?.id;
      if (!itemId) {
        return NextResponse.json({ error: "Abonnement d'essai illisible." }, { status: 502 });
      }
      try {
        await stripe.subscriptions.update(essai.id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: "none",
          cancel_at_period_end: false,
          metadata: { merchantId: merchant.id, plan, billingCycle },
        });
      } catch (e) {
        console.error("[checkout] changement de plan pendant l'essai", e);
        return NextResponse.json(
          { error: "Impossible d'enregistrer votre choix. Réessayez ou contactez-nous." },
          { status: 502 },
        );
      }
      const trialEnd = essai.trial_end ? new Date(essai.trial_end * 1000).toISOString() : null;
      console.log(`[checkout] essai : ${merchant.email} démarrera sur ${plan} (${billingCycle}) au terme de l'essai`);
      return NextResponse.json({ scheduled: true, plan, billingCycle, trialEnd });
    }

    if (live.length > 0) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/parametres`,
      });
      return NextResponse.json({ url: portal.url, portal: true });
    }

    // ── Offre « premier mois à -50 % » ──────────────────────────────────
    // L'éligibilité est recalculée ICI, côté serveur, à partir de la base :
    // l'interface ne peut pas s'attribuer la réduction en envoyant un drapeau.
    // Si le coupon est indisponible pour une raison quelconque, on continue au
    // prix plein — un commerçant ne doit jamais être bloqué au paiement.
    // Réservé au mensuel : le coupon Stripe "once" s'applique à la PREMIÈRE
    // FACTURE. En trimestriel ou en annuel, cette facture couvre plusieurs
    // mois : la remise porterait sur toute la période au lieu du seul premier
    // mois annoncé.
    let loyaltyCoupon: string | null = null;
    if (billingCycle === "monthly") {
      try {
        const upsell = await getUpsellState(merchant.id);
        if (upsell.eligible) loyaltyCoupon = await ensureLoyaltyCoupon(stripe);
      } catch (e) {
        console.error("[checkout] offre fidélité ignorée", e);
      }
    }

    // Abonnement récurrent : facturation automatique chaque mois, trimestre ou an
    const metadata = { merchantId: merchant.id, plan, billingCycle };
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      locale: "fr",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe refuse `discounts` et `allow_promotion_codes` ensemble. Quand
      // l'offre s'applique, la réduction est déjà la meilleure proposition :
      // on l'applique automatiquement plutôt que de demander un code à saisir.
      ...(loyaltyCoupon
        ? { discounts: [{ coupon: loyaltyCoupon }] }
        : { allow_promotion_codes: true }),
      // Ne demande une carte que si elle sera vraiment nécessaire : Stripe
      // évalue si l'abonnement restera à 0€ sur toute sa durée (donc un code
      // promo -100% "à vie" saute l'étape carte, mais un code temporaire ou
      // partiel continue de la demander puisqu'un futur prélèvement existe).
      payment_method_collection: "if_required",
      // TVA française incluse dans le prix affiché : le commerçant paie bien
      // le montant annoncé (9,99 €), et la facture Stripe fait apparaître le
      // détail (8,33 € HT + 1,66 € de TVA).
      //
      // On passe par un taux de TVA explicite plutôt que par `tax_behavior:
      // inclusive` sur les tarifs : le comportement est identique, mais un
      // taux se désactive alors qu'un tarif marqué "inclusive" ne peut plus
      // jamais revenir en arrière chez Stripe.
      subscription_data: {
        metadata,
        ...(process.env.STRIPE_TAX_RATE_ID ? { default_tax_rates: [process.env.STRIPE_TAX_RATE_ID] } : {}),
      },
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
