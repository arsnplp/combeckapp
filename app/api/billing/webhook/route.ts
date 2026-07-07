import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { activatePlan } from "@/lib/plan-billing";

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !WEBHOOK_SECRET) {
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { merchantId, plan, billingCycle } = session.metadata;

      if (!merchantId || !plan || !billingCycle) {
        console.warn("[webhook] Missing metadata", session.metadata);
        return NextResponse.json({ ok: true });
      }

      // Activer le plan
      await activatePlan(merchantId, plan as any, billingCycle as any);

      console.log(`[webhook] Plan activated for ${merchantId}: ${plan} (${billingCycle})`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] Error processing event", e);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
