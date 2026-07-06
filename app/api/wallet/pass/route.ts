import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { generateClientPass } from "@/lib/apple-wallet";
import { walletDb_upsertPass, walletDb_getPassBySerial } from "@/lib/wallet-db";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  // warm=1 is just a pre-compile ping — return early
  if (p.get("warm") === "1") {
    return NextResponse.json({ ok: true });
  }

  const type         = (p.get("type") ?? "stamps") as "stamps" | "points";
  const clientName   = decodeURIComponent(p.get("name") ?? "Client");
  const clientId     = p.get("clientId") ?? `c${Date.now()}`;
  const customerCardId = p.get("ccId") ?? undefined;
  const stamps       = Math.max(0, parseInt(p.get("stamps") ?? "0") || 0);
  const stampsRequired = Math.max(1, parseInt(p.get("required") ?? "8") || 8);
  const points       = Math.max(0, parseInt(p.get("points") ?? "0") || 0);
  const nextReward   = decodeURIComponent(p.get("reward") ?? "");
  const storeName    = decodeURIComponent(p.get("store") ?? "ComeBack");
  const accentColor  = p.get("accent") ?? "#f59e0b";
  const bgColor      = p.get("bg") ?? "#1a0a00";
  const passOrigin   = req.nextUrl.origin;

  // Stable pass identity — reuse existing serial if the same ccId is re-downloaded
  const serialNumber = customerCardId
    ? `cc-${customerCardId}`
    : `c-${clientId}-${Date.now()}`;

  // Réutiliser le token existant si ce pass a déjà été émis — sinon Apple Wallet
  // garde l'ancien token et ne peut plus authentifier les mises à jour (401).
  const existingPass = walletDb_getPassBySerial(serialNumber);
  const authenticationToken = existingPass?.authenticationToken ?? randomBytes(20).toString("hex");
  const webServiceURL = process.env.WALLET_WEB_SERVICE_URL; // e.g. https://app.comeback.app/api/wallet

  try {
    const buffer = await generateClientPass({
      type, clientName, clientId, customerCardId, passOrigin,
      stamps, stampsRequired, points, nextReward, storeName, accentColor, bgColor,
      serialNumber, authenticationToken, webServiceURL,
    });

    // Persist pass metadata so the web service can regenerate it on update
    if (customerCardId) {
      walletDb_upsertPass({
        id: `wp-${serialNumber}`,
        serialNumber,
        authenticationToken,
        customerId: clientId,
        customerCardId,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID ?? "pass.comeback",
        updatedAt: new Date().toISOString(),
        passData: {
          type, clientName, clientId: clientId, stampsRequired,
          nextReward, storeName, accentColor, bgColor, passOrigin,
        },
      });
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="pass-${clientId}.pkpass"`,
        "Cache-Control": "no-store",
        "Last-Modified": new Date().toUTCString(),
      },
    });
  } catch (err) {
    console.error("[wallet/pass]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pass generation failed" },
      { status: 500 }
    );
  }
}
