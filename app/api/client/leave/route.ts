import { NextRequest, NextResponse } from "next/server";
import { resolveClientSession } from "@/lib/client-sessions";
import { db_deleteCustomer } from "@/lib/server-db";
import { supabase } from "@/lib/supabase";

/**
 * POST { tenantId } — quitter un établissement : supprime la fiche client,
 * ses cartes, son historique et ses pass wallet CHEZ CE COMMERÇANT uniquement.
 * Le compte ComeBack global (et les cartes des autres commerces) est conservé.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { tenantId } = await req.json();
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId manquant." }, { status: 400 });
  }

  // Fiches de CE client chez CE commerçant uniquement
  const { data: targets } = await supabase().from("customers")
    .select("id").eq("merchant_id", tenantId).ilike("email", email.toLowerCase().trim());

  if (!targets?.length) {
    return NextResponse.json({ error: "Aucun compte chez ce commerce." }, { status: 404 });
  }

  for (const c of targets) {
    // Supprime fiche + cartes + historique + pass Apple + expire la carte Google
    await db_deleteCustomer(tenantId, c.id);
  }

  return NextResponse.json({ ok: true });
}
