import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { stripePriceId, activateStarterFree } from "@/lib/plan-billing";
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

    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    }
    if (!billingCycle || !["monthly", "annual"].includes(billingCycle)) {
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

    // ── Starter est gratuit à vie : jamais de Stripe ─────────────────────
    // Vérifié AVANT le check "Stripe configuré" — l'activation de Starter ne
    // doit jamais dépendre de Stripe. Si le commerçant a un abonnement payant
    // en cours (Pro/Business), on l'annule (gratuit immédiatement, pas de
    // double facturation) — uniquement si Stripe est disponible.
    if (plan === "starter") {
      const stripeForCancel = getStripe();
      if (stripeForCancel && merchant.stripe_customer_id) {
        // `listLiveSubscriptions` inclut les essais en cours (statut
        // `trialing`) : sans ça, un commerçant qui passait à Starter pendant
        // son essai gardait son abonnement Business et se faisait prélever
        // 39,99 € au bout des 30 jours.
        const live = await listLiveSubscriptions(stripeForCancel, merchant.stripe_customer_id);
        for (const s of live) {
          try {
            await stripeForCancel.subscriptions.cancel(s.id);
          } catch (e) {
            // Ne bloque pas le passage à Starter (le commerçant ne doit jamais
            // rester coincé), mais alerte l'admin : sans annulation Stripe,
            // l'abonnement payant continuera à être facturé en double.
            console.error("[checkout] cancel sub", e);
            notifyAdminEmail("⚠️ Échec annulation Stripe (downgrade Starter)", {
              "Commerçant": merchant.email ?? merchant.id,
              "Abonnement Stripe": s.id,
              "Erreur": e instanceof Error ? e.message : String(e),
            }).catch(console.error);
          }
        }
      }
      await activateStarterFree(merchant.id);
      return NextResponse.json({ activated: true, plan: "starter" });
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

    // ── Essai en cours : on bascule en payant tout de suite ─────────────
    // Le commerçant qui choisit un plan pendant son essai veut démarrer son
    // abonnement maintenant, pas attendre la fin des 30 jours. L'envoyer
    // vers le portail Stripe ne lui offre aucun moyen évident de le faire.
    // On met donc l'abonnement d'essai au tarif choisi et on termine l'essai
    // sur-le-champ : Stripe émet la facture dans la foulée avec la carte
    // déjà enregistrée. `proration_behavior: "none"` parce qu'un essai n'a
    // jamais été facturé — il n'y a rien à proratiser, le commerçant paie
    // simplement sa première période pleine.
    const essai = live.find((s) => enEssai(s));
    if (essai) {
      const itemId = essai.items?.data?.[0]?.id;
      if (!itemId) {
        return NextResponse.json({ error: "Abonnement d'essai illisible." }, { status: 502 });
      }
      try {
        await stripe.subscriptions.update(essai.id, {
          items: [{ id: itemId, price: priceId }],
          trial_end: "now",
          proration_behavior: "none",
          metadata: { merchantId: merchant.id, plan, billingCycle },
        });
      } catch (e) {
        console.error("[checkout] fin d'essai anticipée", e);
        return NextResponse.json(
          { error: "Impossible de démarrer l'abonnement maintenant. Réessayez ou contactez-nous." },
          { status: 502 },
        );
      }
      // `invoice.paid` posera le plan et son échéance, comme pour tout
      // paiement. On ne touche pas à la base ici : si le prélèvement échoue,
      // le commerçant ne doit pas se retrouver avec un plan qu'il n'a pas payé.
      console.log(`[checkout] essai converti en abonnement payant : ${merchant.email} → ${plan} (${billingCycle})`);
      return NextResponse.json({ converted: true, plan });
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
    // FACTURE. En annuel, cette facture couvre douze mois — la remise porterait
    // donc sur toute l'année au lieu du seul premier mois annoncé.
    let loyaltyCoupon: string | null = null;
    if (billingCycle === "monthly") {
      try {
        const upsell = await getUpsellState(merchant.id);
        if (upsell.eligible) loyaltyCoupon = await ensureLoyaltyCoupon(stripe);
      } catch (e) {
        console.error("[checkout] offre fidélité ignorée", e);
      }
    }

    // Abonnement récurrent : facturation automatique chaque mois / an
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
