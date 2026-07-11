import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════
// SYSTÈME D'AFFILIATION — comptes séparés du SaaS (espace /affilies)
// ═══════════════════════════════════════════════════════════════════

export const COMMISSION_BASE_RATE = 0.20;      // 20 % du paiement
export const PLATINUM_BONUS = 0.05;            // +5 pts pour les Platinum
export const UNLOCK_DELAY_DAYS = 18;           // pending → disponible
export const DAILY_REFERRAL_LIMIT = 100;       // anti-triche

export type AffiliateTier = "bronze" | "silver" | "gold" | "platinum";

export const TIERS: Array<{ tier: AffiliateTier; minClients: number; maxClients?: number; rewards: string[] }> = [
  { tier: "bronze",   minClients: 0,  maxClients: 10, rewards: [] },
  { tier: "silver",   minClients: 11, maxClients: 25, rewards: ["SMS gratuit +500 (1 mois)", "Badge Silver sur profil", "Mention mensuelle (top 10)"] },
  { tier: "gold",     minClients: 26, maxClients: 50, rewards: ["Intégration caisse GRATUITE", "Badge doré + surbrillance", "Appel conseil 30 min (1x)", "Mention newsletter"] },
  { tier: "platinum", minClients: 51,                 rewards: ["Tous les rewards Gold", "Bonus +5 % commission", "Webinaire privé affiliés", "Mention spéciale newsletter", "Support prioritaire"] },
];

export function calculateTier(activeClients: number): AffiliateTier {
  if (activeClients >= 51) return "platinum";
  if (activeClients >= 26) return "gold";
  if (activeClients >= 11) return "silver";
  return "bronze";
}

export function commissionRateForTier(tier: AffiliateTier): number {
  return tier === "platinum" ? COMMISSION_BASE_RATE + PLATINUM_BONUS : COMMISSION_BASE_RATE;
}

// ── Types ─────────────────────────────────────────────────────────────

export interface Affiliate {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  commerce: string;
  phone: string;
  referralCode: string;
  tier: AffiliateTier;
  status: "active" | "suspended";
  suspensionReason?: string | null;
  bankMethod?: string | null;
  bankDetails?: { iban?: string; bic?: string; paypalEmail?: string } | null;
  goal?: string | null;
  onboarded?: boolean;
  createdAt: string;
}

export interface AffiliateWallet {
  affiliateId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  lastWithdrawalDate?: string | null;
}

interface AffiliateRow {
  id: string; email: string; password_hash: string; name: string; commerce: string;
  phone: string; referral_code: string; tier: string; status: string;
  suspension_reason: string | null; bank_method: string | null;
  bank_details: Affiliate["bankDetails"]; goal: string | null;
  onboarded: boolean; created_at: string;
}

const AFF_COLS = "id, email, password_hash, name, commerce, phone, referral_code, tier, status, suspension_reason, bank_method, bank_details, goal, onboarded, created_at";

function mapAffiliate(r: AffiliateRow): Affiliate {
  return {
    id: r.id, email: r.email, passwordHash: r.password_hash, name: r.name,
    commerce: r.commerce, phone: r.phone, referralCode: r.referral_code,
    tier: r.tier as AffiliateTier, status: r.status as Affiliate["status"],
    suspensionReason: r.suspension_reason, bankMethod: r.bank_method,
    bankDetails: r.bank_details, goal: r.goal, onboarded: r.onboarded,
    createdAt: r.created_at,
  };
}

// ── CRUD affiliés ─────────────────────────────────────────────────────

export async function getAffiliateByEmail(email: string): Promise<Affiliate | null> {
  const { data } = await supabase().from("affiliates").select(AFF_COLS)
    .ilike("email", email.toLowerCase().trim()).maybeSingle();
  return data ? mapAffiliate(data as AffiliateRow) : null;
}

export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const { data } = await supabase().from("affiliates").select(AFF_COLS).eq("id", id).maybeSingle();
  return data ? mapAffiliate(data as AffiliateRow) : null;
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const { data } = await supabase().from("affiliates").select(AFF_COLS)
    .eq("referral_code", code.trim()).maybeSingle();
  return data ? mapAffiliate(data as AffiliateRow) : null;
}

