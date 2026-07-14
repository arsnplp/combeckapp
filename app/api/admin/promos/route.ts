import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// GET — liste des codes promo Stripe (actifs et inactifs)
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe non configuré." }, { status: 503 });

  // expand nécessaire : les versions récentes de l'API ne renvoient plus le
  // coupon complet dans la liste
  const codes = await stripe.promotionCodes.list({ limit: 50, expand: ["data.coupon"] });
  return NextResponse.json({
    promos: codes.data.map((p: {
      id: string; code: string; active: boolean; times_redeemed: number;
      max_redemptions: number | null; expires_at: number | null;
      coupon?: { percent_off: number | null; amount_off: number | null; duration: string; valid: boolean } | string;
    }) => {
      const coupon = typeof p.coupon === "object" && p.coupon ? p.coupon : null;
      return {
        id: p.id,
        code: p.code,
        active: p.active && (coupon?.valid ?? true),
        percentOff: coupon?.percent_off ?? null,
        amountOff: coupon?.amount_off ? coupon.amount_off / 100 : null,
        duration: coupon?.duration ?? "once", // once | forever | repeating
        timesRedeemed: p.times_redeemed,
        maxRedemptions: p.max_redemptions,
        expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      };
    }),
  });
}

// POST — créer un code ({ code, percentOff, duration, maxRedemptions? })
//        ou désactiver/réactiver ({ action: "toggle", promoId, active })
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe non configuré." }, { status: 503 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "toggle" && body.promoId) {
    await stripe.promotionCodes.update(body.promoId, { active: !!body.active });
    return NextResponse.json({ ok: true });
  }

  const code = String(body.code ?? "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const percentOff = Number(body.percentOff);
  const duration = ["once", "forever"].includes(body.duration) ? body.duration : "once";
  const maxRedemptions = body.maxRedemptions ? Number(body.maxRedemptions) : undefined;

  if (!code || code.length < 3) return NextResponse.json({ error: "Code invalide (min. 3 caractères A-Z/0-9)." }, { status: 400 });
  if (!percentOff || percentOff < 1 || percentOff > 100) {
    return NextResponse.json({ error: "Réduction invalide (1 à 100 %)." }, { status: 400 });
  }

  try {
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration,
      name: `${code} (-${percentOff}%)`,
    });
    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
    });
    return NextResponse.json({ ok: true, code: promo.code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Stripe.";
    return NextResponse.json({ error: msg.includes("already exists") ? "Ce code existe déjà." : msg }, { status: 400 });
  }
}
