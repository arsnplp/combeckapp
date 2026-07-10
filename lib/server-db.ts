import { supabase } from "./supabase";
import { walletDb_deletePassesForCards } from "./wallet-db";

// ── Types (identiques à l'ancienne version JSON) ──────────────────────────────

export interface DbRedemption {
  id: string;
  customerId: string;
  customerCardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  costType: "stamps" | "points" | "referral";
  redeemedAt: string;
}

export interface DbCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  totalVisits: number;
  lastVisitAt: string | null;
}

export interface DbCustomerCard {
  id: string;
  customerId: string;
  cardId: string;
  stamps: number;
  points: number;
  referralCount: number;
  referralPoints: number;
  pendingReferrals?: number; // filleuls inscrits non encore crédités
  joinDate: string;
  lastActivity: string;
}

interface DbShape {
  customers: DbCustomer[];
  customerCards: DbCustomerCard[];
  redemptions: DbRedemption[];
}

// ── Mappers lignes SQL → formes legacy ────────────────────────────────────────

interface CustomerRow {
  id: string; name: string; email: string; phone: string;
  join_date: string; total_visits: number; last_visit_at: string | null;
}
interface CardRow {
  id: string; customer_id: string; card_id: string; stamps: number; points: number;
  referral_count: number; referral_points: number; join_date: string; last_activity: string;
}
interface RedemptionRow {
  id: string; customer_id: string | null; customer_card_id: string | null;
  reward_name: string; reward_emoji: string; cost: number; cost_type: string; redeemed_at: string;
}

const mapCustomer = (r: CustomerRow): DbCustomer => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone,
  joinDate: r.join_date, totalVisits: r.total_visits, lastVisitAt: r.last_visit_at,
});
const mapCard = (r: CardRow): DbCustomerCard => ({
  id: r.id, customerId: r.customer_id, cardId: r.card_id, stamps: r.stamps, points: r.points,
  referralCount: r.referral_count, referralPoints: r.referral_points,
  joinDate: r.join_date, lastActivity: r.last_activity,
});
const mapRedemption = (r: RedemptionRow): DbRedemption => ({
  id: r.id, customerId: r.customer_id ?? "", customerCardId: r.customer_card_id ?? "",
  rewardName: r.reward_name, rewardEmoji: r.reward_emoji, cost: r.cost,
  costType: r.cost_type as DbRedemption["costType"], redeemedAt: r.redeemed_at,
});

// ── Lecture globale d'un tenant ───────────────────────────────────────────────

export async function db_getAll(tenantId: string): Promise<DbShape> {
  const sb = supabase();
  const [customers, cards, redemptions, pendingRefs] = await Promise.all([
    sb.from("customers").select("*").eq("merchant_id", tenantId).order("join_date"),
    sb.from("customer_cards").select("*").eq("merchant_id", tenantId).order("join_date"),
    sb.from("redemptions").select("*").eq("merchant_id", tenantId).order("redeemed_at"),
    sb.from("referrals").select("referrer_card_id").eq("merchant_id", tenantId).eq("credited", false),
  ]);
  const pendingByCard = new Map<string, number>();
  for (const p of pendingRefs.data ?? []) {
    const key = p.referrer_card_id as string;
    pendingByCard.set(key, (pendingByCard.get(key) ?? 0) + 1);
  }
  return {
    customers: ((customers.data ?? []) as CustomerRow[]).map(mapCustomer),
    customerCards: ((cards.data ?? []) as CardRow[]).map((r) => ({
      ...mapCard(r),
      pendingReferrals: pendingByCard.get(r.id) ?? 0,
    })),
    redemptions: ((redemptions.data ?? []) as RedemptionRow[]).map(mapRedemption),
  };
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

async function maybeRecordVisit(customerId: string): Promise<void> {
  const sb = supabase();
  const { data: c } = await sb.from("customers")
    .select("total_visits, last_visit_at").eq("id", customerId).maybeSingle();
  if (!c) return;
  const last = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
  if (Date.now() - last > TWO_HOURS) {
    await sb.from("customers").update({
      total_visits: (c.total_visits ?? 0) + 1,
      last_visit_at: new Date().toISOString(),
    }).eq("id", customerId);
  }
}

export async function db_addCustomer(
  tenantId: string,
  customer: DbCustomer,
  customerCard: DbCustomerCard,
): Promise<void> {
  const sb = supabase();
  const { error: e1 } = await sb.from("customers").insert({
    id: customer.id,
    merchant_id: tenantId,
    name: customer.name,
    email: (customer.email ?? "").toLowerCase(),
    phone: customer.phone ?? "",
    total_visits: 0,
    last_visit_at: null,
    join_date: customer.joinDate,
  });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.from("customer_cards").insert({
    id: customerCard.id,
    merchant_id: tenantId,
    customer_id: customerCard.customerId,
    card_id: customerCard.cardId,
    stamps: customerCard.stamps ?? 0,
    points: customerCard.points ?? 0,
    referral_count: customerCard.referralCount ?? 0,
    referral_points: customerCard.referralPoints ?? 0,
    join_date: customerCard.joinDate,
    last_activity: customerCard.lastActivity,
  });
  if (e2) throw new Error(e2.message);
}

async function getCardInTenant(tenantId: string, customerCardId: string): Promise<CardRow | null> {
  const { data } = await supabase().from("customer_cards").select("*")
    .eq("id", customerCardId).eq("merchant_id", tenantId).maybeSingle();
  return (data as CardRow) ?? null;
}

export async function db_addStamp(tenantId: string, customerCardId: string): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const now = new Date().toISOString();
  const { data } = await supabase().from("customer_cards")
    .update({ stamps: cc.stamps + 1, last_activity: now })
    .eq("id", customerCardId).select("*").maybeSingle();
  await maybeRecordVisit(cc.customer_id);
  return data ? mapCard(data as CardRow) : null;
}

