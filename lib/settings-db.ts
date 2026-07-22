import { supabase } from "./supabase";

// ── Formes identiques à l'ancien settings.json (compat frontend) ──────────────

export interface TenantLoyaltyCard {
  id: string;
  name: string;
  welcomeMessage: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  loyaltyMode: "stamps" | "points";
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  rankThresholds: { silver: number; gold: number; platine: number };
  active: boolean;
  // referrerBonus/referredBonus s'interprètent en tampons ou points selon loyaltyMode
  referral?: { enabled: boolean; referrerBonus: number; referredBonus: number };
}

export interface TenantReward {
  id: string;
  name: string;
  description: string;
  emoji: string;
  cost: number;
  mode: "stamps" | "points";
  usageCount?: number;
}

export interface TenantProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  pointsValue: number;
  description?: string;
}

export interface TenantSettingsBlob {
  settings: Record<string, unknown>;
  walletConfig: Record<string, unknown>;
  loyaltyCards: TenantLoyaltyCard[];
  rewards: TenantReward[];
  products: TenantProduct[];
}

// ── Mapping lignes DB → formes legacy ─────────────────────────────────────────

interface CardRow {
  id: string; name: string; welcome_message: string; background_color: string;
  accent_color: string; text_color: string; loyalty_mode: string; stamps_required: number;
  points_per_euro: number; welcome_points: number; rank_thresholds: { silver: number; gold: number; platine: number };
  active: boolean; referral_enabled: boolean; referral_bonus: number; referred_bonus: number;
}

function mapCard(r: CardRow): TenantLoyaltyCard {
  return {
    id: r.id,
    name: r.name,
    welcomeMessage: r.welcome_message,
    backgroundColor: r.background_color,
    accentColor: r.accent_color,
    textColor: r.text_color,
    loyaltyMode: r.loyalty_mode as "stamps" | "points",
    stampsRequired: r.stamps_required,
    pointsPerEuro: r.points_per_euro,
    welcomePoints: r.welcome_points,
    rankThresholds: r.rank_thresholds ?? { silver: 2, gold: 5, platine: 10 },
    active: r.active,
    referral: {
      enabled: r.referral_enabled,
      referrerBonus: r.referral_bonus,
      referredBonus: r.referred_bonus ?? 0,
    },
  };
}

interface RewardRow {
  id: string; name: string; description: string; emoji: string;
  cost: number; mode: string; usage_count: number;
}

function mapReward(r: RewardRow): TenantReward {
  return {
    id: r.id, name: r.name, description: r.description, emoji: r.emoji,
    cost: r.cost, mode: r.mode as "stamps" | "points",
    usageCount: r.usage_count,
  };
}

interface ProductRow {
  id: string; name: string; category: string; price: number;
  active: boolean; points_value: number; description: string;
}

function mapProduct(p: ProductRow): TenantProduct {
  return {
    id: p.id, name: p.name, category: p.category, price: Number(p.price),
    active: p.active, pointsValue: p.points_value, description: p.description || undefined,
  };
}

// ── Lecture ───────────────────────────────────────────────────────────────────

export async function getTenantSettings(tenantId: string): Promise<TenantSettingsBlob> {
  const sb = supabase();
  const [m, cards, rewards, products] = await Promise.all([
    sb.from("merchants").select("settings, wallet_config, store_name, city, address, phone, website, logo_url, email").eq("id", tenantId).maybeSingle(),
    sb.from("loyalty_cards").select("*").eq("merchant_id", tenantId).order("created_at"),
    sb.from("rewards").select("*").eq("merchant_id", tenantId).order("created_at"),
    sb.from("products").select("*").eq("merchant_id", tenantId).order("created_at"),
  ]);

  const base = (m.data?.settings ?? {}) as Record<string, unknown>;
  return {
    settings: {
      ...base,
      storeName: m.data?.store_name ?? base.storeName ?? base.name ?? "",
      name: base.name ?? m.data?.store_name ?? "",
      storeCity: m.data?.city ?? base.storeCity ?? "",
      city: m.data?.city ?? base.city ?? "",
      address: m.data?.address ?? "",
      phone: m.data?.phone ?? "",
      website: m.data?.website ?? "",
      email: base.email ?? m.data?.email ?? "",
      logoUrl: m.data?.logo_url ?? base.logoUrl ?? "",
    },
    walletConfig: (m.data?.wallet_config ?? {}) as Record<string, unknown>,
    loyaltyCards: ((cards.data ?? []) as CardRow[]).map(mapCard),
    rewards: ((rewards.data ?? []) as RewardRow[]).map(mapReward),
    products: ((products.data ?? []) as ProductRow[]).map(mapProduct),
  };
}

