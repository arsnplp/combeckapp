import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  resolveAffiliateSession, getAffiliateById, getWallet,
  TIERS, calculateTier, commissionRateForTier,
} from "@/lib/affiliates";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("comeback_affiliate")?.value;
  const affiliateId = token ? await resolveAffiliateSession(token) : null;
  if (!affiliateId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const affiliate = await getAffiliateById(affiliateId);
  if (!affiliate) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const sb = supabase();
  const [wallet, refsRes, txRes, wdRes] = await Promise.all([
    getWallet(affiliateId),
    sb.from("affiliate_referrals").select("*").eq("affiliate_id", affiliateId).order("referral_date", { ascending: false }),
    sb.from("affiliate_transactions").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }).limit(50),
    sb.from("affiliate_withdrawals").select("*").eq("affiliate_id", affiliateId).order("requested_at", { ascending: false }).limit(10),
  ]);

  const referrals = refsRes.data ?? [];
  const activeClients = referrals.filter((r) => r.status === "active").length;
  const churnedClients = referrals.filter((r) => r.status === "churned").length;
  const tier = calculateTier(activeClients);
  const tierConfig = TIERS.find((t) => t.tier === tier)!;
  const nextTier = TIERS[TIERS.findIndex((t) => t.tier === tier) + 1] ?? null;

  const appUrl = process.env.AUTH_URL ?? "https://app.getcomeback.fr";

  return NextResponse.json({
    profile: {
      name: affiliate.name,
      commerce: affiliate.commerce,
      email: affiliate.email,
      status: affiliate.status,
      suspensionReason: affiliate.suspensionReason,
      bankMethod: affiliate.bankMethod,
      bankDetails: affiliate.bankDetails,
      onboarded: affiliate.onboarded ?? false,
      goal: affiliate.goal ?? null,
    },
    refLink: `${appUrl}/ref/${affiliate.referralCode}`,
    referralCode: affiliate.referralCode,
    tier: {
      current: tier,
      rewards: tierConfig.rewards,
      commissionRate: commissionRateForTier(tier),
      activeClients,
      nextTier: nextTier ? { tier: nextTier.tier, clientsNeeded: nextTier.minClients - activeClients } : null,
    },
    wallet,
    stats: { activeClients, churnedClients, totalReferred: referrals.length },
    clients: referrals.map((r) => ({
      name: r.merchant_name, plan: r.plan, monthlyPrice: Number(r.monthly_price),
      status: r.status, since: r.referral_date, lastPayment: r.last_payment_date,
    })),
    transactions: (txRes.data ?? []).map((t) => ({
      type: t.type, amount: Number(t.amount), description: t.description, date: t.created_at,
    })),
    withdrawals: (wdRes.data ?? []).map((w) => ({
      id: w.id, amount: Number(w.amount), status: w.status,
      requestedAt: w.requested_at, paidAt: w.paid_at, adminNotes: w.admin_notes,
    })),
  });
}