export async function db_deleteCustomer(tenantId: string, customerId: string): Promise<void> {
  const sb = supabase();
  // Pass wallet + enregistrements d'appareils d'abord (sinon FK → NULL et les
  // appareils continuent de recevoir les notifications)
  const { data: cards } = await sb.from("customer_cards")
    .select("id").eq("customer_id", customerId).eq("merchant_id", tenantId);
  await walletDb_deletePassesForCards((cards ?? []).map((c) => c.id));
  // customer_cards + redemptions liés suivent via FK cascade / set null
  await sb.from("customers").delete()
    .eq("id", customerId).eq("merchant_id", tenantId);
}

/**
 * Enregistre un parrainage EN ATTENTE — le parrain ne sera crédité qu'à la
 * première visite réelle du filleul (anti-farm : les fausses inscriptions
 * sans visite ne rapportent rien).
 * Conditions : filleul avec email, pas d'auto-parrainage, parrain du même commerce.
 */
export async function db_recordPendingReferral(
  tenantId: string,
  referrerCardId: string,
  referredCustomerId: string,
  referredEmail: string,
): Promise<boolean> {
  const email = (referredEmail ?? "").toLowerCase().trim();
  if (!email) return false; // pas de compte email → pas de parrainage

  const sb = supabase();

  // Le parrain doit exister dans CE commerce
  const { data: refCard } = await sb.from("customer_cards")
    .select("id, customer_id").eq("id", referrerCardId).eq("merchant_id", tenantId).maybeSingle();
  if (!refCard) return false;

  // Anti auto-parrainage : le parrain ne peut pas être le filleul
  const { data: refCustomer } = await sb.from("customers")
    .select("email").eq("id", refCard.customer_id).maybeSingle();
  if (refCustomer?.email && refCustomer.email.toLowerCase() === email) return false;

  // Un seul parrainage par filleul
  const { data: existing } = await sb.from("referrals")
    .select("id").eq("referred_customer_id", referredCustomerId).maybeSingle();
  if (existing) return false;

  const { error } = await sb.from("referrals").insert({
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    merchant_id: tenantId,
    referrer_card_id: referrerCardId,
    referred_customer_id: referredCustomerId,
    referred_email: email,
    credited: false,
  });
  return !error;
}

/**
 * Crédite les parrainages en attente pour un filleul qui vient de faire sa
 * première visite réelle. Retourne les cartes des parrains crédités
 * (pour synchroniser leurs cartes wallet).
 */
export async function db_creditPendingReferrals(tenantId: string, customerId: string): Promise<string[]> {
  const sb = supabase();
  const { data: pending } = await sb.from("referrals")
    .select("id, referrer_card_id")
    .eq("merchant_id", tenantId)
    .eq("referred_customer_id", customerId)
    .eq("credited", false);
  if (!pending?.length) return [];

  const credited: string[] = [];
  for (const r of pending) {
    const { data: updated } = await sb.from("referrals")
      .update({ credited: true }).eq("id", r.id).eq("credited", false).select("id");
    if (!updated?.length) continue; // déjà crédité par une requête concurrente
    const card = await db_addReferral(tenantId, r.referrer_card_id);
    if (card) credited.push(r.referrer_card_id);
  }
  return credited;
}