function genReferralCode(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 10) || "partenaire";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createAffiliate(input: {
  email: string; password: string; name: string; commerce: string; phone: string;
}): Promise<Affiliate> {
  const sb = supabase();
  const email = input.email.toLowerCase().trim();
  if (await getAffiliateByEmail(email)) throw new Error("EMAIL_EXISTS");

  const id = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(input.password, 12);

  // Code unique (retry en cas de collision)
  let referralCode = genReferralCode(input.commerce || input.name);
  for (let i = 0; i < 3; i++) {
    if (!(await getAffiliateByCode(referralCode))) break;
    referralCode = genReferralCode(input.commerce || input.name);
  }

  const { error } = await sb.from("affiliates").insert({
    id, email, password_hash: passwordHash,
    name: input.name.trim(), commerce: input.commerce.trim(), phone: input.phone.trim(),
    referral_code: referralCode, tier: "bronze", status: "active",
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message.includes("affiliates_email_key") ? "EMAIL_EXISTS" : error.message);

  await sb.from("affiliate_wallets").insert({ affiliate_id: id });

  return (await getAffiliateById(id))!;
}

export async function verifyAffiliatePassword(email: string, password: string): Promise<Affiliate | null> {
  const aff = await getAffiliateByEmail(email);
  if (!aff || !aff.passwordHash) return null;
  const ok = await bcrypt.compare(password, aff.passwordHash);
  if (!ok) return null;
  await supabase().from("affiliates").update({ last_login: new Date().toISOString() }).eq("id", aff.id);
  return aff;
}

// ── Sessions (cookie opaque "comeback_affiliate") ─────────────────────

export async function createAffiliateSession(affiliateId: string, ttlDays = 90): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await supabase().from("affiliate_sessions").insert({
    token, affiliate_id: affiliateId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ttlDays * 86400_000).toISOString(),
  });
  return token;
}

export async function resolveAffiliateSession(token: string): Promise<string | null> {
  const { data } = await supabase().from("affiliate_sessions")
    .select("affiliate_id, expires_at").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase().from("affiliate_sessions").delete().eq("token", token);
    return null;
  }
  return data.affiliate_id as string;
}

export async function deleteAffiliateSession(token: string): Promise<void> {
  await supabase().from("affiliate_sessions").delete().eq("token", token);
}

// ── Wallet ────────────────────────────────────────────────────────────

export async function getWallet(affiliateId: string): Promise<AffiliateWallet> {
  const sb = supabase();
  const { data } = await sb.from("affiliate_wallets").select("*").eq("affiliate_id", affiliateId).maybeSingle();
  if (!data) {
    await sb.from("affiliate_wallets").insert({ affiliate_id: affiliateId });
    return { affiliateId, availableBalance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 };
  }
  return {
    affiliateId,
    availableBalance: Number(data.available_balance),
    pendingBalance: Number(data.pending_balance),
    totalEarned: Number(data.total_earned),
    totalWithdrawn: Number(data.total_withdrawn),
    lastWithdrawalDate: data.last_withdrawal_date,
  };
}

// ── Commission (appelé par le webhook Stripe) ────────────────────────

export interface CommissionInput {
  merchantId: string;
  merchantName: string;
  plan: string;
  amountPaid: number;          // montant réellement encaissé (€)
  monthlyPrice: number;        // prix mensuel du plan (info)
  stripeSessionId: string;     // dédoublonnage
}

export async function creditCommission(affiliateCode: string, input: CommissionInput): Promise<
  { ok: true; commission: number; affiliate: Affiliate } | { ok: false; reason: string }
