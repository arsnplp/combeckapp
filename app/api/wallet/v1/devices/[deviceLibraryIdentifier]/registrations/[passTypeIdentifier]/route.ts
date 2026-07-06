import { NextRequest, NextResponse } from "next/server";
import { walletDb_getPassesForDevice } from "@/lib/wallet-db";

type Params = { deviceLibraryIdentifier: string; passTypeIdentifier: string };

/**
 * GET — returns serial numbers of passes updated since passesUpdatedSince.
 * Apple calls this after receiving an APNs push to know which passes changed.
 * Response: { "lastUpdated": "ISO-date", "serialNumbers": [...] }
 * Apple docs: respond 200 with body, or 204 if nothing to update.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
  const passTypeId = decodeURIComponent(passTypeIdentifier);
  const updatedSince = req.nextUrl.searchParams.get("passesUpdatedSince") ?? undefined;

  const passes = walletDb_getPassesForDevice(deviceLibraryIdentifier, passTypeId, updatedSince);

  if (passes.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const lastUpdated = passes.reduce((latest, p) =>
    p.updatedAt > latest ? p.updatedAt : latest, passes[0].updatedAt
  );

  return NextResponse.json({
    lastUpdated,
    serialNumbers: passes.map((p) => p.serialNumber),
  });
}
