import { NextRequest, NextResponse } from "next/server";
import { buildGoogleWalletUrl } from "@/lib/google-wallet";

// Endpoint de TEST — génère un lien Google Wallet avec des données arbitraires.
// À SUPPRIMER (ou protéger) une fois l'intégration validée en production.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // corps vide accepté — tout a une valeur par défaut
  }

  const input = {
    tenantId: String(body.tenantId ?? "test_tenant_123"),
    cardId: String(body.cardId ?? "card_test"),
    customerCardId: String(body.customerCardId ?? "cc_test_456"),
    customerName: String(body.customerName ?? "Jean Dupont"),
    storeName: String(body.storeName ?? "Mon Commerce"),
    cardName: String(body.cardName ?? "Carte Fidélité"),
    loyaltyMode: (body.loyaltyMode === "points" ? "points" : "stamps") as "stamps" | "points",
    stamps: Number(body.stamps ?? 3),
    stampsRequired: Number(body.stampsRequired ?? 8),
    points: Number(body.points ?? 150),
    totalVisits: Number(body.totalVisits ?? 5),
    bgColor: String(body.bgColor ?? "#0F9D58"),
    accentColor: String(body.accentColor ?? "#16a34a"),
  };

  try {
    const walletLink = await buildGoogleWalletUrl(input);
    console.log(`[test-google-wallet] ✓ Lien généré pour ${input.customerCardId} (${input.storeName})`);
    return NextResponse.json({ success: true, walletLink });
  } catch (err) {
    console.error("[test-google-wallet] Échec:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." },
      { status: 500 },
    );
  }
}
