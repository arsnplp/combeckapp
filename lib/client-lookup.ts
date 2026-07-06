import { supabase } from "./supabase";

export interface ClientCard {
  tenantId: string;
  storeName: string;
  storeCity: string;
  customerId: string;
  customerName: string;
  customerCardId: string;
  cardId: string;
  cardName: string;
  loyaltyMode: "stamps" | "points";
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  welcomeMessage: string;
  stamps: number;
  points: number;
  referralCount: number;
  referralPoints: number;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string;
  rewards: Array<{
    id: string; name: string; description: string;
    cost: number; mode: string; emoji: string; referral?: boolean;
  }>;
  referral?: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
}

export async function findClientCards(email: string): Promise<ClientCard[]> {
  const normalizedEmail = email.toLowerCase().trim();
  const sb = supabase();

  // Toutes les fiches client portant cet email, avec commerce + cartes + soldes
  const { data: customers } = await sb.from("customers")
    .select(`
      id, name, merchant_id,
      merchants ( id, store_name, city, logo_url ),
      customer_cards (
        id, card_id, stamps, points, referral_count, referral_points,
        loyalty_cards (
          id, name, loyalty_mode, stamps_required, points_per_euro,
          welcome_points, welcome_message, background_color, accent_color,
          referral_enabled, referral_bonus, referral_bonus_type
        )
      )
    `)
    .ilike("email", normalizedEmail);

  if (!customers?.length) return [];

  // Récompenses de tous les commerces concernés en une requête
  const merchantIds = [...new Set(customers.map((c) => c.merchant_id as string))];
  const { data: allRewards } = await sb.from("rewards")
    .select("id, merchant_id, name, description, cost, mode, emoji, is_referral")
    .in("merchant_id", merchantIds).order("created_at");

  const rewardsByMerchant = new Map<string, NonNullable<typeof allRewards>>();
  for (const r of allRewards ?? []) {
    const list = rewardsByMerchant.get(r.merchant_id as string) ?? [];
    list.push(r);
    rewardsByMerchant.set(r.merchant_id as string, list);
  }

  const results: ClientCard[] = [];
  for (const cust of customers) {
    const merchant = cust.merchants as unknown as { id: string; store_name: string; city: string; logo_url: string | null } | null;
    const rewards = rewardsByMerchant.get(cust.merchant_id as string) ?? [];

    for (const cc of (cust.customer_cards as unknown as Array<{
      id: string; card_id: string; stamps: number; points: number;
      referral_count: number; referral_points: number;
      loyalty_cards: {
        id: string; name: string; loyalty_mode: string; stamps_required: number;
        points_per_euro: number; welcome_points: number; welcome_message: string;
        background_color: string; accent_color: string;
        referral_enabled: boolean; referral_bonus: number; referral_bonus_type: string;
      } | null;
    }>) ?? []) {
      const lc = cc.loyalty_cards;
      if (!lc) continue;

      const mode = (lc.loyalty_mode ?? "stamps") as "stamps" | "points";
      const cardRewards = [
        ...rewards.filter((r) => r.mode === mode && !r.is_referral),
        ...rewards.filter((r) => r.is_referral),
      ].map((r) => ({
        id: r.id as string,
        name: r.name as string,
        description: (r.description ?? "") as string,
        cost: r.cost as number,
        mode: r.mode as string,
        emoji: (r.emoji ?? "🎁") as string,
        referral: (r.is_referral as boolean) || undefined,
      }));

      results.push({
        tenantId: cust.merchant_id as string,
        storeName: merchant?.store_name ?? "Commerce",
        storeCity: merchant?.city ?? "",
        customerId: cust.id as string,
        customerName: cust.name as string,
        customerCardId: cc.id,
        cardId: lc.id,
        cardName: lc.name,
        loyaltyMode: mode,
        stampsRequired: lc.stamps_required ?? 8,
        pointsPerEuro: lc.points_per_euro ?? 10,
        welcomePoints: lc.welcome_points ?? 0,
        welcomeMessage: lc.welcome_message ?? "",
        stamps: cc.stamps,
        points: cc.points,
        referralCount: cc.referral_count ?? 0,
        referralPoints: cc.referral_points ?? 0,
        accentColor: lc.accent_color ?? "#16a34a",
        backgroundColor: lc.background_color ?? "#1e1b4b",
        logoUrl: merchant?.logo_url ?? "",
        rewards: cardRewards,
        referral: {
          enabled: lc.referral_enabled ?? false,
          referrerBonus: lc.referral_bonus ?? 1,
          bonusType: (lc.referral_bonus_type ?? "stamps") as "stamps" | "points",
        },
      });
    }
  }

  return results;
}