export async function db_addReferral(tenantId: string, customerCardId: string): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const { data } = await supabase().from("customer_cards")
    .update({
      referral_count: (cc.referral_count ?? 0) + 1,
      referral_points: (cc.referral_points ?? 0) + 1,
    })
    .eq("id", customerCardId).select("*").maybeSingle();
  return data ? mapCard(data as CardRow) : null;
}

export async function db_addPoints(tenantId: string, customerCardId: string, points: number): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const now = new Date().toISOString();
  const { data } = await supabase().from("customer_cards")
    .update({ points: cc.points + points, last_activity: now })
    .eq("id", customerCardId).select("*").maybeSingle();
  await maybeRecordVisit(cc.customer_id);
  return data ? mapCard(data as CardRow) : null;
}

// ── Historique rédemptions ────────────────────────────────────────────────────

export async function db_addRedemption(tenantId: string, r: Omit<DbRedemption, "id">): Promise<void> {
  await supabase().from("redemptions").insert({
    id: `red_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    merchant_id: tenantId,
    customer_id: r.customerId || null,
    customer_card_id: r.customerCardId || null,
    reward_name: r.rewardName,
    reward_emoji: r.rewardEmoji,
    cost: r.cost,
    cost_type: r.costType,
    redeemed_at: r.redeemedAt,
  });
}

export async function db_getRedemptions(tenantId: string): Promise<DbRedemption[]> {
  const { data } = await supabase().from("redemptions").select("*")
    .eq("merchant_id", tenantId).order("redeemed_at");
  return ((data ?? []) as RedemptionRow[]).map(mapRedemption);
}

// ── Déduction récompenses (portail client) ────────────────────────────────────

export interface DeductResult {
  success: boolean;
  reason?: string;
  card?: DbCustomerCard;
}

export async function db_deductReward(
  tenantId: string,
  customerCardId: string,
  costType: "stamps" | "points" | "referral",
  cost: number,
): Promise<DeductResult> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return { success: false, reason: "Carte introuvable" };
  const card = mapCard(cc);
  if (costType === "stamps" && cc.stamps < cost) return { success: false, reason: "Pas assez de tampons", card };
  if (costType === "points" && cc.points < cost) return { success: false, reason: "Pas assez de points", card };
  if (costType === "referral" && (cc.referral_points ?? 0) < cost) return { success: false, reason: "Pas assez de points de parrainage", card };

  const patch: Record<string, unknown> = { last_activity: new Date().toISOString() };
  if (costType === "stamps") patch.stamps = cc.stamps - cost;
  else if (costType === "points") patch.points = cc.points - cost;
  else patch.referral_points = (cc.referral_points ?? 0) - cost;

  const { data } = await supabase().from("customer_cards")
    .update(patch).eq("id", customerCardId).select("*").maybeSingle();
  await maybeRecordVisit(cc.customer_id);
  return { success: true, card: data ? mapCard(data as CardRow) : card };
}

// ── Recherche cross-tenant (routes Apple Wallet sans session) ─────────────────

export async function findTenantByCustomerCardId(
  customerCardId: string,
): Promise<{ tenantId: string; card: DbCustomerCard } | null> {
  const { data } = await supabase().from("customer_cards").select("*, merchant_id")
    .eq("id", customerCardId).maybeSingle();
  if (!data) return null;
  return { tenantId: data.merchant_id as string, card: mapCard(data as CardRow) };
}

export async function db_incrementRewardUsage(tenantId: string, rewardName: string): Promise<void> {
  const sb = supabase();
  const { data } = await sb.from("rewards").select("id, usage_count")
    .eq("merchant_id", tenantId).eq("name", rewardName);
  for (const r of data ?? []) {
    await sb.from("rewards").update({ usage_count: (r.usage_count ?? 0) + 1 }).eq("id", r.id);
  }
}

export async function findTenantByCardId(cardId: string): Promise<string | null> {
  const { data } = await supabase().from("loyalty_cards").select("merchant_id")
    .eq("id", cardId).maybeSingle();
  return (data?.merchant_id as string) ?? null;
}
