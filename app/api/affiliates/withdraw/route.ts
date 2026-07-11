import { NextRequest, NextResponse } from "next/server";
import { resolveAffiliateSession, requestWithdrawal, getAffiliateById } from "@/lib/affiliates";
import { notifyAdminEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  const affiliateId = token ? await resolveAffiliateSession(token) : null;
  if (!affiliateId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const result = await requestWithdrawal(affiliateId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const affiliate = await getAffiliateById(affiliateId);
  notifyAdminEmail("💸 Nouvelle demande de retrait affilié", {
    "Affilié": `${affiliate?.name ?? "?"} (${affiliate?.commerce ?? "?"})`,
    "Montant": `${result.amount.toFixed(2)} €`,
    "Méthode": affiliate?.bankMethod ?? "?",
    "À traiter sur": `${process.env.AUTH_URL ?? "https://app.getcomeback.fr"}/admin/affilies`,
  }).catch(console.error);

  return NextResponse.json({ ok: true, amount: result.amount });
}
