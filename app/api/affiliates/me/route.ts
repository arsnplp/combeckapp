import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveAffiliateSession, getAffiliateById } from "@/lib/affiliates";

async function requireAffiliate(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  const id = token ? await resolveAffiliateSession(token) : null;
  return id ? { id, token } : null;
}

// PATCH — mise à jour des infos de paiement (méthode + coordonnées)
export async function PATCH(req: NextRequest) {
  const auth = await requireAffiliate(req);
  if (!auth) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { bankMethod, iban, bic, paypalEmail } = await req.json().catch(() => ({}));
  if (!["virement", "wise", "paypal"].includes(bankMethod)) {
    return NextResponse.json({ error: "Méthode de paiement invalide." }, { status: 400 });
  }
  if (bankMethod === "paypal" && !paypalEmail?.trim()) {
    return NextResponse.json({ error: "Email PayPal requis." }, { status: 400 });
  }
  if (bankMethod !== "paypal" && !iban?.trim()) {
    return NextResponse.json({ error: "IBAN requis." }, { status: 400 });
  }

  await supabase().from("affiliates").update({
    bank_method: bankMethod,
    bank_details: bankMethod === "paypal"
      ? { paypalEmail: paypalEmail.trim() }
      : { iban: iban.trim(), bic: (bic ?? "").trim() },
  }).eq("id", auth.id);

  return NextResponse.json({ ok: true });
}

// DELETE — droit à l'oubli RGPD : supprime le compte, anonymise l'audit trail
export async function DELETE(req: NextRequest) {
  const auth = await requireAffiliate(req);
  if (!auth) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const affiliate = await getAffiliateById(auth.id);
  if (!affiliate) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const sb = supabase();
  // Les transactions sont conservées anonymisées (obligation comptable) :
  // la FK est ON DELETE CASCADE, on les détache donc AVANT la suppression
  await sb.from("affiliate_transactions").update({
    description: "AFFILIÉ SUPPRIMÉ (RGPD)",
  }).eq("affiliate_id", auth.id);
  // Wallet, referrals, sessions, jobs suivent en cascade
  await sb.from("affiliates").delete().eq("id", auth.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_affiliate", "", { maxAge: 0, path: "/" });
  return res;
}
