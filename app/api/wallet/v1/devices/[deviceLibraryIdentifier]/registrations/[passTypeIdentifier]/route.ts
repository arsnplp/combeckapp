import { NextRequest, NextResponse } from "next/server";
import { walletDb_getPassesForDevice } from "@/lib/wallet-db";

type Params = { deviceLibraryIdentifier: string; passTypeIdentifier: string };

/**
 * Normalise le tag passesUpdatedSince renvoyé par l'appareil.
 * On émet un epoch millis (URL-safe). Les anciens tags étaient des dates ISO
 * avec "+00:00" — le "+" devient un espace au décodage de l'URL, ce qui
 * cassait la comparaison (les cartes ne se mettaient plus à jour).
 */
function parseUpdatedSince(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const d = new Date(Number(trimmed));
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  // Répare le "+" devenu espace ("2026-07-08T19:38:33.468 00:00")
  const repaired = trimmed.replace(/ (\d{2}:\d{2})$/, "+$1");
  const d = new Date(repaired);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * GET — returns serial numbers of passes updated since passesUpdatedSince.
 * Apple calls this after receiving an APNs push to know which passes changed.
 * Response: { "lastUpdated": "epoch-ms", "serialNumbers": [...] }
 * Apple docs: respond 200 with body, or 204 if nothing to update.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
  const passTypeId = decodeURIComponent(passTypeIdentifier);
  const updatedSince = parseUpdatedSince(req.nextUrl.searchParams.get("passesUpdatedSince"));

  const passes = await walletDb_getPassesForDevice(deviceLibraryIdentifier, passTypeId, updatedSince);

  if (passes.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const lastUpdatedIso = passes.reduce((latest, p) =>
    p.updatedAt > latest ? p.updatedAt : latest, passes[0].updatedAt
  );

  // Tag opaque URL-safe : epoch millis (l'appareil le renvoie tel quel)
  return NextResponse.json({
    lastUpdated: String(new Date(lastUpdatedIso).getTime()),
    serialNumbers: passes.map((p) => p.serialNumber),
  });
}
