import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { getClientAccount } from "@/lib/client-accounts";
import { resolveClientSession } from "@/lib/client-sessions";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;

  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const account = await getClientAccount(email);
  const sb = supabase();

  // Toutes les fiches du client, avec commerce, cartes et historique
  const { data: customers } = await sb.from("customers")
    .select(`
      id,
      merchants ( store_name, city ),
      customer_cards ( stamps, points, join_date, last_activity, loyalty_cards ( name, loyalty_mode ) ),
      redemptions ( reward_name, cost, cost_type, redeemed_at )
    `)
    .ilike("email", email.toLowerCase().trim());

  const tenantData = (customers ?? []).map((cust) => {
    const merchant = cust.merchants as unknown as { store_name: string; city: string } | null;
    return {
      storeName: merchant?.store_name ?? "Commerce",
      storeCity: merchant?.city ?? "",
      cards: ((cust.customer_cards as unknown as Array<{
        stamps: number; points: number; join_date: string; last_activity: string;
        loyalty_cards: { name: string; loyalty_mode: string } | null;
      }>) ?? []).map((cc) => ({
        cardName: cc.loyalty_cards?.name ?? "Carte",
        loyaltyMode: cc.loyalty_cards?.loyalty_mode ?? "stamps",
        stamps: cc.stamps,
        points: cc.points,
        joinDate: cc.join_date,
        lastActivity: cc.last_activity,
      })),
      redemptions: ((cust.redemptions as unknown as Array<{
        reward_name: string; cost: number; cost_type: string; redeemed_at: string;
      }>) ?? []).map((r) => ({
        rewardName: r.reward_name,
        cost: r.cost,
        costType: r.cost_type,
        redeemedAt: r.redeemed_at,
      })),
    };
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    personalInfo: {
      email: account?.email ?? email,
      name: account?.name ?? "",
      accountCreatedAt: account?.createdAt ?? null,
    },
    loyaltyData: tenantData,
  };

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-donnees-comeback.json"`,
    },
  });
}
