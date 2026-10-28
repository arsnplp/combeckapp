import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { GAME_KEYS, GAME_META, GameConfig, GameKey, RewardRef, validateConfig } from "@/lib/games";
import { getGameConfigs, saveGameConfig, withRealWinCounts } from "@/lib/games-db";

/** Unité de la carte du commerce (une seule carte par commerce). */
async function loadCardMode(merchantId: string): Promise<"stamps" | "points"> {
  const { data } = await supabase().from("loyalty_cards")
    .select("loyalty_mode, active").eq("merchant_id", merchantId).order("created_at");
  const carte = (data ?? []).find((c) => c.active !== false) ?? (data ?? [])[0];
  return carte?.loyalty_mode === "points" ? "points" : "stamps";
}

/**
 * Ajoute à la validation l'erreur « mauvaise unité » : un jeu réglé en
 * tampons alors que la carte fonctionne en points (ou l'inverse) n'est
 * jouable par personne. Réenregistrer le jeu le remet dans la bonne unité.
 */
function withCardMode(v: ReturnType<typeof validateConfig>, c: GameConfig, cardMode: "stamps" | "points") {
  if (c.costType === cardMode) return v;
  const unite = cardMode === "points" ? "points" : "tampons";
  return {
    ...v,
    valid: false,
    errors: [...v.errors, `Votre carte fonctionne en ${unite} : réglez le coût de ce jeu en ${unite} et enregistrez-le à nouveau.`],
  };
}

/** Nombres entiers bornés : le navigateur ne décide pas des valeurs extrêmes. */
function entier(v: unknown, min: number, max: number, defaut: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
}

/** Configuration des jeux, côté commerçant. */

async function loadRewards(merchantId: string): Promise<RewardRef[]> {
  const { data } = await supabase().from("rewards")
    .select("id, name, emoji, cost, mode").eq("merchant_id", merchantId);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "Récompense",
    emoji: (r.emoji as string) ?? "🎁",
  }));
}

export async function GET() {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const [configsBrutes, rewards, cardMode] = await Promise.all([getGameConfigs(tenantId), loadRewards(tenantId), loadCardMode(tenantId)]);
  const configs = await Promise.all(configsBrutes.map((c) => withRealWinCounts(tenantId, c)));
  const { data: m } = await supabase().from("merchants")
    .select("wallet_config").eq("id", tenantId).maybeSingle();
  const flag = ((m?.wallet_config ?? {}) as Record<string, unknown>).games as { enabled?: boolean } | undefined;

  return NextResponse.json({
    moduleEnabled: Boolean(flag?.enabled),
    cardMode,
    rewards,
    games: configs.map((c) => ({
      ...c,
      ...GAME_META[c.gameKey],
      validation: withCardMode(validateConfig(c, rewards), c, cardMode),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const config = body?.config as GameConfig | undefined;
  if (!config || !GAME_KEYS.includes(config.gameKey)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const [rewards, cardMode] = await Promise.all([loadRewards(tenantId), loadCardMode(tenantId)]);

  // Valeurs nettoyées : entiers bornés, et coût toujours dans l'unité de la
  // carte. Un jeu payé en tampons sur une carte à points ne pouvait être joué
  // par personne, sans que rien ne le signale.
  const propre: GameConfig = {
    gameKey: config.gameKey as GameKey,
    enabled: Boolean(config.enabled),
    cost: entier(config.cost, 1, cardMode === "points" ? 100000 : 50, 2),
    costType: cardMode,
    dailyLimit: entier(config.dailyLimit, 1, 50, 3),
    loseProbability: entier(config.loseProbability, 0, 100, 40),
    prizes: (Array.isArray(config.prizes) ? config.prizes : [])
      .filter((p) => p && typeof p.rewardId === "string")
      .map((p) => ({
        rewardId: p.rewardId,
        probability: entier(p.probability, 0, 100, 0),
        stock: p.stock === null || p.stock === undefined || (p.stock as unknown) === "" ? null : entier(p.stock, 0, 1000000, 0),
        // Jamais repris du navigateur : un onglet resté ouvert renvoyait un
        // compteur périmé et « rendait » des lots déjà gagnés au stock.
        wonCount: 0,
      })),
  };
  const validation = validateConfig(propre, rewards);

  // Un jeu invalide peut être enregistré (le commerçant règle en plusieurs
  // fois) mais pas activé : sinon un client tomberait sur un tirage cassé.
  if (propre.enabled && !validation.valid) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Configuration incomplète.", validation },
      { status: 422 },
    );
  }

  // Les lots pointant sur une récompense disparue sortent du tirage plutôt
  // que de rester là à ne jamais pouvoir être gagnés.
  const nettoye: GameConfig = {
    ...propre,
    prizes: propre.prizes.filter((p) => !validation.orphans.includes(p.rewardId)),
  };

  // Le compteur affiché est recalculé depuis les vraies parties gagnées.
  await saveGameConfig(tenantId, await withRealWinCounts(tenantId, nettoye));
  const rafraichi = await Promise.all((await getGameConfigs(tenantId)).map((c) => withRealWinCounts(tenantId, c)));
  return NextResponse.json({
    ok: true,
    games: rafraichi.map((c) => ({ ...c, ...GAME_META[c.gameKey], validation: withCardMode(validateConfig(c, rewards), c, cardMode) })),
  });
}

/** Interrupteur du module entier, pour la démo. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  const tenantId = session?.user?.id;
  if (!tenantId || tenantId === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { enabled } = await req.json().catch(() => ({}));
  const sb = supabase();
  const { data: m } = await sb.from("merchants").select("wallet_config").eq("id", tenantId).maybeSingle();
  const wc = (m?.wallet_config ?? {}) as Record<string, unknown>;
  await sb.from("merchants")
    .update({ wallet_config: { ...wc, games: { enabled: Boolean(enabled) } } })
    .eq("id", tenantId);
  return NextResponse.json({ ok: true, moduleEnabled: Boolean(enabled) });
}
