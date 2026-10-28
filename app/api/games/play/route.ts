import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveClientSession } from "@/lib/client-sessions";
import { supabase } from "@/lib/supabase";
import { db_deductReward, db_refundBalance } from "@/lib/server-db";
import { draw, GAME_KEYS, GameKey, hasWinnablePrize, RewardRef, validateConfig } from "@/lib/games";
import {
  countPlaysToday, countWinsByReward, getGameConfigs, insertPlay, syncPrizeWonCounts, withRealWinCounts,
} from "@/lib/games-db";
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
    .select("id, merchant_id, customer_id, card_id, stamps, points").eq("id", customerCardId).maybeSingle();
  if (!cc) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const { data: cust } = await sb.from("customers")
    .select("id, email, name").eq("id", cc.customer_id).maybeSingle();
  if (!cust || (cust.email ?? "").toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Cette carte n'est pas la vôtre." }, { status: 403 });
  }

  const merchantId = cc.merchant_id as string;

  // Module éteint par le commerçant : plus aucune partie, même si un client
  // avait encore la page ouverte (l'onglet Jeux le masquait déjà).
  const { data: merchant } = await sb.from("merchants")
    .select("wallet_config").eq("id", merchantId).maybeSingle();
  const flag = ((merchant?.wallet_config ?? {}) as Record<string, unknown>).games as { enabled?: boolean } | undefined;
  if (!flag?.enabled) {
    return NextResponse.json({ error: "Les jeux ne sont pas disponibles chez ce commerce." }, { status: 409 });
  }

  const configs = await getGameConfigs(merchantId);
  const rawConfig = configs.find((c) => c.gameKey === gameKey);
  if (!rawConfig?.enabled) {
    return NextResponse.json({ error: "Ce jeu n'est pas disponible." }, { status: 409 });
  }

  // Un jeu payé en tampons sur une carte à points (ou l'inverse) ne peut être
  // joué par personne : on le dit au lieu d'annoncer « solde insuffisant ».
  const { data: lc } = await sb.from("loyalty_cards")
    .select("loyalty_mode").eq("id", cc.card_id).maybeSingle();
  const cardMode = lc?.loyalty_mode === "points" ? "points" : "stamps";
  if (rawConfig.costType !== cardMode) {
    return NextResponse.json({ error: "Ce jeu est en cours de réglage, réessayez plus tard." }, { status: 409 });
  }

  // Stock calculé sur les vraies parties gagnées, pas sur un compteur.
  const config = await withRealWinCounts(merchantId, rawConfig);

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

  // Tous les lots épuisés : la partie serait perdue d'avance.
  if (!hasWinnablePrize(config, rewards)) {
    return NextResponse.json({ error: "Plus aucun lot à gagner pour le moment. Revenez bientôt !" }, { status: 409 });
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
  let prizeCode = gagne ? crypto.randomUUID() : null;

  const enregistre = await insertPlay({
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

  if (!enregistre) {
    // Partie impossible à enregistrer : on rend la mise, le client ne paie
    // pas une partie qui n'existe nulle part.
    await db_refundBalance(merchantId, customerCardId, config.costType, config.cost);
    return NextResponse.json({ error: "La partie n'a pas pu être enregistrée. Vos tampons vous ont été rendus." }, { status: 500 });
  }

  // Deux parties simultanées peuvent viser le dernier lot d'un stock. On
  // recompte après coup : celle qui dépasse le stock devient une partie
  // perdue (la mise reste due, comme pour toute partie perdue).
  let lotFinal = gagne;
  if (gagne) {
    const prize = config.prizes.find((p) => p.rewardId === gagne.id);
    if (prize && prize.stock !== null) {
      const gagnes = (await countWinsByReward(merchantId, gameKey as GameKey)).get(gagne.id) ?? 0;
      if (gagnes > prize.stock) {
        await sb.from("game_plays")
          .update({ result_type: "lose", reward_id: null, reward_name: null, reward_emoji: null, prize_code: null })
          .eq("id", playId);
        lotFinal = null;
        prizeCode = null;
      }
    }
    syncPrizeWonCounts(merchantId, gameKey as GameKey).catch(() => {});
  }

  // Le solde a changé : la carte Wallet doit suivre.
  walletNotificationService.updateStamps(customerCardId).catch(() => {});

  return NextResponse.json({
    result: lotFinal ? "win" : "lose",
    reward: lotFinal ? { id: lotFinal.id, name: lotFinal.name, emoji: lotFinal.emoji } : null,
    prizeCode,
    balance: config.costType === "points" ? debit.card?.points : debit.card?.stamps,
    playsLeft: Math.max(0, config.dailyLimit - joueesAujourdhui - 1),
  });
}
