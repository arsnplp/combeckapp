import { NextRequest, NextResponse } from "next/server";
import { findTenantByCustomerCardId, db_getAll } from "@/lib/server-db";
import { buildGoogleWalletUrl } from "@/lib/google-wallet";
import { getTenantSettings } from "@/lib/settings-db";

export async function GET(req: NextRequest) {
  const ccId = req.nextUrl.searchParams.get("ccId");
  if (!ccId) return NextResponse.json({ error: "ccId manquant." }, { status: 400 });

  const found = await findTenantByCustomerCardId(ccId);
  if (!found) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const { tenantId, card: cc } = found;
  const db = await db_getAll(tenantId);
  const customer = db.customers.find((c) => c.id === cc.customerId);
  if (!customer) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

  let storeName = "ComeBack";
  let loyaltyMode: "stamps" | "points" = "stamps";
  let stampsRequired = 8;
  let accentColor = "#16a34a";
  let bgColor = "#1e293b";
  let cardName = "Carte fidélité";
  let nextReward: string | undefined;

  try {
    const settings = await getTenantSettings(tenantId);
    storeName = (settings.settings.storeName as string) || storeName;
    const loyaltyCard = settings.loyaltyCards.find((c) => c.id === cc.cardId);
    if (loyaltyCard) {
      loyaltyMode = loyaltyCard.loyaltyMode ?? "stamps";
      stampsRequired = loyaltyCard.stampsRequired ?? 8;
      accentColor = loyaltyCard.accentColor ?? accentColor;
      bgColor = loyaltyCard.backgroundColor ?? bgColor;
      cardName = loyaltyCard.name ?? cardName;
    }
    nextReward = settings.rewards
      .filter((r) => r.mode === loyaltyMode)
      .sort((a, b) => a.cost - b.cost)[0]?.name;
  } catch {
    // defaults
  }

  try {
    const url = await buildGoogleWalletUrl({
      tenantId,
      cardId: cc.cardId,
      customerCardId: ccId,
      customerName: customer.name ?? "Client",
      storeName,
      cardName,
      loyaltyMode,
      stamps: cc.stamps ?? 0,
      stampsRequired,
      points: cc.points ?? 0,
      totalVisits: customer.totalVisits ?? 0,
      bgColor,
      accentColor,
      nextReward,
      referralCount: (cc as { referralCount?: number }).referralCount ?? 0,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[google-wallet]", err);
    return NextResponse.json({ error: "Google Wallet non configuré." }, { status: 503 });
  }
}