> {
  const sb = supabase();

  // Garde 1 : montant nul (essai, coupon 100 %)
  if (input.amountPaid <= 0) return { ok: false, reason: "montant nul" };

  // Garde 2 : doublon (retry webhook Stripe)
  const { data: dup } = await sb.from("affiliate_transactions")
    .select("id").eq("stripe_payment_intent_id", input.stripeSessionId).maybeSingle();
  if (dup) return { ok: false, reason: "déjà traité" };

  const affiliate = await getAffiliateByCode(affiliateCode);
  if (!affiliate) return { ok: false, reason: "affilié introuvable" };

  // Garde 3 : affilié suspendu
  if (affiliate.status === "suspended") return { ok: false, reason: `affilié suspendu (${affiliate.suspensionReason ?? "?"})` };

  // Garde 4 : rate limiting anti-triche
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { count: todayCount } = await sb.from("affiliate_transactions")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_id", affiliate.id).eq("type", "commission_added")
    .gte("created_at", startOfDay.toISOString());
  if ((todayCount ?? 0) >= DAILY_REFERRAL_LIMIT) {
    await sb.from("affiliates").update({
      status: "suspended", suspension_reason: "Activité suspecte : trop de commissions en 24h",
    }).eq("id", affiliate.id);
    return { ok: false, reason: "limite quotidienne dépassée — affilié suspendu" };
  }

  // Referral : créer ou mettre à jour
  const now = new Date().toISOString();
  const { data: existingRef } = await sb.from("affiliate_referrals")
    .select("id, first_payment_date").eq("affiliate_id", affiliate.id).eq("merchant_id", input.merchantId).maybeSingle();

  const isFirst = !existingRef?.first_payment_date;
  if (existingRef) {
    await sb.from("affiliate_referrals").update({
      status: "active", plan: input.plan, monthly_price: input.monthlyPrice,
      last_payment_date: now,
      ...(isFirst ? { first_payment_date: now } : {}),
    }).eq("id", existingRef.id);
  } else {
    await sb.from("affiliate_referrals").insert({
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      affiliate_id: affiliate.id, merchant_id: input.merchantId,
      merchant_name: input.merchantName, plan: input.plan,
      monthly_price: input.monthlyPrice, commission_rate: commissionRateForTier(affiliate.tier),
      status: "active", referral_date: now, first_payment_date: now, last_payment_date: now,
    });
  }

  // Commission = taux (selon tier) × montant réellement payé
  const rate = commissionRateForTier(affiliate.tier);
  const commission = Math.round(input.amountPaid * rate * 100) / 100;

  // Cagnotte : pending
  const wallet = await getWallet(affiliate.id);
  await sb.from("affiliate_wallets").update({
    pending_balance: wallet.pendingBalance + commission,
    total_earned: wallet.totalEarned + commission,
  }).eq("affiliate_id", affiliate.id);

  // Transaction (audit)
  const txId = `atx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await sb.from("affiliate_transactions").insert({
    id: txId, affiliate_id: affiliate.id, type: "commission_added", amount: commission,
    stripe_payment_intent_id: input.stripeSessionId, related_merchant_id: input.merchantId,
    description: `${isFirst ? "Premier paiement" : "Renouvellement"} — ${input.merchantName} (${input.plan}, ${input.amountPaid.toFixed(2)} €)`,
    created_at: now,
  });

  // Job de déblocage à J+18
  await sb.from("affiliate_jobs").insert({
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "unlock_commission", affiliate_id: affiliate.id,
    amount: commission, related_tx_id: txId,
    execute_at: new Date(Date.now() + UNLOCK_DELAY_DAYS * 86400_000).toISOString(),
    status: "pending", created_at: now,
  });

  // Recalcul du tier (peut monter)
  await recalcTier(affiliate.id);

  return { ok: true, commission, affiliate };
}

// ── Remboursement (charge.refunded) ──────────────────────────────────

export async function refundCommission(stripePaymentId: string): Promise<
  { ok: true; amount: number; affiliateId: string } | { ok: false }
> {
  const sb = supabase();
  const { data: tx } = await sb.from("affiliate_transactions")
    .select("id, affiliate_id, amount")
    .eq("stripe_payment_intent_id", stripePaymentId).eq("type", "commission_added").maybeSingle();
  if (!tx) return { ok: false };

  // Déjà remboursée ?
  const { data: already } = await sb.from("affiliate_transactions")
    .select("id").eq("type", "commission_refunded")
    .eq("stripe_payment_intent_id", stripePaymentId).maybeSingle();
  if (already) return { ok: false };

  const amount = Number(tx.amount);
  const wallet = await getWallet(tx.affiliate_id);

  // Annuler le job de déblocage s'il est encore pending → reprendre sur pending
  const { data: job } = await sb.from("affiliate_jobs")
    .select("id, status").eq("related_tx_id", tx.id).maybeSingle();
  if (job?.status === "pending") {
    await sb.from("affiliate_jobs").update({ status: "cancelled" }).eq("id", job.id);
    await sb.from("affiliate_wallets").update({
      pending_balance: Math.max(0, wallet.pendingBalance - amount),
      total_earned: Math.max(0, wallet.totalEarned - amount),
    }).eq("affiliate_id", tx.affiliate_id);
  } else {
    // Déjà débloquée → reprendre sur le disponible
    await sb.from("affiliate_wallets").update({
      available_balance: Math.max(0, wallet.availableBalance - amount),
      total_earned: Math.max(0, wallet.totalEarned - amount),
    }).eq("affiliate_id", tx.affiliate_id);
  }

  await sb.from("affiliate_transactions").insert({
    id: `atx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    affiliate_id: tx.affiliate_id, type: "commission_refunded", amount,
    stripe_payment_intent_id: stripePaymentId,
    description: "Commission annulée — paiement remboursé au client",
    created_at: new Date().toISOString(),
  });

  return { ok: true, amount, affiliateId: tx.affiliate_id };
}

// ── Churn (plan expiré / downgrade) ───────────────────────────────────

