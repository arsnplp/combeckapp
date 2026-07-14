import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { activatePlan, setPlanUntil, PLAN_PRICING } from "@/lib/plan-billing";
import { creditCommission, refundCommission, getAffiliateById, UNLOCK_DELAY_DAYS } from "@/lib/affiliates";
import { sendAffiliateCommissionEmail, sendAffiliateRefundEmail, notifyAdminEmail } from "@/lib/mailer";
import type { PlanId } from "@/types";

// Commission affilié pour un paiement donné (première fois comme renouvellement)
async function creditAffiliateForPayment(
  merchantId: string, plan: string, amountPaid: number, dedupKey: string,
): Promise<void> {
  const { data: merchant } = await supabase().from("merchants")
    .select("store_name, affiliate_code").eq("id", merchantId).maybeSingle();
  if (!merchant?.affiliate_code) return;

  const monthlyPrice = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.monthly ?? 0;
  const result = await creditCommission(merchant.affiliate_code, {
    merchantId,
    merchantName: merchant.store_name ?? "Commerce",
    plan,
    amountPaid,
    monthlyPrice,
    stripeSessionId: dedupKey,
  });
  if (result.ok) {
    console.log(`[webhook] Commission ${result.commission}€ → affilié ${result.affiliate.name}`);
    const unlockDate = new Date(Date.now() + UNLOCK_DELAY_DAYS * 86400_000);
    sendAffiliateCommissionEmail(result.affiliate.email, {
      clientName: merchant.store_name ?? "Un commerce",
      amount: result.commission,
      unlockDate: unlockDate.toLocaleDateString("fr-FR"),
    }).catch(console.error);
  } else {
    console.log(`[webhook] Commission ignorée : ${result.reason}`);
  }
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!stripe || !sig || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret." }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error("[webhook] signature verification failed", e);
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }

  try {
    // ── Checkout terminé (paiement one-shot legacy uniquement) ──────────
    // En mode abonnement, c'est invoice.paid qui fait foi (1er paiement ET
    // renouvellements) — on évite ici le double traitement.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { merchantId, plan, billingCycle } = session.metadata ?? {};

      if (session.mode === "subscription") {
        console.log(`[webhook] Abonnement souscrit pour ${merchantId ?? "?"} (${plan ?? "?"})`);
      } else if (merchantId && plan && billingCycle) {
        await activatePlan(merchantId, plan as never, billingCycle as never);
        console.log(`[webhook] Plan activated (one-shot) for ${merchantId}: ${plan} (${billingCycle})`);
        try {
          await creditAffiliateForPayment(
            merchantId, plan, (session.amount_total ?? 0) / 100,
            (session.payment_intent as string) ?? session.id,
          );
        } catch (e) {
          console.error("[webhook] affiliate commission error", e);
        }
      }
    }

    // ── Facture payée : 1er paiement + tous les renouvellements ─────────
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      // Métadonnées portées par l'abonnement
      let meta = invoice.subscription_details?.metadata ?? {};
      if (!meta.merchantId && invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        meta = sub.metadata ?? {};
      }
      const { merchantId, plan, billingCycle } = meta;

      if (merchantId && plan) {
        // Plan actif jusqu'à la fin de la période facturée + 3 jours de grâce
        const periodEnd = invoice.lines?.data?.[0]?.period?.end as number | undefined;
        const expiresAt = periodEnd
          ? new Date(periodEnd * 1000 + 3 * 86400_000)
          : new Date(Date.now() + (billingCycle === "annual" ? 365 : 30) * 86400_000);
        await setPlanUntil(merchantId, plan as PlanId, expiresAt);
        console.log(`[webhook] invoice.paid → ${merchantId} plan ${plan} jusqu'au ${expiresAt.toISOString().slice(0, 10)}`);

        try {
          await creditAffiliateForPayment(
            merchantId, plan, (invoice.amount_paid ?? 0) / 100,
            (invoice.payment_intent as string) ?? invoice.id,
          );
        } catch (e) {
          console.error("[webhook] affiliate commission error", e);
        }
      }
    }

    // ── Abonnement annulé : le plan reste actif jusqu'à plan_expires_at,
    //    le cron quotidien fera le downgrade + churn affilié ──────────────
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      console.log(`[webhook] Abonnement annulé : ${sub.metadata?.merchantId ?? sub.id} (fin de période)`);
    }

    // ── Remboursement : reprendre la commission ─────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent as string | null;
      if (paymentIntentId) {
        const result = await refundCommission(paymentIntentId);
        if (result.ok) {
          console.log(`[webhook] Commission reprise (${result.amount}€) — remboursement client`);
          const affiliate = await getAffiliateById(result.affiliateId);
          if (affiliate) {
            sendAffiliateRefundEmail(affiliate.email, { amount: result.amount }).catch(console.error);
          }
        }
      }
    }

    // ── Litige : notifier l'admin ────────────────────────────────────────
    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      notifyAdminEmail("⚠️ Chargeback / litige Stripe", {
        "Charge": String(dispute.charge),
        "Montant": `${(dispute.amount ?? 0) / 100} €`,
        "Raison": dispute.reason ?? "?",
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] Error processing event", e);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
