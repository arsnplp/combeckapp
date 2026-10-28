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

/**
 * Minuit à Paris, en ISO. Le serveur tourne en UTC : `setHours(0)` faisait
 * repartir la limite quotidienne à 1 h ou 2 h du matin, heure française, et
 * un client pouvait jouer deux « journées » dans la même soirée.
 */
export function startOfTodayParisISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // Décalage Paris/UTC à cet instant (1 h l'hiver, 2 h l'été).
  const parisAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = parisAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const minuitParisAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(minuitParisAsUtc - offset).toISOString();
}

/** Parties jouées aujourd'hui (heure de Paris) par ce client sur ce jeu — pour la limite. */
export async function countPlaysToday(
  merchantId: string, gameKey: GameKey, customerId: string,
): Promise<number> {
  const debut = new Date(startOfTodayParisISO());
  const { count } = await supabase()
    .from("game_plays")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("game_key", gameKey)
    .eq("customer_id", customerId)
    .gte("played_at", debut.toISOString());
  return count ?? 0;
}

export async function insertPlay(row: Omit<PlayRow, "usedAt">): Promise<boolean> {
  const { error } = await supabase().from("game_plays").insert({
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
  // L'erreur était ignorée : le client était débité, mais sa partie (et son
  // lot s'il gagnait) n'existait nulle part.
  if (error) console.error("[games] insertPlay", error.message);
  return !error;
}

/**
 * Lots réellement gagnés par récompense, comptés dans l'historique des
 * parties. C'est la seule source fiable pour le stock : le compteur
 * `wonCount` rangé dans la config pouvait être écrasé par un enregistrement
 * de la page Jeux resté ouvert, ou perdre un gain sur deux parties
 * simultanées.
 */
export async function countWinsByReward(merchantId: string, gameKey: GameKey): Promise<Map<string, number>> {
  const { data } = await supabase()
    .from("game_plays").select("reward_id")
    .eq("merchant_id", merchantId).eq("game_key", gameKey).eq("result_type", "win");
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const id = r.reward_id as string | null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** La config avec `wonCount` recalculé depuis l'historique. */
export async function withRealWinCounts(merchantId: string, config: GameConfig): Promise<GameConfig> {
  const counts = await countWinsByReward(merchantId, config.gameKey);
  return { ...config, prizes: config.prizes.map((p) => ({ ...p, wonCount: counts.get(p.rewardId) ?? 0 })) };
}

/**
 * Recopie dans la config le nombre réel de lots gagnés (affichage de la page
 * Jeux). Le stock, lui, est toujours recalculé depuis l'historique au moment
 * du tirage : ce champ n'est qu'un reflet.
 */
export async function syncPrizeWonCounts(merchantId: string, gameKey: GameKey): Promise<void> {
  const { data } = await supabase()
    .from("game_configs").select("prizes")
    .eq("merchant_id", merchantId).eq("game_key", gameKey).maybeSingle();
  if (!data) return;
  const counts = await countWinsByReward(merchantId, gameKey);
  const prizes = ((data.prizes as GamePrizeConfig[]) ?? []).map((p) => ({ ...p, wonCount: counts.get(p.rewardId) ?? 0 }));
  await supabase().from("game_configs").update({ prizes })
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
