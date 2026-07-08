import { NextRequest, NextResponse } from "next/server";

/**
 * POST — Apple Wallet envoie ici les erreurs rencontrées par les appareils
 * (pass invalide, échec de mise à jour, etc.). On les trace pour le debug.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.logs)) {
      for (const line of body.logs) console.warn("[Wallet device log]", line);
    }
  } catch { /* corps non-JSON — ignorer */ }
  return NextResponse.json({ ok: true });
}
