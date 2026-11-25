import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

/**
 * Image de bannière personnelle de la carte de fidélité.
 *
 * Le commerçant qui ne se reconnaît dans aucune des quatre images proposées
 * envoie la sienne. Elle est stockée à côté des logos, une par commerce —
 * un commerce n'a qu'une carte (voir PLAN_LIMITS, `cards: 1` sur tous les
 * plans), donc une clé par commerçant suffit et rien ne peut rester orphelin.
 *
 * Le GET est public : Google Wallet va chercher l'image par URL, exactement
 * comme il va chercher le logo (/api/settings/logo?tenantId=...). Apple, lui,
 * la télécharge directement depuis le stockage au moment de fabriquer le
 * .pkpass.
 */

const BUCKET = "logos";
const cle = (tenantId: string) => `card-strips/${tenantId}.png`;

/** Dimensions du strip Apple en @3x — couvre aussi le heroImage Google. */
const LARGEUR = 1125;
const HAUTEUR = 369;

// GET ?tenantId=xxx — public. Sans tenantId : l'image du commerçant connecté.
export async function GET(req: NextRequest) {
  let tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    const session = await auth();
    tenantId = session?.user?.id ?? null;
  }
  if (!tenantId) return new NextResponse(null, { status: 404 });

  const { data } = await supabase().storage.from(BUCKET).download(cle(tenantId));
  if (!data) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(await data.arrayBuffer()), {
    headers: {
      "Content-Type": "image/png",
      // Le paramètre `v` de l'URL change à chaque envoi : on peut donc laisser
      // les caches garder l'image longtemps sans jamais en servir une périmée.
      "Cache-Control": "public, max-age=300",
    },
  });
}

// POST — envoi de l'image du commerçant connecté.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.id === "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const tenantId = session.user.id;

  try {
    const { data } = (await req.json()) as { data?: string };
    if (!data?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format d'image invalide." }, { status: 400 });
    }
    const base64 = data.replace(/^data:image\/\w+;base64,/, "");
    const brut = Buffer.from(base64, "base64");
    if (brut.length > 6 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 6 Mo)." }, { status: 413 });
    }

    // Recadrage au format de la bannière, côté serveur : le navigateur peut
    // envoyer n'importe quel rapport, c'est ici qu'on garantit que la carte
    // aura l'air correcte dans les deux Wallet.
    let image: Buffer;
    try {
      image = await sharp(brut)
        .resize(LARGEUR, HAUTEUR, { fit: "cover", position: "center" })
        .png()
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "Image illisible." }, { status: 400 });
    }

    const sb = supabase();
    const { error } = await sb.storage.from(BUCKET)
      .upload(cle(tenantId), image, { contentType: "image/png", upsert: true });
    if (error) {
      console.error("[card-strip] upload", error);
      return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
    }

    // La version sert deux choses : casser les caches (navigateur, Google), et
    // faire bouger l'empreinte de la carte pour que les cartes déjà installées
    // soient rafraîchies — voir passFingerprint, qui lit `stripPreset`.
    return NextResponse.json({ ok: true, stripPreset: `custom:${Date.now()}` });
  } catch (e) {
    console.error("[card-strip]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
