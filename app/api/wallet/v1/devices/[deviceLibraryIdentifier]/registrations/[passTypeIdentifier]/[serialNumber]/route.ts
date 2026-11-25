import { NextRequest, NextResponse } from "next/server";
import {
  walletDb_lookupPassBySerial,
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

  const recherche = await walletDb_lookupPassBySerial(serialNumber);
  // Base injoignable : on le dit, au lieu de faire croire à un problème
  // d'identification. L'appareil réessaiera, ce qui est le bon comportement.
  if (recherche.etat === "indisponible") {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (recherche.etat === "absent" || recherche.pass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pass = recherche.pass;

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
 * DELETE — l'appareil se désinscrit des mises à jour.
 *
 * Se désinscrire est idempotent : si nous n'avons plus trace de ce pass,
 * l'état demandé est déjà atteint et la bonne réponse est « c'est fait ».
 * On répondait 401, c'est-à-dire « réessaie en t'identifiant mieux » — pour
 * une carte supprimée, l'iPhone ne pouvait jamais y arriver et relançait
 * indéfiniment. 282 des 498 échecs relevés dans les journaux venaient de là,
 * pour 15 cartes effacées depuis des mois.
 *
 * On répond 200 et non 204 : Wallet journalise un 204 comme un échec.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;
  const token = extractToken(req);

  const recherche = await walletDb_lookupPassBySerial(serialNumber);
  if (recherche.etat === "indisponible") {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  // Pass inconnu : rien à désinscrire, donc rien à signaler. Surtout pas un
  // 401, qui relancerait la boucle.
  if (recherche.etat === "absent") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (recherche.pass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await walletDb_unregisterDevice(deviceLibraryIdentifier, recherche.pass.id);
  // 200 que la ligne ait existé ou non : dans les deux cas l'appareil n'est
  // plus inscrit, et c'est tout ce qu'il demandait.
  return NextResponse.json({ ok: true }, { status: 200 });
}
