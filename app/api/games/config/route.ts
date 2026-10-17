import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { GAME_KEYS, GAME_META, GameConfig, GameKey, RewardRef, validateConfig } from "@/lib/games";
import { getGameConfigs, saveGameConfig } from "@/lib/games-db";

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

  const [configs, rewards] = await Promise.all([getGameConfigs(tenantId), loadRewards(tenantId)]);
  const { data: m } = await supabase().from("merchants")
    .select("wallet_config").eq("id", tenantId).maybeSingle();
  const flag = ((m?.wallet_config ?? {}) as Record<string, unknown>).games as { enabled?: boolean } | undefined;

  return NextResponse.json({
    moduleEnabled: Boolean(flag?.enabled),
    rewards,
    games: configs.map((c) => ({
      ...c,
      ...GAME_META[c.gameKey],
      validation: validateConfig(c, rewards),
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

  const rewards = await loadRewards(tenantId);
  const validation = validateConfig(config, rewards);

  // Un jeu invalide peut être enregistré (le commerçant règle en plusieurs
  // fois) mais pas activé : sinon un client tomberait sur un tirage cassé.
  if (config.enabled && !validation.valid) {
    return NextResponse.json(
      { error: validation.errors[0] ?? "Configuration incomplète.", validation },
      { status: 422 },
    );
  }

  // Les lots pointant sur une récompense disparue sortent du tirage plutôt
  // que de rester là à ne jamais pouvoir être gagnés.
  const nettoye: GameConfig = {
    ...config,
    gameKey: config.gameKey as GameKey,
    prizes: config.prizes.filter((p) => !validation.orphans.includes(p.rewardId)),
  };

  await saveGameConfig(tenantId, nettoye);
  const rafraichi = await getGameConfigs(tenantId);
  return NextResponse.json({
    ok: true,
    games: rafraichi.map((c) => ({ ...c, ...GAME_META[c.gameKey], validation: validateConfig(c, rewards) })),
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
