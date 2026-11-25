import { NextRequest, NextResponse } from "next/server";
import { walletDb_lookupPassBySerial } from "@/lib/wallet-db";
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

  const recherche = await walletDb_lookupPassBySerial(serialNumber);
  // Panne de base : 503, pour que l'appareil réessaie. Répondre 401 ici
  // reviendrait à dire à un client parfaitement en règle que sa carte n'est
  // plus reconnue, à cause d'une coupure de deux secondes.
  if (recherche.etat === "indisponible") {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  // Pass inconnu : 401, le seul code qu'Apple documente ici. On pourrait être
  // tenté de répondre 410 pour que l'iPhone efface une carte supprimée, mais
  // ce comportement n'est documenté nulle part chez Apple et une erreur de
  // lecture ferait disparaître la carte d'un vrai client. À ne tenter qu'après
  // vérification sur un appareil réel.
  if (recherche.etat === "absent" || recherche.pass.authenticationToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const walletPass = recherche.pass;

  // Honour If-Modified-Since — comparaison à la seconde près : l'en-tête HTTP
  // n'a pas les millisecondes, sans troncature on renvoyait toujours le pass
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (ifModifiedSince) {
    const sinceSec = Math.floor(new Date(ifModifiedSince).getTime() / 1000);
    const updatedSec = Math.floor(new Date(walletPass.updatedAt).getTime() / 1000);
    // Strictement antérieur seulement : l'en-tête n'a pas les millisecondes,
    // donc « même seconde » ne prouve pas que rien n'a changé. Avec `<=`, une
    // récompense validée dans la seconde qui suit un ajout de tampon était
    // ignorée par l'iPhone jusqu'à la mise à jour suivante.
    if (!isNaN(sinceSec) && updatedSec < sinceSec) {
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
