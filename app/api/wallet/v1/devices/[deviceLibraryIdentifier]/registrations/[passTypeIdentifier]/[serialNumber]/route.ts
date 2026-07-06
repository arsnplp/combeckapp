import { NextRequest, NextResponse } from "next/server";
import {
  walletDb_getPassBySerial,
  walletDb_registerDevice,
  walletDb_unregisterDevice,
} from "@/lib/wallet-db";

type Params = { deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string };

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * POST — device registers for push updates.
 * Body: { "pushToken": "..." }
 * Apple docs: respond 201 (new) or 200 (already registered).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;
  const token = extractToken(req);

  const pass = await walletDb_getPassBySerial(serialNumber);
  if (!pass || pass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pushToken: string;
  try {
    const body = await req.json();
    pushToken = body.pushToken;
    if (!pushToken) throw new Error("missing pushToken");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const isNew = await walletDb_registerDevice({
    id: `dev-${deviceLibraryIdentifier}-${pass.id}`,
    deviceLibraryIdentifier,
    pushToken,
    passId: pass.id,
    registeredAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true }, { status: isNew ? 201 : 200 });
}

/**
 * DELETE — device unregisters from push updates.
 * Apple docs: respond 200 (ok) or 404 (device/pass combo not found).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;
  const token = extractToken(req);

  const pass = await walletDb_getPassBySerial(serialNumber);
  if (!pass || pass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removed = await walletDb_unregisterDevice(deviceLibraryIdentifier, pass.id);
  return NextResponse.json({ ok: true }, { status: removed ? 200 : 404 });
}