export async function markMerchantChurned(merchantId: string): Promise<string[]> {
  const sb = supabase();
  const { data: refs } = await sb.from("affiliate_referrals")
    .select("id, affiliate_id").eq("merchant_id", merchantId).eq("status", "active");
  if (!refs?.length) return [];
  const affected: string[] = [];
  for (const r of refs) {
    await sb.from("affiliate_referrals").update({ status: "churned" }).eq("id", r.id);
    await recalcTier(r.affiliate_id);
    affected.push(r.affiliate_id);
  }
  return affected;
}

// ── Tier ──────────────────────────────────────────────────────────────

export async function recalcTier(affiliateId: string): Promise<{ changed: boolean; tier: AffiliateTier; activeClients: number }> {
  const sb = supabase();
  const { count } = await sb.from("affiliate_referrals")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId).eq("status", "active");
  const activeClients = count ?? 0;
  const tier = calculateTier(activeClients);
  const { data: aff } = await sb.from("affiliates").select("tier").eq("id", affiliateId).maybeSingle();
  const changed = aff?.tier !== tier;
  if (changed) await sb.from("affiliates").update({ tier }).eq("id", affiliateId);
  return { changed, tier, activeClients };
}

// ── Déblocage 18 jours (cron horaire) ─────────────────────────────────

export async function processUnlockJobs(): Promise<Array<{ affiliateId: string; amount: number }>> {
  const sb = supabase();
  const { data: jobs } = await sb.from("affiliate_jobs")
    .select("id, affiliate_id, amount")
    .eq("type", "unlock_commission").eq("status", "pending")
    .lte("execute_at", new Date().toISOString());

  const unlocked: Array<{ affiliateId: string; amount: number }> = [];
  for (const job of jobs ?? []) {
    try {
      // Verrou optimiste : ne traiter que si encore pending
      const { data: locked } = await sb.from("affiliate_jobs")
        .update({ status: "completed", executed_at: new Date().toISOString() })
        .eq("id", job.id).eq("status", "pending").select("id");
      if (!locked?.length) continue;

      const amount = Number(job.amount);
      const wallet = await getWallet(job.affiliate_id);
      await sb.from("affiliate_wallets").update({
        pending_balance: Math.max(0, wallet.pendingBalance - amount),
        available_balance: wallet.availableBalance + amount,
      }).eq("affiliate_id", job.affiliate_id);

      await sb.from("affiliate_transactions").insert({
        id: `atx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        affiliate_id: job.affiliate_id, type: "pending_to_available", amount,
        description: `Commission débloquée (${UNLOCK_DELAY_DAYS} jours)`,
        created_at: new Date().toISOString(),
      });

      unlocked.push({ affiliateId: job.affiliate_id, amount });
    } catch (err) {
      console.error("[affiliate unlock]", err);
      await sb.from("affiliate_jobs").update({ status: "failed" }).eq("id", job.id);
    }
  }
  return unlocked;
}

// ── Retraits ──────────────────────────────────────────────────────────

export async function requestWithdrawal(affiliateId: string): Promise<
  { ok: true; id: string; amount: number } | { ok: false; error: string }
> {
  const sb = supabase();
  const affiliate = await getAffiliateById(affiliateId);
  if (!affiliate) return { ok: false, error: "Compte introuvable." };
  if (!affiliate.bankMethod || !affiliate.bankDetails) {
    return { ok: false, error: "Renseignez d'abord vos informations de paiement." };
  }

  const wallet = await getWallet(affiliateId);
  if (wallet.availableBalance < 20) {
    return { ok: false, error: "Minimum de retrait : 20 €." };
  }

  // Une seule demande en cours à la fois
  const { data: pending } = await sb.from("affiliate_withdrawals")
    .select("id").eq("affiliate_id", affiliateId).in("status", ["pending", "approved"]).maybeSingle();
  if (pending) return { ok: false, error: "Une demande de retrait est déjà en cours." };

  const amount = Math.round(wallet.availableBalance * 100) / 100;
  const id = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await sb.from("affiliate_withdrawals").insert({
    id, affiliate_id: affiliateId, amount, status: "pending",
    bank_method: affiliate.bankMethod, bank_details: affiliate.bankDetails,
    requested_at: now,
  });
  // Cagnotte disponible remise à zéro (réservée pour le retrait)
  await sb.from("affiliate_wallets").update({
    available_balance: 0, last_withdrawal_date: now,
  }).eq("affiliate_id", affiliateId);

  await sb.from("affiliate_transactions").insert({
    id: `atx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    affiliate_id: affiliateId, type: "withdrawal_requested", amount,
    related_withdrawal_id: id,
    description: `Demande de retrait (${affiliate.bankMethod})`,
    created_at: now,
  });

  return { ok: true, id, amount };
}
