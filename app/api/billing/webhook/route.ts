import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { activatePlan, PLAN_PRICING } from "@/lib/plan-billing";
import { creditCommission, refundCommission, getAffiliateById, UNLOCK_DELAY_DAYS } from "@/lib/affiliates";
import { sendAffiliateCommissionEmail, sendAffiliateRefundEmail, notifyAdminEmail } from "@/lib/mailer";

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
    // ── Paiement réussi : activer le plan + commission affilié ──────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { merchantId, plan, billingCycle } = session.metadata ?? {};

      if (!merchantId || !plan || !billingCycle) {
        console.warn("[webhook] Missing metadata", session.metadata);
        return NextResponse.json({ ok: true });
      }

      await activatePlan(merchantId, plan as never, billingCycle as never);
      console.log(`[webhook] Plan activated for ${merchantId}: ${plan} (${billingCycle})`);

      // Commission affilié (toutes les gardes sont dans creditCommission :
      // doublon, montant nul, affilié suspendu, rate limiting)
      try {
        const { data: merchant } = await supabase().from("merchants")
          .select("store_name, affiliate_code").eq("id", merchantId).maybeSingle();
        if (merchant?.affiliate_code) {
          const amountPaid = (session.amount_total ?? 0) / 100;
          const monthlyPrice = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.monthly ?? 0;
          const result = await creditCommission(merchant.affiliate_code, {
            merchantId,
            merchantName: merchant.store_name ?? "Commerce",
            plan,
            amountPaid,
            monthlyPrice,
            stripeSessionId: (session.payment_intent as string) ?? session.id,
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
      } catch (e) {
        // L'affiliation ne doit JAMAIS bloquer l'activation du plan
        console.error("[webhook] affiliate commission error", e);
      }
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
