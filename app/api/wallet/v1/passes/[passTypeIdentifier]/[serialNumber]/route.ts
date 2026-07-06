import { NextRequest, NextResponse } from "next/server";
import { walletDb_getPassBySerial } from "@/lib/wallet-db";
import { regeneratePass } from "@/lib/wallet-notification-service";

type Params = { passTypeIdentifier: string; serialNumber: string };

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * GET — returns the latest version of a pass.
 * Apple calls this after an APNs push to fetch the updated .pkpass.
 * Authorization: ApplePass {authenticationToken}
 * If-Modified-Since: "date" — respond 304 if not changed since then.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { serialNumber } = await params;
  const token = extractToken(req);

  const walletPass = await walletDb_getPassBySerial(serialNumber);
  if (!walletPass || walletPass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Honour If-Modified-Since
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince);
    const updatedAt = new Date(walletPass.updatedAt);
    if (updatedAt <= since) {
      return new NextResponse(null, { status: 304 });
    }
  }

  try {
    const buffer = await regeneratePass(walletPass.id);
    if (!buffer) return NextResponse.json({ error: "Pass not found" }, { status: 404 });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": new Date(walletPass.updatedAt).toUTCString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[wallet/v1/passes]", err);
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
