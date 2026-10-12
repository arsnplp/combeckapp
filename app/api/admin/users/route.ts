import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllUsers } from "@/lib/users";
import { PLAN_PRICES } from "@/lib/plan-limits";
import { supabase } from "@/lib/supabase";
import { revenueByMerchant, summarize } from "@/lib/mrr";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const sb = supabase();
  const [users, customers, cards, loyaltyCards, stripeIds] = await Promise.all([
    getAllUsers(),
    sb.from("customers").select("merchant_id"),
    sb.from("customer_cards").select("merchant_id"),
    sb.from("loyalty_cards").select("merchant_id"),
    sb.from("merchants").select("id, stripe_customer_id"),
  ]);

  const countBy = (rows: Array<{ merchant_id: string }> | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.merchant_id, (m.get(r.merchant_id) ?? 0) + 1);
    return m;
  };
  const customerCounts = countBy(customers.data);
  const cardCounts = countBy(cards.data);
  const loyaltyCounts = countBy(loyaltyCards.data);

  const customerIdByMerchant = new Map<string, string | null>(
    (stripeIds.data ?? []).map((m) => [m.id, m.stripe_customer_id ?? null]),
  );

  // Revenu réel, lu sur les abonnements Stripe : le plan en base compte un
  // essai comme un abonné payant et ignore les codes promo.
  const revenues = await revenueByMerchant(
    getStripe(),
    users.map((u) => ({
      id: u.id,
      plan: u.plan,
      stripeCustomerId: customerIdByMerchant.get(u.id) ?? null,
    })),
    (plan) => PLAN_PRICES[plan as keyof typeof PLAN_PRICES] ?? 0,
  );

  const rows = users.map((u) => {
    const expiresAt = u.planExpiresAt ? new Date(u.planExpiresAt) : null;
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400_000) : null;
    const rev = revenues.get(u.id);
    return {
      id: u.id,
      email: u.email,
      storeName: u.storeName,
      city: u.city ?? "",
      phone: u.phone ?? "",
      plan: u.plan,
      // Ce qui est réellement encaissé chaque mois pour ce commerçant.
      monthlyRevenue: rev?.monthly ?? 0,
      monthlyFull: rev?.monthlyFull ?? 0,
      revenueStatus: rev?.status ?? "aucun",
      discountLabel: rev?.discountLabel ?? null,
      billingInterval: rev?.interval ?? null,
      cancelAt: rev?.cancelAt ?? null,
      nextChargeAt: rev?.nextChargeAt ?? null,
      createdAt: u.createdAt,
      planExpiresAt: u.planExpiresAt ?? null,
      daysLeft,
      clients: customerCounts.get(u.id) ?? 0,
      cards: cardCounts.get(u.id) ?? 0,
      loyaltyCards: loyaltyCounts.get(u.id) ?? 0,
    };
  });

  return NextResponse.json({ users: rows, totals: summarize(revenues.values()) });
}