// ── Écriture (reçoit le blob complet du dashboard) ────────────────────────────

export async function saveTenantSettings(tenantId: string, blob: Partial<TenantSettingsBlob>): Promise<void> {
  const sb = supabase();
  const s = (blob.settings ?? {}) as Record<string, unknown>;

  await sb.from("merchants").update({
    store_name: (s.storeName as string) || (s.name as string) || undefined,
    city: (s.city as string) ?? (s.storeCity as string) ?? undefined,
    address: (s.address as string) ?? undefined,
    phone: (s.phone as string) ?? undefined,
    website: (s.website as string) ?? undefined,
    logo_url: (s.logoUrl as string) ?? undefined,
    settings: s,
    wallet_config: blob.walletConfig ?? {},
  }).eq("id", tenantId);

  // Cartes : upsert celles envoyées, supprime les retirées
  // (la suppression cascade sur customer_cards — même comportement qu'avant)
  if (blob.loyaltyCards) {
    const keep = blob.loyaltyCards.filter((c) => c.id).map((c) => c.id);
    await sb.from("loyalty_cards").upsert(blob.loyaltyCards.filter((c) => c.id).map((c) => ({
      id: c.id,
      merchant_id: tenantId,
      name: c.name ?? "Carte",
      loyalty_mode: c.loyaltyMode === "points" ? "points" : "stamps",
      stamps_required: c.stampsRequired ?? 8,
      points_per_euro: c.pointsPerEuro ?? 10,
      welcome_points: c.welcomePoints ?? 0,
      welcome_message: c.welcomeMessage ?? "",
      background_color: c.backgroundColor ?? "#1e293b",
      accent_color: c.accentColor ?? "#16a34a",
      text_color: c.textColor ?? "#ffffff",
      rank_thresholds: c.rankThresholds ?? { silver: 2, gold: 5, platine: 10 },
      active: c.active ?? true,
      referral_enabled: c.referral?.enabled ?? false,
      referral_bonus: c.referral?.referrerBonus ?? 1,
      referred_bonus: c.referral?.referredBonus ?? 0,
    })));
    const del = sb.from("loyalty_cards").delete().eq("merchant_id", tenantId);
    await (keep.length ? del.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`) : del);
  }

  if (blob.rewards) {
    const keep = blob.rewards.filter((r) => r.id).map((r) => r.id);
    await sb.from("rewards").upsert(blob.rewards.filter((r) => r.id).map((r) => ({
      id: r.id,
      merchant_id: tenantId,
      name: r.name ?? "",
      description: r.description ?? "",
      emoji: r.emoji ?? "🎁",
      cost: Math.max(1, r.cost ?? 1),
      mode: r.mode === "points" ? "points" : "stamps",
      usage_count: r.usageCount ?? 0,
    })));
    const del = sb.from("rewards").delete().eq("merchant_id", tenantId);
    await (keep.length ? del.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`) : del);
  }

  if (blob.products) {
    const keep = blob.products.filter((p) => p.id).map((p) => p.id);
    await sb.from("products").upsert(blob.products.filter((p) => p.id).map((p) => ({
      id: p.id,
      merchant_id: tenantId,
      name: p.name ?? "",
      description: p.description ?? "",
      price: p.price ?? 0,
      category: p.category ?? "",
      active: p.active ?? true,
      points_value: p.pointsValue ?? 0,
    })));
    const del = sb.from("products").delete().eq("merchant_id", tenantId);
    await (keep.length ? del.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`) : del);
  }
}
