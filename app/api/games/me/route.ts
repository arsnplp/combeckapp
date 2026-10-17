import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveClientSession } from "@/lib/client-sessions";
import { supabase } from "@/lib/supabase";
import { effectiveOdds, GAME_META, RewardRef, validateConfig } from "@/lib/games";
import { countPlaysToday, getClientPrizes, getGameConfigs } from "@/lib/games-db";

/**
 * Ce que le client voit dans son onglet Jeux : les jeux réellement
 * jouables chez chacun de ses commerces, ses soldes, les chances
 * annoncées (transparence obligatoire), et ses lots déjà gagnés.
 */

export async function GET() {
  const token = (await cookies()).get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const sb = supabase();
  const { data: customers } = await sb.from("customers")
    .select("id, merchant_id, name").ilike("email", email);

  const resultat: unknown[] = [];
  let prizes: unknown[] = [];

  for (const cust of customers ?? []) {
    const merchantId = cust.merchant_id as string;

    const { data: merchant } = await sb.from("merchants")
      .select("store_name, wallet_config").eq("id", merchantId).maybeSingle();
    // Module derrière un interrupteur par commerçant.
    const flag = ((merchant?.wallet_config ?? {}) as Record<string, unknown>).games as
      { enabled?: boolean } | undefined;
    if (!flag?.enabled) continue;

    const configs = (await getGameConfigs(merchantId)).filter((c) => c.enabled);
    if (configs.length === 0) continue;

    const { data: cards } = await sb.from("customer_cards")
      .select("id, stamps, points").eq("customer_id", cust.id).eq("merchant_id", merchantId);
    const card = (cards ?? [])[0];
    if (!card) continue;

    const { data: rewardRows } = await sb.from("rewards")
      .select("id, name, emoji").eq("merchant_id", merchantId);
    const rewards: RewardRef[] = (rewardRows ?? []).map((r) => ({
      id: r.id as string, name: (r.name as string) ?? "Récompense", emoji: (r.emoji as string) ?? "🎁",
    }));

    const jeux = [];
    for (const c of configs) {
      if (!validateConfig(c, rewards).valid) continue;
      jeux.push({
        gameKey: c.gameKey,
        ...GAME_META[c.gameKey],
        cost: c.cost,
        costType: c.costType,
        dailyLimit: c.dailyLimit,
        playsToday: await countPlaysToday(merchantId, c.gameKey, cust.id as string),
        odds: effectiveOdds(c, rewards),
      });
    }
    if (jeux.length === 0) continue;

    resultat.push({
      merchantId,
      storeName: (merchant?.store_name as string) ?? "Commerce",
      customerCardId: card.id,
      customerName: (cust.name as string) ?? "",
      stamps: card.stamps ?? 0,
      points: card.points ?? 0,
      games: jeux,
    });

    const mesLots = await getClientPrizes(cust.id as string);
    prizes = prizes.concat(mesLots.map((p) => ({
      code: p.prizeCode,
      name: p.rewardName,
      emoji: p.rewardEmoji,
      wonAt: p.playedAt,
      storeName: (merchant?.store_name as string) ?? "Commerce",
      game: GAME_META[p.gameKey]?.name ?? p.gameKey,
    })));
  }

  return NextResponse.json({ stores: resultat, prizes });
}
