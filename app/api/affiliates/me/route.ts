import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveAffiliateSession, getAffiliateById } from "@/lib/affiliates";

async function requireAffiliate(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  const id = token ? await resolveAffiliateSession(token) : null;
  return id ? { id, token } : null;
}

// PATCH — infos de paiement OU objectif d'onboarding
export async function PATCH(req: NextRequest) {
  const auth = await requireAffiliate(req);
  if (!auth) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { bankMethod, iban, bic, paypalEmail, goal, onboarded } = await req.json().catch(() => ({}));

  // Onboarding : enregistrer l'objectif et/ou marquer comme terminé
  if (goal !== undefined || onboarded !== undefined) {
    await supabase().from("affiliates").update({
      ...(goal !== undefined ? { goal: String(goal).slice(0, 300) } : {}),
      ...(onboarded !== undefined ? { onboarded: !!onboarded } : {}),
    }).eq("id", auth.id);
    return NextResponse.json({ ok: true });
  }

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
