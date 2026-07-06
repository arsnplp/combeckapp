import { NextRequest, NextResponse } from "next/server";
import { findTenantByCustomerCardId, db_getAll } from "@/lib/server-db";
import { buildGoogleWalletUrl } from "@/lib/google-wallet";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest) {
  const ccId = req.nextUrl.searchParams.get("ccId");
  if (!ccId) return NextResponse.json({ error: "ccId manquant." }, { status: 400 });

  const found = findTenantByCustomerCardId(ccId);
  if (!found) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const { tenantId, card: cc } = found;
  const db = db_getAll(tenantId);
  const customer = db.customers.find((c) => c.id === cc.customerId);
  if (!customer) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

  let storeName = "ComeBack";
  let loyaltyMode: "stamps" | "points" = "stamps";
  let stampsRequired = 8;
  let accentColor = "#2563eb";
  let bgColor = "#1e293b";
  let cardName = "Carte fidélité";

  try {
    const settingsPath = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    storeName = settings.settings?.storeName ?? storeName;
    const loyaltyCard = (settings.loyaltyCards ?? []).find((c: { id: string }) => c.id === cc.cardId);
    if (loyaltyCard) {
      loyaltyMode = loyaltyCard.loyaltyMode ?? "stamps";
      stampsRequired = loyaltyCard.stampsRequired ?? 8;
      accentColor = loyaltyCard.accentColor ?? accentColor;
      bgColor = loyaltyCard.backgroundColor ?? bgColor;
      cardName = loyaltyCard.name ?? cardName;
    }
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
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[google-wallet]", err);
    return NextResponse.json({ error: "Google Wallet non configuré." }, { status: 503 });
  }
}
