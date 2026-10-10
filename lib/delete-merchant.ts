import { supabase } from "./supabase";

/**
 * Suppression définitive d'un compte commerçant.
 *
 * Un commerçant essaime dans une vingtaine de tables. Supprimer la seule
 * ligne `merchants` laisserait derrière lui ses clients, ses cartes Wallet
 * et surtout son abonnement Stripe, qui continuerait de prélever une carte
 * pour un compte qui n'existe plus. L'ordre ci-dessous descend des feuilles
 * vers la racine pour ne jamais buter sur une clé étrangère.
 *
 * Ce qui est délibérément conservé :
 *  — `clients` : ce sont les porteurs de carte, qui peuvent être clients
 *    d'autres commerces. Seul leur rattachement à ce commerce disparaît.
 *  — `affiliate_transactions` : les commissions déjà versées à un apporteur
 *    d'affaires lui restent acquises. Supprimer le commerçant ne doit pas
 *    reprendre de l'argent à un tiers.
 *  — `employees` partagés : un employé rattaché à un autre commerce garde
 *    son compte ; seul le rattachement à celui-ci est retiré.
 */

export interface MerchantImpact {
  merchantId: string;
  storeName: string;
  email: string;
  plan: string;
  createdAt: string | null;
  /** Lignes qui seront supprimées, par table, uniquement celles > 0. */
  rows: Record<string, number>;
  totalRows: number;
  /** Abonnement Stripe en cours : sa présence rend la suppression sensible. */
  stripeSubscription: { id: string; status: string; amount: number } | null;
  /** Un compte qui a vécu demande une confirmation renforcée. */
  requiresTyping: boolean;
  isAdmin: boolean;
}

/** Tables rattachées directement au commerçant, des feuilles vers la racine. */
const MERCHANT_TABLES = [
  "redemptions",
  "redemption_tokens",
  "activities",
  "customer_cards",
  "referrals",
  "affiliate_referrals",
  "recurring_notifications",
  "notifications",
  "notification_usage",
  "products",
  "rewards",
  "support_messages",
  "employee_merchants",
  "customers",
  "loyalty_cards",
] as const;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe")(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

/** Ce que la suppression emporterait, sans rien supprimer. */
export async function merchantImpact(merchantId: string): Promise<MerchantImpact | null> {
  const sb = supabase();
  const { data: m } = await sb
    .from("merchants")
    .select("id, store_name, email, plan, created_at, is_admin, stripe_customer_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!m) return null;

  const rows: Record<string, number> = {};
  await Promise.all(
    MERCHANT_TABLES.map(async (table) => {
      const { count } = await sb
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchantId);
      if (count) rows[table] = count;
    }),
  );

  // Les passes Wallet pendent aux clients, pas au commerçant.
  const { data: customers } = await sb.from("customers").select("id").eq("merchant_id", merchantId);
  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length > 0) {
    const { count } = await sb
      .from("wallet_passes")
      .select("*", { count: "exact", head: true })
      .in("customer_id", customerIds);
    if (count) rows.wallet_passes = count;
  }

  let stripeSubscription: MerchantImpact["stripeSubscription"] = null;
  const stripe = getStripe();
  if (stripe && m.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: m.stripe_customer_id, limit: 1 });
      const s = subs.data[0];
      if (s) {
        stripeSubscription = {
          id: s.id,
          status: s.status,
          amount: (s.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
        };
      }
    } catch {
      /* Stripe indisponible : on n'empêche pas l'aperçu pour autant. */
    }
  }

  const totalRows = Object.values(rows).reduce((a, b) => a + b, 0);
  return {
    merchantId: m.id,
    storeName: m.store_name ?? "—",
    email: m.email,
    plan: m.plan ?? "starter",
    createdAt: m.created_at ?? null,
    rows,
    totalRows,
    stripeSubscription,
    // Un compte de test se supprime d'un clic. Dès qu'il y a de vrais
    // clients ou de l'argent en jeu, on exige le nom du commerce en toutes
    // lettres : à cette échelle, une suppression par erreur est irréparable.
    requiresTyping:
      Boolean(stripeSubscription) ||
      (rows.customers ?? 0) > 0 ||
      m.plan === "pro" ||
      m.plan === "business",
    isAdmin: Boolean(m.is_admin),
  };
}

