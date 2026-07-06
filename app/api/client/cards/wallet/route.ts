import { NextRequest, NextResponse } from "next/server";
import { findTenantByCustomerCardId, db_getAll } from "@/lib/server-db";
import path from "path";
import fs from "fs";

// Public: permet au client de retélécharger sa carte wallet avec le solde actuel
export async function GET(req: NextRequest) {
  const ccId = req.nextUrl.searchParams.get("ccId");
  if (!ccId) return NextResponse.json({ error: "ccId manquant." }, { status: 400 });

  const found = findTenantByCustomerCardId(ccId);
  if (!found) return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });

  const { tenantId, card: cc } = found;

  // Lire les données du client
  const db = db_getAll(tenantId);
  const customer = db.customers.find((c) => c.id === cc.customerId);
  if (!customer) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

  // Lire les settings du tenant (nom du commerce, carte, couleurs)
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
  } catch { /* settings manquants */ }

  const params = new URLSearchParams({
    clientId: customer.id,
    ccId,
    name: customer.name,
    type: loyaltyMode,
    stamps: String(cc.stamps),
    required: String(stampsRequired),
    points: String(cc.points),
    store: cardName,
    accent: accentColor,
    bg: bgColor,
  });

  // Rediriger vers la génération du pass
  return NextResponse.redirect(new URL(`/api/wallet/pass?${params}`, req.url));
}
