import { NextRequest, NextResponse } from "next/server";
import { resolveActor } from "@/lib/actor";
import { logActivity } from "@/lib/activity-log";
import { getRedemption, markUsed } from "@/lib/redemptions";
import { consumePrize, getPrizeByCode } from "@/lib/games-db";
import { db_deductReward, db_getAll, db_addRedemption, db_incrementRewardUsage } from "@/lib/server-db";
import { walletNotificationService } from "@/lib/wallet-notification-service";
import { getUserById } from "@/lib/users";
import { isTrialExpired } from "@/lib/plan-billing";

// Verrou en mémoire — évite le double-scan simultané du même QR
const processingTokens = new Set<string>();

export async function POST(req: NextRequest) {
  // Validation d'une récompense : accessible au commerçant comme à l'employé
  const resolved = await resolveActor(req);
  if (!resolved) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { tenantId, actor } = resolved;

  // Essai gratuit expiré : service suspendu
  if (isTrialExpired(await getUserById(tenantId))) {
    return NextResponse.json({ error: "Essai terminé — choisissez un plan pour continuer." }, { status: 403 });
  }

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token manquant." }, { status: 400 });
  }

  const tokenKey = token.trim();
  if (processingTokens.has(tokenKey)) {
    return NextResponse.json({ error: "QR déjà en cours de traitement." }, { status: 429 });
  }
  processingTokens.add(tokenKey);

  const r = await getRedemption(tokenKey);

  try {
    // Lot gagné à un jeu. Il vit dans le stock du client et n'expire pas :
    // il a déjà payé en jouant, il l'utilise quand il veut. Le scan le
    // consomme une fois pour toutes.
    if (!r) {
      const lot = await getPrizeByCode(tokenKey);
      if (lot) {
        if (lot.merchantId !== tenantId) {
          return NextResponse.json({ error: "Ce lot n'appartient pas à votre établissement." }, { status: 403 });
        }
        if (lot.usedAt) {
          return NextResponse.json({ error: "Ce lot a déjà été utilisé." }, { status: 409 });
        }
        const consomme = await consumePrize(tokenKey);
        if (!consomme) {
          return NextResponse.json({ error: "Ce lot vient d'être utilisé." }, { status: 409 });
        }
        const sb0 = await db_getAll(tenantId);
        const client = sb0.customers.find((c) => c.id === lot.customerId);
        await logActivity(tenantId, {
          type: "reward",
          customerId: lot.customerId,
          customerCardId: lot.customerCardId,
          label: `Lot gagné au jeu : ${lot.rewardName ?? "Récompense"}`,
        }, actor).catch(() => {});
        return NextResponse.json({
          ok: true,
          customerName: client?.name ?? "Client",
          rewardName: lot.rewardName ?? "Récompense",
          rewardEmoji: lot.rewardEmoji ?? "🎁",
          costType: "game",
          cost: 0,
          fromGame: true,
        });
      }
      return NextResponse.json({ error: "QR code invalide ou inexistant." }, { status: 404 });
    }
    if (r.used) return NextResponse.json({ error: "Ce QR code a déjà été utilisé." }, { status: 409 });
    if (r.exp < Date.now()) return NextResponse.json({ error: "Ce QR code a expiré." }, { status: 410 });
    if (r.tenantId !== tenantId) {
      return NextResponse.json({ error: "Ce QR code n'appartient pas à votre établissement." }, { status: 403 });
    }

    const db = await db_getAll(tenantId);
    const cc = db.customerCards.find((c) => c.id === r.customerCardId);
    const customer = db.customers.find((c) => c.id === r.customerId);
    if (!cc) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

    if (r.costType === "stamps" && cc.stamps < r.cost) {
      return NextResponse.json({ error: `Pas assez de tampons (${cc.stamps}/${r.cost}).` }, { status: 422 });
    }
    if (r.costType === "points" && cc.points < r.cost) {
      return NextResponse.json({ error: `Pas assez de points (${cc.points}/${r.cost}).` }, { status: 422 });
    }

    // Marque le token utilisé de façon atomique AVANT de déduire — s'il a déjà
    // été consommé par un appel concurrent (deux scans quasi simultanés du
    // même QR), ce call échoue ici et n'atteint jamais db_deductReward.
    const claimed = await markUsed(tokenKey);
    if (!claimed) {
      return NextResponse.json({ error: "Ce QR code a déjà été utilisé." }, { status: 409 });
    }

    const result = await db_deductReward(tenantId, r.customerCardId, r.costType, r.cost);
    if (!result.success) {
      return NextResponse.json({ error: result.reason ?? "Erreur lors de la déduction." }, { status: 422 });
    }
    await db_incrementRewardUsage(tenantId, r.rewardName);
    logActivity(tenantId, {
      type: "reward", customerId: cc.customerId, customerCardId: r.customerCardId,
      amount: r.cost, label: `${r.rewardName} utilisé`,
    }, actor);

    // Notifier les wallets pour mettre à jour la carte en temps réel
    if (r.costType === "stamps") {
      walletNotificationService.updateStamps(r.customerCardId).catch(console.error);
    } else {
      walletNotificationService.updatePoints(r.customerCardId).catch(console.error);
    }

    await db_addRedemption(tenantId, {
      customerId: r.customerId,
      customerCardId: r.customerCardId,
      rewardName: r.rewardName,
      rewardEmoji: r.rewardEmoji,
      cost: r.cost,
      costType: r.costType,
      redeemedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      customerName: customer?.name ?? "Client",
      rewardName: r.rewardName,
      rewardEmoji: r.rewardEmoji,
      costType: r.costType,
      cost: r.cost,
    });
  } finally {
    processingTokens.delete(tokenKey);
  }
}
