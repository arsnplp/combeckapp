import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getTenantSettings, saveTenantSettings } from "@/lib/settings-db";
import { walletNotificationService } from "@/lib/wallet-notification-service";
import { walletDb_deletePassesForCards } from "@/lib/wallet-db";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const [blob, dbUser] = await Promise.all([
    getTenantSettings(session.user.id),
    getUserById(session.user.id),
  ]);
  return NextResponse.json({ ...blob, plan: dbUser?.plan ?? "starter" });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const tenantId = session.user.id;
    const body = await req.json();
    const {
      confirmedCardDeletions, deletedCardIds, deletedRewardIds, deletedProductIds, ...blob
    } = body as {
      confirmedCardDeletions?: string[];
      deletedCardIds?: string[];
      deletedRewardIds?: string[];
      deletedProductIds?: string[];
    } & Record<string, unknown>;

    // ── Garde-fou : suppression de carte avec des clients dessus ──────────
    // La cascade FK efface les customer_cards (tampons/points des clients).
    // On se base sur la liste EXPLICITE deletedCardIds (jamais déduite en
    // comparant à l'état existant — sinon un onglet resté périmé, qui ne
    // connaît pas encore une carte créée ailleurs, la supprimerait par erreur
    // au prochain autosave).
    if (deletedCardIds?.length) {
      const sb = supabase();
      const confirmed = new Set(confirmedCardDeletions ?? []);
      const { data: cardsToDelete } = await sb.from("loyalty_cards")
        .select("id, name").in("id", deletedCardIds).eq("merchant_id", tenantId);
      for (const card of cardsToDelete ?? []) {
        const { count } = await sb.from("customer_cards")
          .select("id", { count: "exact", head: true })
          .eq("card_id", card.id).eq("merchant_id", tenantId);
        if ((count ?? 0) > 0 && !confirmed.has(card.id)) {
          return NextResponse.json({
            error: `La carte « ${card.name} » compte ${count} client${(count ?? 0) > 1 ? "s" : ""}. Confirmez la suppression pour effacer définitivement leurs tampons/points.`,
            cardId: card.id,
            clients: count,
            needsConfirmation: true,
          }, { status: 409 });
        }
      }
      // Suppression confirmée : purger les pass wallet des clients concernés
      // AVANT la cascade (sinon pass orphelins qui reçoivent encore les pushs)
      const { data: ccs } = await sb.from("customer_cards")
        .select("id").in("card_id", deletedCardIds).eq("merchant_id", tenantId);
      await walletDb_deletePassesForCards((ccs ?? []).map((c) => c.id));
    }

    await saveTenantSettings(tenantId, blob as Parameters<typeof saveTenantSettings>[1], {
      cardIds: deletedCardIds, rewardIds: deletedRewardIds, productIds: deletedProductIds,
    });
    // Répercuter le nouveau design/config sur les cartes wallet déjà installées
    // (fire-and-forget : la sauvegarde ne doit pas attendre les pushs)
    walletNotificationService.refreshTenantPasses(tenantId).catch(console.error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
