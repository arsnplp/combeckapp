import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

const BUCKET = "logos";

// GET ?tenantId=xxx — public (utilisé par Google Wallet et l'espace client).
// Sans tenantId : logo du commerçant connecté.
export async function GET(req: NextRequest) {
  let tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    const session = await auth();
    tenantId = session?.user?.id ?? null;
  }
  if (!tenantId) return new NextResponse(null, { status: 404 });

  const { data } = await supabase().storage.from(BUCKET).download(`${tenantId}.png`);
  if (data) {
    return new NextResponse(Buffer.from(await data.arrayBuffer()), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  }

  // Pas de logo pour ce commerce précis : 404 franc — jamais de fallback
  // partagé entre commerces (ancien bug : un fichier global unique servait
  // de logo à tous les commerçants qui n'avaient pas encore uploadé le leur).
  return new NextResponse(null, { status: 404 });
}

// POST — upload du logo du commerçant connecté (stocké par tenant)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const tenantId = session.user.id;

  try {
    const { data } = await req.json() as { data: string };
    if (!data?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const base64 = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 2 Mo)." }, { status: 413 });
    }

    const sb = supabase();
    const { error } = await sb.storage.from(BUCKET)
      .upload(`${tenantId}.png`, buffer, { contentType: "image/png", upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // logo_url sert de cache-buster côté frontend
    const version = String(Date.now());
    await sb.from("merchants").update({ logo_url: version }).eq("id", tenantId);

    return NextResponse.json({ ok: true, url: version });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