export interface DeleteReport {
  deleted: Record<string, number>;
  stripe: "aucun" | "annulé" | "échec";
}

/** Supprime le commerçant et tout ce qui lui appartient. Irréversible. */
export async function deleteMerchant(merchantId: string): Promise<DeleteReport> {
  const sb = supabase();
  const deleted: Record<string, number> = {};

  const { data: m } = await sb
    .from("merchants")
    .select("id, email, is_admin, stripe_customer_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!m) throw new Error("Compte introuvable.");
  if (m.is_admin) throw new Error("Un compte administrateur ne peut pas être supprimé ici.");

  // 1. Stripe d'abord : si la base échoue ensuite, mieux vaut un compte
  //    orphelin qu'une carte qui continue d'être prélevée.
  let stripeResult: DeleteReport["stripe"] = "aucun";
  const stripe = getStripe();
  if (stripe && m.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: m.stripe_customer_id, limit: 10 });
      for (const s of subs.data) {
        if (s.status !== "canceled") await stripe.subscriptions.cancel(s.id);
      }
      await stripe.customers.del(m.stripe_customer_id);
      stripeResult = "annulé";
    } catch (e) {
      console.error("[delete-merchant] Stripe", e);
      stripeResult = "échec";
    }
  }

  // 2. Passes Wallet, rattachés aux clients du commerce.
  const { data: customers } = await sb.from("customers").select("id").eq("merchant_id", merchantId);
  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length > 0) {
    const { data: passes } = await sb.from("wallet_passes").select("id").in("customer_id", customerIds);
    const passIds = (passes ?? []).map((p) => p.id);
    if (passIds.length > 0) {
      const { count } = await sb
        .from("wallet_registrations").delete({ count: "exact" }).in("pass_id", passIds);
      if (count) deleted.wallet_registrations = count;
    }
    const { count } = await sb
      .from("wallet_passes").delete({ count: "exact" }).in("customer_id", customerIds);
    if (count) deleted.wallet_passes = count;
  }

  // 3. Employés : on ne retire que ceux qui ne travaillent que pour ce
  //    commerce. Les autres gardent leur compte et leurs autres commerces.
  const { data: links } = await sb
    .from("employee_merchants").select("employee_id").eq("merchant_id", merchantId);
  const employeeIds = [...new Set((links ?? []).map((l) => l.employee_id))];

  // 4. Tables rattachées au commerçant, des feuilles vers la racine.
  for (const table of MERCHANT_TABLES) {
    const { count, error } = await sb
      .from(table).delete({ count: "exact" }).eq("merchant_id", merchantId);
    if (error) throw new Error(`${table} : ${error.message}`);
    if (count) deleted[table] = count;
  }

  for (const employeeId of employeeIds) {
    const { count: remaining } = await sb
      .from("employee_merchants")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId);
    if (remaining && remaining > 0) continue; // rattaché ailleurs : on le garde
    const { data: emp } = await sb.from("employees").select("email").eq("id", employeeId).maybeSingle();
    if (emp?.email) {
      await sb.from("employee_sessions").delete().ilike("employee_email", emp.email);
    }
    const { count } = await sb.from("employees").delete({ count: "exact" }).eq("id", employeeId);
    if (count) deleted.employees = (deleted.employees ?? 0) + count;
  }
  await sb.from("employee_sessions").delete().eq("unlocked_merchant_id", merchantId);

  // 5. Jetons de connexion et de réinitialisation liés à l'adresse.
  if (m.email) {
    const { count } = await sb.from("auth_tokens").delete({ count: "exact" }).ilike("email", m.email);
    if (count) deleted.auth_tokens = count;
  }

  // 6. Le compte lui-même.
  const { error } = await sb.from("merchants").delete().eq("id", merchantId);
  if (error) throw new Error(`merchants : ${error.message}`);
  deleted.merchants = 1;

  return { deleted, stripe: stripeResult };
}
