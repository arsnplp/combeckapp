import { supabase } from "./supabase";
import { googleWalletObjectExists } from "./google-wallet";

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
  pendingReferrals: number; // filleuls inscrits mais pas encore venus (point non crédité)
  walletAdded: boolean;     // carte ajoutée à Apple Wallet OU Google Wallet
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

  // Parrainages en attente (non crédités) par carte parrain — une requête
  const allCardIds = customers.flatMap((c) =>
    ((c.customer_cards as unknown as Array<{ id: string }>) ?? []).map((cc) => cc.id),
  );
  const pendingByCard = new Map<string, number>();
  const walletAddedCards = new Set<string>();
  if (allCardIds.length) {
    const { data: pendings } = await sb.from("referrals")
      .select("referrer_card_id")
      .in("referrer_card_id", allCardIds)
      .eq("credited", false);
    for (const p of pendings ?? []) {
      const key = p.referrer_card_id as string;
      pendingByCard.set(key, (pendingByCard.get(key) ?? 0) + 1);
    }

    // Apple Wallet : le pass existe ET au moins un appareil s'est enregistré
    // pour recevoir ses mises à jour
    const { data: passes } = await sb.from("wallet_passes")
      .select("id, customer_card_id")
      .in("customer_card_id", allCardIds);
    const passIds = (passes ?? []).map((p) => p.id as string);
    if (passIds.length) {
      const { data: regs } = await sb.from("wallet_registrations")
        .select("pass_id").in("pass_id", passIds);
      const registeredPassIds = new Set((regs ?? []).map((r) => r.pass_id as string));
      for (const p of passes ?? []) {
        if (registeredPassIds.has(p.id as string)) walletAddedCards.add(p.customer_card_id as string);
      }
    }

    // Google Wallet : l'objet n'existe chez Google que si le client a enregistré
    // la carte (fat JWT) — vérification en parallèle pour les cartes restantes
    const remaining = allCardIds.filter((id) => !walletAddedCards.has(id));
    if (remaining.length) {
      const checks = await Promise.all(
        remaining.map(async (id) => ({ id, exists: await googleWalletObjectExists(id) })),
      );
      for (const c of checks) if (c.exists) walletAddedCards.add(c.id);
    }
  }

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
        pendingReferrals: pendingByCard.get(cc.id) ?? 0,
        walletAdded: walletAddedCards.has(cc.id),
        accentColor: lc.accent_color ?? "#16a34a",
        backgroundColor: lc.background_color ?? "#1e1b4b",
        logoUrl: merchant?.logo_url ? `/api/settings/logo?tenantId=${cust.merchant_id as string}&t=${merchant.logo_url}` : "",
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
