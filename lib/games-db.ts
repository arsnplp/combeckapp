import { supabase } from "./supabase";
import { GAME_KEYS, GameConfig, GameKey, GamePrizeConfig, defaultConfig } from "./games";

/** Lecture / écriture du module Jeux. */

interface ConfigRow {
  id: string;
  merchant_id: string;
  game_key: string;
  enabled: boolean;
  cost: number;
  cost_type: string;
  daily_limit: number;
  lose_probability: number;
  prizes: GamePrizeConfig[];
}

export interface PlayRow {
  id: string;
  merchantId: string;
  gameKey: GameKey;
  customerId: string;
  customerCardId: string;
  playedAt: string;
  cost: number;
  costType: "stamps" | "points";
  resultType: "win" | "lose";
  rewardId: string | null;
  rewardName: string | null;
  rewardEmoji: string | null;
  prizeCode: string | null;
  usedAt: string | null;
}

function mapConfig(r: ConfigRow): GameConfig {
  return {
    gameKey: r.game_key as GameKey,
    enabled: r.enabled,
    cost: r.cost,
    costType: r.cost_type === "points" ? "points" : "stamps",
    dailyLimit: r.daily_limit,
    loseProbability: r.lose_probability,
    prizes: Array.isArray(r.prizes) ? r.prizes : [],
  };
}

function mapPlay(r: Record<string, unknown>): PlayRow {
  return {
    id: r.id as string,
    merchantId: r.merchant_id as string,
    gameKey: r.game_key as GameKey,
    customerId: r.customer_id as string,
    customerCardId: r.customer_card_id as string,
    playedAt: r.played_at as string,
    cost: (r.cost as number) ?? 0,
    costType: (r.cost_type as "stamps" | "points") ?? "stamps",
    resultType: r.result_type as "win" | "lose",
    rewardId: (r.reward_id as string) ?? null,
    rewardName: (r.reward_name as string) ?? null,
    rewardEmoji: (r.reward_emoji as string) ?? null,
    prizeCode: (r.prize_code as string) ?? null,
    usedAt: (r.used_at as string) ?? null,
  };
}

/** Les trois jeux, toujours — ceux jamais configurés reviennent par défaut. */
export async function getGameConfigs(merchantId: string): Promise<GameConfig[]> {
  const { data } = await supabase()
    .from("game_configs").select("*").eq("merchant_id", merchantId);
  const bykey = new Map((data ?? []).map((r) => [r.game_key, mapConfig(r as ConfigRow)]));
  return GAME_KEYS.map((k) => bykey.get(k) ?? defaultConfig(k));
}

export async function saveGameConfig(merchantId: string, config: GameConfig): Promise<void> {
  await supabase().from("game_configs").upsert({
    id: `gc_${merchantId}_${config.gameKey}`,
    merchant_id: merchantId,
    game_key: config.gameKey,
    enabled: config.enabled,
    cost: config.cost,
    cost_type: config.costType,
    daily_limit: config.dailyLimit,
    lose_probability: config.loseProbability,
    prizes: config.prizes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "merchant_id,game_key" });
}

/** Parties jouées aujourd'hui par ce client sur ce jeu — pour la limite. */
export async function countPlaysToday(
  merchantId: string, gameKey: GameKey, customerId: string,
): Promise<number> {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const { count } = await supabase()
    .from("game_plays")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("game_key", gameKey)
    .eq("customer_id", customerId)
    .gte("played_at", debut.toISOString());
  return count ?? 0;
}

export async function insertPlay(row: Omit<PlayRow, "usedAt">): Promise<void> {
  await supabase().from("game_plays").insert({
    id: row.id,
    merchant_id: row.merchantId,
    game_key: row.gameKey,
    customer_id: row.customerId,
    customer_card_id: row.customerCardId,
    played_at: row.playedAt,
    cost: row.cost,
    cost_type: row.costType,
    result_type: row.resultType,
    reward_id: row.rewardId,
    reward_name: row.rewardName,
    reward_emoji: row.rewardEmoji,
    prize_code: row.prizeCode,
  });
}

/** Incrémente le compteur de lots gagnés, pour la gestion du stock. */
export async function bumpPrizeWonCount(
  merchantId: string, gameKey: GameKey, rewardId: string,
): Promise<void> {
  const { data } = await supabase()
    .from("game_configs").select("prizes")
    .eq("merchant_id", merchantId).eq("game_key", gameKey).maybeSingle();
  if (!data) return;
  const prizes = (data.prizes as GamePrizeConfig[]) ?? [];
  const next = prizes.map((p) =>
    p.rewardId === rewardId ? { ...p, wonCount: (p.wonCount ?? 0) + 1 } : p);
  await supabase().from("game_configs").update({ prizes: next })
    .eq("merchant_id", merchantId).eq("game_key", gameKey);
}

/** Les lots d'un client : gagnés et pas encore utilisés. */
export async function getClientPrizes(customerId: string): Promise<PlayRow[]> {
  const { data } = await supabase()
    .from("game_plays").select("*")
    .eq("customer_id", customerId).eq("result_type", "win")
    .is("used_at", null)
    .order("played_at", { ascending: false });
  return (data ?? []).map(mapPlay);
}

/** Lot retrouvé par son code, pour la validation en caisse. */
export async function getPrizeByCode(code: string): Promise<PlayRow | null> {
  const { data } = await supabase()
    .from("game_plays").select("*").eq("prize_code", code).maybeSingle();
  return data ? mapPlay(data) : null;
}

/**
 * Consomme un lot. La clause `is("used_at", null)` est réévaluée par
 * Postgres à l'écriture : deux scans simultanés du même code ne peuvent
 * pas le consommer deux fois.
 */
export async function consumePrize(code: string): Promise<PlayRow | null> {
  const { data } = await supabase()
    .from("game_plays").update({ used_at: new Date().toISOString() })
    .eq("prize_code", code).is("used_at", null)
    .select("*").maybeSingle();
  return data ? mapPlay(data) : null;
}

export async function getPlays(merchantId: string, sinceISO?: string): Promise<PlayRow[]> {
  let q = supabase().from("game_plays").select("*")
    .eq("merchant_id", merchantId).order("played_at", { ascending: false });
  if (sinceISO) q = q.gte("played_at", sinceISO);
  const { data } = await q;
  return (data ?? []).map(mapPlay);
}
