import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// POST — assigne une carte de fidélité supplémentaire à un client déjà
// existant (dashboard). Contrairement à /api/register/customer (qui crée
// aussi la fiche `customers`), ce endpoint suppose que le client existe déjà
// et n'insère qu'une ligne customer_cards.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.id;

  try {
    const { customerId, cardId, customerCardId, stamps, points, joinDate } = await req.json();
    if (!customerId || !cardId || !customerCardId) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const sb = supabase();
    // Le client doit bien appartenir à ce commerçant — jamais d'assignation cross-tenant
    const { data: customer } = await sb.from("customers")
      .select("id").eq("id", customerId).eq("merchant_id", tenantId).maybeSingle();
    if (!customer) return NextResponse.json({ error: "Client introuvable." }, { status: 404 });

    const now = joinDate ?? new Date().toISOString();
    const { error } = await sb.from("customer_cards").insert({
      id: customerCardId,
      merchant_id: tenantId,
      customer_id: customerId,
      card_id: cardId,
      stamps: stamps ?? 0,
      points: points ?? 0,
      referral_count: 0,
      referral_points: 0,
      join_date: now,
      last_activity: now,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — retire une carte assignée à un client (dashboard).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.id;

  try {
    const { customerCardId } = await req.json();
    if (!customerCardId) return NextResponse.json({ error: "customerCardId manquant" }, { status: 400 });

    await supabase().from("customer_cards").delete()
      .eq("id", customerCardId).eq("merchant_id", tenantId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
