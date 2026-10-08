import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

/**
 * Commerçants à relancer, classés par ce qui les bloque.
 *
 * Les catégories sont ordonnées par urgence commerciale : d'abord l'argent
 * déjà encaissé qui risque de partir, ensuite les comptes qui n'ont jamais
 * démarré, enfin les occasions de conversion.
 *
 * Le signal d'activité est `customers.last_visit_at`, mis à jour à chaque
 * tampon. La table `activities` ne convient pas : elle n'est alimentée que
 * depuis septembre 2026, un compte plus ancien y paraîtrait inactif à tort.
 */

export type RelanceReason =
  | "payant_inactif"
  | "jamais_configure"
  | "jamais_lance"
  | "endormi"
  | "essai_bientot_fini"
  | "essai_expire";

export interface RelanceEntry {
  merchantId: string;
  storeName: string;
  email: string;
  phone: string | null;
  city: string | null;
  plan: string;
  createdAt: string;
  daysSinceSignup: number;
  cards: number;
  clients: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  trialDaysLeft: number | null;
  reason: RelanceReason;
}

/** Au-delà, un commerce qui a des clients est considéré comme endormi. */
const DORMANT_DAYS = 30;
/** Délai de grâce avant de relancer un compte qui vient de s'inscrire. */
const GRACE_DAYS_SETUP = 2;
const GRACE_DAYS_LAUNCH = 3;

const days = (from: string | null): number | null =>
  from ? Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000) : null;

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const sb = supabase();
  const [merchantsRes, cardsRes, customersRes] = await Promise.all([
    sb.from("merchants").select("id, store_name, email, phone, city, plan, created_at, trial_ends_at, plan_expires_at"),
    sb.from("loyalty_cards").select("merchant_id"),
    sb.from("customers").select("merchant_id, last_visit_at"),
  ]);

  const cardCount = new Map<string, number>();
  for (const c of cardsRes.data ?? []) {
    cardCount.set(c.merchant_id, (cardCount.get(c.merchant_id) ?? 0) + 1);
  }

  const clientCount = new Map<string, number>();
  const lastVisit = new Map<string, string>();
  for (const c of customersRes.data ?? []) {
    clientCount.set(c.merchant_id, (clientCount.get(c.merchant_id) ?? 0) + 1);
    const v = c.last_visit_at as string | null;
    if (v && (!lastVisit.has(c.merchant_id) || v > lastVisit.get(c.merchant_id)!)) {
      lastVisit.set(c.merchant_id, v);
    }
  }

  const entries: RelanceEntry[] = [];

  for (const m of merchantsRes.data ?? []) {
    const cards = cardCount.get(m.id) ?? 0;
    const clients = clientCount.get(m.id) ?? 0;
    const visit = lastVisit.get(m.id) ?? null;
    const sinceSignup = days(m.created_at) ?? 0;
    const sinceVisit = days(visit);
    const paying = m.plan === "pro" || m.plan === "business";

    const trialEnds = m.trial_ends_at as string | null;
    const trialLeft = trialEnds
      ? Math.ceil((new Date(trialEnds).getTime() - Date.now()) / 86_400_000)
      : null;
    const trialRunning = trialLeft !== null && trialLeft > 0;

    let reason: RelanceReason | null = null;

    if (paying && (cards === 0 || sinceVisit === null || sinceVisit >= DORMANT_DAYS)) {
      // Le plus urgent : il paie et n'en tire rien. C'est la résiliation qui vient.
      reason = "payant_inactif";
    } else if (cards === 0 && sinceSignup >= GRACE_DAYS_SETUP) {
      reason = "jamais_configure";
    } else if (clients === 0 && sinceSignup >= GRACE_DAYS_LAUNCH) {
      reason = "jamais_lance";
    } else if (
      // Des clients inscrits mais plus personne qui passe. Le cas « aucune
      // visite du tout » compte aussi : des cartes distribuées que personne
      // n'a jamais fait tamponner, c'est un programme qui n'a pas pris.
      (sinceVisit !== null && sinceVisit >= DORMANT_DAYS) ||
      (sinceVisit === null && sinceSignup >= 7)
    ) {
      reason = "endormi";
    } else if (trialRunning && trialLeft <= 7) {
      reason = "essai_bientot_fini";
    } else if (m.plan === "free" && trialEnds && !trialRunning) {
      reason = "essai_expire";
    }

    if (!reason) continue;

    entries.push({
      merchantId: m.id,
      storeName: m.store_name ?? "—",
      email: m.email,
      phone: m.phone || null,
      city: m.city || null,
      plan: m.plan ?? "starter",
      createdAt: m.created_at,
      daysSinceSignup: sinceSignup,
      cards,
      clients,
      lastVisitAt: visit,
      daysSinceLastVisit: sinceVisit,
      trialDaysLeft: trialRunning ? trialLeft : null,
      reason,
    });
  }

  // Les plus anciens d'abord à l'intérieur d'une même catégorie : ce sont
  // ceux qui dérivent depuis le plus longtemps.
  const order: RelanceReason[] = [
    "payant_inactif", "essai_bientot_fini", "jamais_configure",
    "jamais_lance", "endormi", "essai_expire",
  ];
  entries.sort((a, b) =>
    order.indexOf(a.reason) - order.indexOf(b.reason) || b.daysSinceSignup - a.daysSinceSignup);

  return NextResponse.json({ entries, total: entries.length });
}
