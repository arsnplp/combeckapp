import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { deleteClientAccount } from "@/lib/client-accounts";
import { resolveClientSession, deleteAllClientSessions } from "@/lib/client-sessions";
import { walletDb_deletePassesForCards } from "@/lib/wallet-db";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;

  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.confirm) {
    return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const sb = supabase();

  // 1. Purger les pass wallet AVANT (sinon FK → NULL et les appareils
  // continuent de recevoir les notifications)
  const { data: targets } = await sb.from("customers").select("id").ilike("email", normalizedEmail);
  if (targets?.length) {
    const { data: cards } = await sb.from("customer_cards")
      .select("id").in("customer_id", targets.map((c) => c.id));
    await walletDb_deletePassesForCards((cards ?? []).map((c) => c.id));
  }

  // 2. Supprimer les fiches client chez tous les commerces
  // (customer_cards, redemptions et parrainages suivent via FK cascade / set null)
  await sb.from("customers").delete().ilike("email", normalizedEmail);

  // 2. Supprimer le compte client global
  await deleteClientAccount(normalizedEmail);

  // 3. Supprimer les tokens de réinitialisation
  await sb.from("auth_tokens").delete().eq("type", "client_reset").ilike("email", normalizedEmail);

  // 4. Supprimer sessions et cookie
  await deleteAllClientSessions(normalizedEmail);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("comeback_client", "", { maxAge: 0, path: "/" });

  return response;
}
