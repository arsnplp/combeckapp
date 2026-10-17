import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveClientSession } from "@/lib/client-sessions";
import { supabase } from "@/lib/supabase";
import { db_deductReward } from "@/lib/server-db";
import { draw, GAME_KEYS, GameKey, RewardRef, validateConfig } from "@/lib/games";
import { bumpPrizeWonCount, countPlaysToday, getGameConfigs, insertPlay } from "@/lib/games-db";
import { walletNotificationService } from "@/lib/wallet-notification-service";

/**
 * Jouer une partie.
 *
 * Tout se décide ici : le front n'envoie que le jeu choisi et se contente
 * d'animer le résultat reçu. Les vérifications sont faites dans l'ordre où
 * elles coûtent le moins cher, et le débit des tampons passe par
 * `db_deductReward`, dont la garde `.gte` en base empêche un double clic
 * de jouer deux fois avec le même solde.
 */

export async function POST(req: NextRequest) {
  const token = (await cookies()).get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { gameKey, customerCardId } = await req.json().catch(() => ({}));
  if (!GAME_KEYS.includes(gameKey) || !customerCardId) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const sb = supabase();

  // La carte doit bien appartenir au client connecté : sans ce contrôle,
  // n'importe qui pourrait jouer avec la carte d'un autre.
  const { data: cc } = await sb.from("customer_cards")
    .select("id, merchant_id, customer_id, stamps, points").eq("id", customerCardId).maybeSingle();
  if (!cc) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const { data: cust } = await sb.from("customers")
    .select("id, email, name").eq("id", cc.customer_id).maybeSingle();
  if (!cust || (cust.email ?? "").toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Cette carte n'est pas la vôtre." }, { status: 403 });
  }

  const merchantId = cc.merchant_id as string;
  const configs = await getGameConfigs(merchantId);
  const config = configs.find((c) => c.gameKey === gameKey);
  if (!config?.enabled) {
    return NextResponse.json({ error: "Ce jeu n'est pas disponible." }, { status: 409 });
  }

  const { data: rewardRows } = await sb.from("rewards")
    .select("id, name, emoji").eq("merchant_id", merchantId);
  const rewards: RewardRef[] = (rewardRows ?? []).map((r) => ({
    id: r.id as string, name: (r.name as string) ?? "Récompense", emoji: (r.emoji as string) ?? "🎁",
  }));

  // Un jeu dont la config a cessé d'être valable (récompense supprimée
  // entre-temps) ne doit pas faire jouer dans le vide.
  if (!validateConfig(config, rewards).valid) {
    return NextResponse.json({ error: "Ce jeu est en cours de réglage, réessayez plus tard." }, { status: 409 });
  }

  const joueesAujourdhui = await countPlaysToday(merchantId, gameKey as GameKey, cust.id as string);
  if (joueesAujourdhui >= config.dailyLimit) {
    return NextResponse.json(
      { error: `Vous avez déjà joué ${config.dailyLimit} fois aujourd'hui. Revenez demain !`, limitReached: true },
      { status: 429 },
    );
  }

  const solde = config.costType === "points" ? (cc.points as number) : (cc.stamps as number);
  if (solde < config.cost) {
    return NextResponse.json(
      { error: `Il vous faut ${config.cost} ${config.costType === "points" ? "points" : "tampons"} pour jouer.` },
      { status: 402 },
    );
  }

  // Débit AVANT le tirage : si le solde a été consommé ailleurs entre-temps,
  // on s'arrête ici sans avoir rien attribué.
  const debit = await db_deductReward(merchantId, customerCardId, config.costType, config.cost);
  if (!debit.success) {
    return NextResponse.json({ error: debit.reason ?? "Solde insuffisant." }, { status: 402 });
  }

  const outcome = draw(config, rewards);
  const gagne = outcome.type === "win"
    ? rewards.find((r) => r.id === outcome.rewardId) ?? null
    : null;

  const playId = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const prizeCode = gagne ? crypto.randomUUID() : null;

  await insertPlay({
    id: playId,
    merchantId,
    gameKey: gameKey as GameKey,
    customerId: cust.id as string,
    customerCardId,
    playedAt: new Date().toISOString(),
    cost: config.cost,
    costType: config.costType,
    resultType: gagne ? "win" : "lose",
    rewardId: gagne?.id ?? null,
    rewardName: gagne?.name ?? null,
    rewardEmoji: gagne?.emoji ?? null,
    prizeCode,
  });

  if (gagne) await bumpPrizeWonCount(merchantId, gameKey as GameKey, gagne.id);

  // Le solde a changé : la carte Wallet doit suivre.
  walletNotificationService.updateStamps(customerCardId).catch(() => {});

  return NextResponse.json({
    result: gagne ? "win" : "lose",
    reward: gagne ? { id: gagne.id, name: gagne.name, emoji: gagne.emoji } : null,
    prizeCode,
    balance: config.costType === "points" ? debit.card?.points : debit.card?.stamps,
    playsLeft: Math.max(0, config.dailyLimit - joueesAujourdhui - 1),
  });
}
