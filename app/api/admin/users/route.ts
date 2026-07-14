import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllUsers } from "@/lib/users";
import { PLAN_PRICES } from "@/lib/plan-limits";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const sb = supabase();
  const [users, customers, cards, loyaltyCards] = await Promise.all([
    getAllUsers(),
    sb.from("customers").select("merchant_id"),
    sb.from("customer_cards").select("merchant_id"),
    sb.from("loyalty_cards").select("merchant_id"),
  ]);

  const countBy = (rows: Array<{ merchant_id: string }> | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.merchant_id, (m.get(r.merchant_id) ?? 0) + 1);
    return m;
  };
  const customerCounts = countBy(customers.data);
  const cardCounts = countBy(cards.data);
  const loyaltyCounts = countBy(loyaltyCards.data);

  return NextResponse.json(users.map((u) => {
    // Jours d'essai / d'abonnement restants
    const expiresAt = u.planExpiresAt ? new Date(u.planExpiresAt) : null;
    const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400_000) : null;
    return {
      id: u.id,
      email: u.email,
      storeName: u.storeName,
      city: u.city ?? "",
      plan: u.plan,
      monthlyRevenue: PLAN_PRICES[u.plan] ?? 0,
      createdAt: u.createdAt,
      planExpiresAt: u.planExpiresAt ?? null,
      daysLeft,
      clients: customerCounts.get(u.id) ?? 0,
      cards: cardCounts.get(u.id) ?? 0,
      loyaltyCards: loyaltyCounts.get(u.id) ?? 0,
    };
  }));
}
