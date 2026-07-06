import { NextRequest, NextResponse } from "next/server";
import { db_getAll } from "@/lib/server-db";
import { findClientCards } from "@/lib/client-lookup";
import { createRedemption, cancelPendingForCard } from "@/lib/redemptions";
import { resolveClientSession } from "@/lib/client-sessions";

const QR_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { customerCardId, rewardId } = await req.json();
  if (!customerCardId || !rewardId) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  // Trouver la carte client
  const allCards = await findClientCards(email);
  const clientCard = allCards.find((c) => c.customerCardId === customerCardId);
  if (!clientCard) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  // Trouver la récompense
  const reward = clientCard.rewards.find((r) => r.id === rewardId);
  if (!reward) return NextResponse.json({ error: "Récompense introuvable." }, { status: 404 });

  const isReferral = reward.referral === true;
  const costType: "stamps" | "points" | "referral" = isReferral ? "referral" : reward.mode as "stamps" | "points";
  const cost = reward.cost;

  // Vérifier solde en temps réel (re-lit le fichier)
  const db = await db_getAll(clientCard.tenantId);
  const cc = db.customerCards.find((c) => c.id === customerCardId);
  if (!cc) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  if (costType === "stamps" && cc.stamps < cost) {
    return NextResponse.json({
      error: `Pas assez de tampons. Tu en as ${cc.stamps} sur ${cost} nécessaires.`,
    }, { status: 422 });
  }
  if (costType === "points" && cc.points < cost) {
    return NextResponse.json({
      error: `Pas assez de points. Tu en as ${cc.points} sur ${cost} nécessaires.`,
    }, { status: 422 });
  }
  if (costType === "referral" && ((cc as { referralPoints?: number }).referralPoints ?? 0) < cost) {
    return NextResponse.json({
      error: `Pas assez de points de parrainage. Tu en as ${(cc as { referralPoints?: number }).referralPoints ?? 0} sur ${cost} nécessaires.`,
    }, { status: 422 });
  }

  // Cancel any existing pending QR for this card before creating a new one
  await cancelPendingForCard(customerCardId);

  const redemption = await createRedemption({
    tenantId: clientCard.tenantId,
    customerId: clientCard.customerId,
    customerCardId,
    cardId: clientCard.cardId,
    rewardName: reward.name,
    rewardEmoji: reward.emoji ?? "🎁",
    cost,
    costType,
    exp: Date.now() + QR_TTL_MS,
  });

  return NextResponse.json({
    token: redemption.token,
    rewardName: redemption.rewardName,
    rewardEmoji: redemption.rewardEmoji,
    storeName: clientCard.storeName,
    cost,
    costType,
    exp: redemption.exp,
  });
}
