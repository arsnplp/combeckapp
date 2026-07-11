import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// GET — liste complète des affiliés + analytics + retraits en attente
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const sb = supabase();
  const [affRes, walletRes, refRes, wdRes, txRes] = await Promise.all([
    sb.from("affiliates").select("id, email, name, commerce, phone, referral_code, tier, status, suspension_reason, bank_method, bank_details, goal, created_at, last_login").order("created_at", { ascending: false }),
    sb.from("affiliate_wallets").select("*"),
    sb.from("affiliate_referrals").select("affiliate_id, status"),
    sb.from("affiliate_withdrawals").select("*").order("requested_at", { ascending: false }),
    sb.from("affiliate_transactions").select("type, amount, created_at"),
  ]);

  const wallets = new Map((walletRes.data ?? []).map((w) => [w.affiliate_id, w]));
  const refCounts = new Map<string, { active: number; churned: number }>();
  for (const r of refRes.data ?? []) {
    const c = refCounts.get(r.affiliate_id) ?? { active: 0, churned: 0 };
    if (r.status === "active") c.active++; else c.churned++;
    refCounts.set(r.affiliate_id, c);
  }

  const affiliates = (affRes.data ?? []).map((a) => {
    const w = wallets.get(a.id);
    const rc = refCounts.get(a.id) ?? { active: 0, churned: 0 };
    return {
      id: a.id, email: a.email, name: a.name, commerce: a.commerce, phone: a.phone,
      referralCode: a.referral_code, tier: a.tier, status: a.status,
      suspensionReason: a.suspension_reason,
      bankMethod: a.bank_method, bankDetails: a.bank_details,
      goal: a.goal, createdAt: a.created_at, lastLogin: a.last_login,
      activeClients: rc.active, churnedClients: rc.churned,
      available: Number(w?.available_balance ?? 0),
      pending: Number(w?.pending_balance ?? 0),
      totalEarned: Number(w?.total_earned ?? 0),
      totalWithdrawn: Number(w?.total_withdrawn ?? 0),
    };
  });

  // Analytics globales
  const txs = txRes.data ?? [];
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const commissionsThisMonth = txs
    .filter((t) => t.type === "commission_added" && new Date(t.created_at) >= monthStart)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalCommissions = txs.filter((t) => t.type === "commission_added").reduce((s, t) => s + Number(t.amount), 0);
  const totalPaidOut = txs.filter((t) => t.type === "withdrawn").reduce((s, t) => s + Number(t.amount), 0);

  return NextResponse.json({
    affiliates,
    withdrawals: (wdRes.data ?? []).map((w) => ({
      id: w.id, affiliateId: w.affiliate_id, amount: Number(w.amount), status: w.status,
      bankMethod: w.bank_method, bankDetails: w.bank_details,
      requestedAt: w.requested_at, approvedAt: w.approved_at, paidAt: w.paid_at, adminNotes: w.admin_notes,
    })),
    analytics: {
      totalAffiliates: affiliates.length,
      activeAffiliates: affiliates.filter((a) => a.status === "active" && a.activeClients > 0).length,
      commissionsThisMonth: Math.round(commissionsThisMonth * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
      pendingWithdrawals: (wdRes.data ?? []).filter((w) => w.status === "pending").length,
    },
  });
}

// POST — actions : suspend / reactivate / approve / reject / mark-paid
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { action, affiliateId, withdrawalId, reason, notes } = await req.json().catch(() => ({}));
  const sb = supabase();

  // ── Suspension / réactivation d'un affilié ──
  if (action === "suspend" && affiliateId) {
    await sb.from("affiliates").update({
      status: "suspended", suspension_reason: reason ?? "Suspendu par l'administrateur",
    }).eq("id", affiliateId);
    return NextResponse.json({ ok: true });
  }
  if (action === "reactivate" && affiliateId) {
    await sb.from("affiliates").update({ status: "active", suspension_reason: null }).eq("id", affiliateId);
    return NextResponse.json({ ok: true });
  }

  // ── Retraits ──
  if (["approve", "reject", "mark-paid"].includes(action) && withdrawalId) {
    const { data: wd } = await sb.from("affiliate_withdrawals").select("*").eq("id", withdrawalId).maybeSingle();
    if (!wd) return NextResponse.json({ error: "Retrait introuvable." }, { status: 404 });
    const { data: aff } = await sb.from("affiliates").select("email").eq("id", wd.affiliate_id).maybeSingle();
    const amount = Number(wd.amount);
    const { sendAffiliateWithdrawalEmail } = await import("@/lib/mailer");

    if (action === "approve") {
      if (wd.status !== "pending") return NextResponse.json({ error: "Déjà traité." }, { status: 409 });
      await sb.from("affiliate_withdrawals").update({
        status: "approved", approved_at: new Date().toISOString(), admin_notes: notes ?? null,
      }).eq("id", withdrawalId);
      if (aff) sendAffiliateWithdrawalEmail(aff.email, "approved", amount).catch(console.error);
    }

    if (action === "mark-paid") {
      if (!["pending", "approved"].includes(wd.status)) return NextResponse.json({ error: "Déjà traité." }, { status: 409 });
      await sb.from("affiliate_withdrawals").update({
        status: "paid", paid_at: new Date().toISOString(),
        ...(wd.status === "pending" ? { approved_at: new Date().toISOString() } : {}),
      }).eq("id", withdrawalId);
      // total_withdrawn += montant + transaction
      const { data: w } = await sb.from("affiliate_wallets").select("total_withdrawn").eq("affiliate_id", wd.affiliate_id).maybeSingle();
      await sb.from("affiliate_wallets").update({
        total_withdrawn: Number(w?.total_withdrawn ?? 0) + amount,
      }).eq("affiliate_id", wd.affiliate_id);
      await sb.from("affiliate_transactions").insert({
        id: `atx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        affiliate_id: wd.affiliate_id, type: "withdrawn", amount,
        related_withdrawal_id: withdrawalId,
        description: `Retrait payé (${wd.bank_method})`,
        created_at: new Date().toISOString(),
      });
      if (aff) sendAffiliateWithdrawalEmail(aff.email, "paid", amount).catch(console.error);
    }

    if (action === "reject") {
      if (!["pending", "approved"].includes(wd.status)) return NextResponse.json({ error: "Déjà traité." }, { status: 409 });
      await sb.from("affiliate_withdrawals").update({
        status: "rejected", admin_notes: notes ?? null,
      }).eq("id", withdrawalId);
      // Recréditer la cagnotte disponible
      const { data: w } = await sb.from("affiliate_wallets").select("available_balance").eq("affiliate_id", wd.affiliate_id).maybeSingle();
      await sb.from("affiliate_wallets").update({
        available_balance: Number(w?.available_balance ?? 0) + amount,
      }).eq("affiliate_id", wd.affiliate_id);
      if (aff) sendAffiliateWithdrawalEmail(aff.email, "rejected", amount, notes).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
