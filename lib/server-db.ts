import { supabase } from "./supabase";
import { walletDb_deletePassesForCards } from "./wallet-db";
import { normalizeStampCount } from "./loyalty-limits";

// ── Types (identiques à l'ancienne version JSON) ──────────────────────────────

export interface DbRedemption {
  id: string;
  customerId: string;
  customerCardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  costType: "stamps" | "points";
  redeemedAt: string;
}

export interface DbCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  totalVisits: number;
  lastVisitAt: string | null;
  totalSpent?: number; // optionnel en entrée (db_addCustomer) — la colonne a un DEFAULT 0
}

export interface DbCustomerCard {
  id: string;
  customerId: string;
  cardId: string;
  stamps: number;
  points: number;
  referralCount: number;
  pendingReferrals?: number; // filleuls inscrits non encore crédités
  joinDate: string;
  lastActivity: string;
}

interface DbShape {
  customers: DbCustomer[];
  customerCards: DbCustomerCard[];
  redemptions: DbRedemption[];
}

// ── Mappers lignes SQL → formes legacy ────────────────────────────────────────

interface CustomerRow {
  id: string; name: string; email: string; phone: string;
  join_date: string; total_visits: number; last_visit_at: string | null;
  total_spent: number | null;
}
interface CardRow {
  id: string; customer_id: string; card_id: string; stamps: number; points: number;
  referral_count: number; join_date: string; last_activity: string;
}
interface RedemptionRow {
  id: string; customer_id: string | null; customer_card_id: string | null;
  reward_name: string; reward_emoji: string; cost: number; cost_type: string; redeemed_at: string;
}

const mapCustomer = (r: CustomerRow): DbCustomer => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone,
  joinDate: r.join_date, totalVisits: r.total_visits, lastVisitAt: r.last_visit_at,
  totalSpent: Number(r.total_spent ?? 0),
});
const mapCard = (r: CardRow): DbCustomerCard => ({
  id: r.id, customerId: r.customer_id, cardId: r.card_id, stamps: r.stamps, points: r.points,
  referralCount: r.referral_count,
  joinDate: r.join_date, lastActivity: r.last_activity,
});
const mapRedemption = (r: RedemptionRow): DbRedemption => ({
  id: r.id, customerId: r.customer_id ?? "", customerCardId: r.customer_card_id ?? "",
  rewardName: r.reward_name, rewardEmoji: r.reward_emoji, cost: r.cost,
  costType: r.cost_type as DbRedemption["costType"], redeemedAt: r.redeemed_at,
});

// ── Lecture globale d'un tenant ───────────────────────────────────────────────

export async function db_getAll(tenantId: string): Promise<DbShape> {
  const sb = supabase();
  const [customers, cards, redemptions, pendingRefs] = await Promise.all([
    sb.from("customers").select("*").eq("merchant_id", tenantId).order("join_date"),
    sb.from("customer_cards").select("*").eq("merchant_id", tenantId).order("join_date"),
    sb.from("redemptions").select("*").eq("merchant_id", tenantId).order("redeemed_at"),
    sb.from("referrals").select("referrer_card_id").eq("merchant_id", tenantId).eq("credited", false),
  ]);
  const pendingByCard = new Map<string, number>();
  for (const p of pendingRefs.data ?? []) {
    const key = p.referrer_card_id as string;
    pendingByCard.set(key, (pendingByCard.get(key) ?? 0) + 1);
  }
  return {
    customers: ((customers.data ?? []) as CustomerRow[]).map(mapCustomer),
    customerCards: ((cards.data ?? []) as CardRow[]).map((r) => ({
      ...mapCard(r),
      pendingReferrals: pendingByCard.get(r.id) ?? 0,
    })),
    redemptions: ((redemptions.data ?? []) as RedemptionRow[]).map(mapRedemption),
  };
}

// Clients "gelés" au-delà de la limite du plan : calculé à la volée à chaque
// appel (jamais stocké) — même principe que le gel des cartes de fidélité.
// Les `maxClients` premiers clients par ancienneté (join_date) restent actifs ;
// les autres sont gelés (données conservées, plus aucun cumul de tampons/points
// tant que le commerçant ne repasse pas à un plan supérieur).
export async function db_computeFrozenCustomerIds(tenantId: string, maxClients: number): Promise<Set<string>> {
  if (maxClients === Infinity) return new Set();
  const { data } = await supabase().from("customers")
    .select("id, join_date").eq("merchant_id", tenantId).order("join_date");
  const all = data ?? [];
  if (all.length <= maxClients) return new Set();
  return new Set(all.slice(maxClients).map((c) => c.id as string));
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

async function maybeRecordVisit(customerId: string): Promise<void> {
  const sb = supabase();
  const { data: c } = await sb.from("customers")
    .select("total_visits, last_visit_at").eq("id", customerId).maybeSingle();
  if (!c) return;
  const last = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
  if (Date.now() - last > TWO_HOURS) {
    await sb.from("customers").update({
      total_visits: (c.total_visits ?? 0) + 1,
      last_visit_at: new Date().toISOString(),
    }).eq("id", customerId);
  }
}

export async function db_addCustomer(
  tenantId: string,
  customer: DbCustomer,
  customerCard: DbCustomerCard,
): Promise<void> {
  const sb = supabase();
  const { error: e1 } = await sb.from("customers").insert({
    id: customer.id,
    merchant_id: tenantId,
    name: customer.name,
    email: (customer.email ?? "").toLowerCase(),
    phone: customer.phone ?? "",
    total_visits: 0,
    last_visit_at: null,
    join_date: customer.joinDate,
  });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.from("customer_cards").insert({
    id: customerCard.id,
    merchant_id: tenantId,
    customer_id: customerCard.customerId,
    card_id: customerCard.cardId,
    stamps: customerCard.stamps ?? 0,
    points: customerCard.points ?? 0,
    referral_count: customerCard.referralCount ?? 0,
    referral_points: 0, // colonne conservée pour compat DB — plus utilisée comme monnaie
    join_date: customerCard.joinDate,
    last_activity: customerCard.lastActivity,
  });
  if (e2) throw new Error(e2.message);
}

// Rattache une nouvelle carte fidélité à un client déjà connu de ce commerce
// (identité `customers` existante — ex: son ancienne carte a été supprimée
// par le commerçant puis remplacée par une nouvelle) — pas de nouvelle fiche
// `customers` dupliquée, seulement le lien `customer_cards`.
export async function db_addCustomerCard(tenantId: string, customerCard: DbCustomerCard): Promise<void> {
  const { error } = await supabase().from("customer_cards").insert({
    id: customerCard.id,
    merchant_id: tenantId,
    customer_id: customerCard.customerId,
    card_id: customerCard.cardId,
    stamps: customerCard.stamps ?? 0,
    points: customerCard.points ?? 0,
    referral_count: customerCard.referralCount ?? 0,
    referral_points: 0,
    join_date: customerCard.joinDate,
    last_activity: customerCard.lastActivity,
  });
  if (error) throw new Error(error.message);
}

async function getCardInTenant(tenantId: string, customerCardId: string): Promise<CardRow | null> {
  const { data } = await supabase().from("customer_cards").select("*")
    .eq("id", customerCardId).eq("merchant_id", tenantId).maybeSingle();
  return (data as CardRow) ?? null;
}

/**
 * Met à jour le solde d'une carte sans jamais perdre une écriture concurrente.
 *
 * Avant, chaque fonction lisait la carte, calculait le nouveau solde en
 * mémoire puis l'écrivait. Deux opérations simultanées (un employé qui
 * crédite pendant que le client joue, une récompense validée pendant un
 * ajout…) partaient de la même lecture : la seconde écrasait la première.
 * Exemple réel possible : carte à 8, récompense de 5 et partie à 2 en même
 * temps, les deux passent la garde « solde ≥ coût » et le solde final vaut
 * 6 au lieu de 1.
 *
 * Ici l'écriture n'est acceptée que si tampons ET points sont encore ceux
 * qu'on a lus (compare-and-swap, réévalué par Postgres au moment d'écrire).
 * Sinon on relit et on recalcule, quelques fois.
 *
 * `compute` reçoit la carte fraîche et renvoie le patch à appliquer, ou une
 * raison de refuser (solde insuffisant…).
 */
async function updateCardBalance(
  tenantId: string,
  customerCardId: string,
  compute: (cc: CardRow) => { patch: Record<string, unknown> } | { refuse: string },
): Promise<{ ok: true; before: CardRow; after: CardRow } | { ok: false; reason: string; card: CardRow | null }> {
  for (let tentative = 0; tentative < 6; tentative++) {
    const cc = await getCardInTenant(tenantId, customerCardId);
    if (!cc) return { ok: false, reason: "Carte introuvable", card: null };
    const decision = compute(cc);
    if ("refuse" in decision) return { ok: false, reason: decision.refuse, card: cc };
    const { data } = await supabase().from("customer_cards")
      .update(decision.patch)
      .eq("id", customerCardId)
      .eq("merchant_id", tenantId)
      .eq("stamps", cc.stamps ?? 0)
      .eq("points", cc.points ?? 0)
      .select("*").maybeSingle();
    if (data) return { ok: true, before: cc, after: data as CardRow };
    // Le solde a bougé entre notre lecture et notre écriture : on recommence.
  }
  return { ok: false, reason: "La carte est très sollicitée, réessayez.", card: null };
}

/** ID du client propriétaire d'une carte — utilisé pour vérifier le gel (limite clients du plan). */
export async function db_getCustomerIdForCard(tenantId: string, customerCardId: string): Promise<string | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  return cc?.customer_id ?? null;
}

export interface AddStampResult {
  card: DbCustomerCard;
  /** Tampons réellement crédités — peut être < count si le plafond est atteint. */
  added: number;
  /** Tampons demandés (après normalisation), pour message d'UI honnête. */
  requested: number;
  stampsRequired: number;
  /** true si la carte était déjà pleine avant l'appel (0 tampon crédité). */
  alreadyFull: boolean;
}

export async function db_addStamp(
  tenantId: string, customerCardId: string, count: number = 1,
): Promise<AddStampResult | null> {
  // Normalise l'entrée : NaN/0/négatif/décimal/absurde ne doivent jamais
  // atteindre la base (un appelant ancien n'envoie rien -> 1 par défaut).
  const requested = normalizeStampCount(count);
  const cardRef = await getCardInTenant(tenantId, customerCardId);
  if (!cardRef) return null;
  // Plafonne au nombre de tampons requis par la carte — sans ça, un double
  // scan/double-tap accidentel (ou une saisie trop grande) peut pousser le
  // solde au-delà du seuil et laisser le client réclamer plus de récompenses
  // que ce qu'il a gagné.
  const { data: lc } = await supabase().from("loyalty_cards")
    .select("stamps_required").eq("id", cardRef.card_id).maybeSingle();
  const stampsRequired = lc?.stamps_required ?? Infinity;
  const now = new Date().toISOString();
  const res = await updateCardBalance(tenantId, customerCardId, (cc) => {
    const before = cc.stamps ?? 0;
    // Jamais en dessous du solde actuel : si le commerçant a baissé le nombre
    // de tampons de sa carte (10 → 8), un client à 9 restait à 9, mais le
    // tampon suivant le ramenait à 8. Ajouter un tampon lui en retirait un.
    const after = Math.max(before, Math.min(before + requested, stampsRequired));
    return { patch: { stamps: after, last_activity: now } };
  });
  if (!res.ok) return null;
  const added = (res.after.stamps ?? 0) - (res.before.stamps ?? 0);
  // Carte déjà pleine : aucun tampon crédité, donc aucune visite comptée
  // (sinon un scan sans effet gonflerait les stats de passage).
  if (added > 0) await maybeRecordVisit(res.before.customer_id);
  return {
    card: mapCard(res.after),
    added,
    requested,
    stampsRequired: Number.isFinite(stampsRequired) ? stampsRequired : (res.after.stamps ?? 0),
    alreadyFull: added === 0,
  };
}

export async function db_deleteCustomer(tenantId: string, customerId: string): Promise<void> {
  const sb = supabase();
  // Pass wallet + enregistrements d'appareils d'abord (sinon FK → NULL et les
  // appareils continuent de recevoir les notifications)
  const { data: cards } = await sb.from("customer_cards")
    .select("id").eq("customer_id", customerId).eq("merchant_id", tenantId);
  await walletDb_deletePassesForCards((cards ?? []).map((c) => c.id));
  // customer_cards + redemptions liés suivent via FK cascade / set null
  await sb.from("customers").delete()
    .eq("id", customerId).eq("merchant_id", tenantId);
}

/**
 * Vérifie SANS écrire si un parrainage serait valide (parrain existant dans
 * ce commerce, pas d'auto-parrainage, email présent) — utilisé pour décider
 * du bonus filleul AVANT de créer le client (le doublon n'a pas besoin d'être
 * vérifié ici : un customerId tout juste généré n'a jamais pu être parrainé).
 */
export async function db_wouldReferralSucceed(
  tenantId: string,
  referrerCardId: string,
  referredEmail: string,
): Promise<boolean> {
  const email = (referredEmail ?? "").toLowerCase().trim();
  if (!email) return false;
  const sb = supabase();
  const { data: refCard } = await sb.from("customer_cards")
    .select("id, customer_id").eq("id", referrerCardId).eq("merchant_id", tenantId).maybeSingle();
  if (!refCard) return false;
  const { data: refCustomer } = await sb.from("customers")
    .select("email").eq("id", refCard.customer_id).maybeSingle();
  if (refCustomer?.email && refCustomer.email.toLowerCase() === email) return false;
  return true;
}

/**
 * Enregistre un parrainage EN ATTENTE — le parrain ne sera crédité qu'à la
 * première visite réelle du filleul (anti-farm : les fausses inscriptions
 * sans visite ne rapportent rien).
 * Conditions : filleul avec email, pas d'auto-parrainage, parrain du même commerce.
 */
export async function db_recordPendingReferral(
  tenantId: string,
  referrerCardId: string,
  referredCustomerId: string,
  referredEmail: string,
): Promise<boolean> {
  const email = (referredEmail ?? "").toLowerCase().trim();
  if (!email) return false; // pas de compte email → pas de parrainage

  const sb = supabase();

  // Le parrain doit exister dans CE commerce
  const { data: refCard } = await sb.from("customer_cards")
    .select("id, customer_id").eq("id", referrerCardId).eq("merchant_id", tenantId).maybeSingle();
  if (!refCard) return false;

  // Anti auto-parrainage : le parrain ne peut pas être le filleul
  const { data: refCustomer } = await sb.from("customers")
    .select("email").eq("id", refCard.customer_id).maybeSingle();
  if (refCustomer?.email && refCustomer.email.toLowerCase() === email) return false;

  // Un seul parrainage par filleul
  const { data: existing } = await sb.from("referrals")
    .select("id").eq("referred_customer_id", referredCustomerId).maybeSingle();
  if (existing) return false;

  const { error } = await sb.from("referrals").insert({
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    merchant_id: tenantId,
    referrer_card_id: referrerCardId,
    referred_customer_id: referredCustomerId,
    referred_email: email,
    credited: false,
  });
  return !error;
}

/**
 * Crédite les parrainages en attente pour un filleul qui vient de faire sa
 * première visite réelle. Retourne les cartes des parrains crédités
 * (pour synchroniser leurs cartes wallet).
 */
export async function db_creditPendingReferrals(tenantId: string, customerId: string): Promise<string[]> {
  const sb = supabase();
  const { data: pending } = await sb.from("referrals")
    .select("id, referrer_card_id")
    .eq("merchant_id", tenantId)
    .eq("referred_customer_id", customerId)
    .eq("credited", false);
  if (!pending?.length) return [];

  const credited: string[] = [];
  for (const r of pending) {
    const { data: updated } = await sb.from("referrals")
      .update({ credited: true }).eq("id", r.id).eq("credited", false).select("id");
    if (!updated?.length) continue; // déjà crédité par une requête concurrente
    const card = await db_addReferral(tenantId, r.referrer_card_id);
    if (card) credited.push(r.referrer_card_id);
  }
  return credited;
}

// Crédite le PARRAIN à la première visite réelle de son filleul (anti-farm).
// Le bonus configuré sur la carte est ajouté directement au solde normal
// (tampons ou points selon le mode) — plus de monnaie séparée "points de
// parrainage". referral_count reste un simple compteur d'affichage.
export async function db_addReferral(tenantId: string, customerCardId: string): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const { data: lc } = await supabase().from("loyalty_cards")
    .select("loyalty_mode, referral_bonus, stamps_required")
    .eq("id", cc.card_id).maybeSingle();
  const mode = (lc?.loyalty_mode ?? "stamps") as "stamps" | "points";
  const bonus = lc?.referral_bonus ?? 1;
  const stampsRequired = lc?.stamps_required ?? 8;

  const res = await updateCardBalance(tenantId, customerCardId, (fresh) => {
    const patch: Record<string, unknown> = { referral_count: (fresh.referral_count ?? 0) + 1 };
    // Jamais en dessous du solde actuel (carte dont le plafond a été baissé).
    if (mode === "stamps") patch.stamps = Math.max(fresh.stamps, Math.min(fresh.stamps + bonus, stampsRequired));
    else patch.points = fresh.points + bonus;
    return { patch };
  });
  return res.ok ? mapCard(res.after) : null;
}

export async function db_addPoints(tenantId: string, customerCardId: string, points: number): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const now = new Date().toISOString();
  const res = await updateCardBalance(tenantId, customerCardId, (fresh) => ({
    patch: { points: (fresh.points ?? 0) + points, last_activity: now },
  }));
  if (!res.ok) return null;
  await maybeRecordVisit(cc.customer_id);
  return mapCard(res.after);
}

// Cumule les euros réellement dépensés — sert uniquement au calcul du rang
// (Silver/Gold/Platine) sur les cartes en mode points ; n'affecte jamais le
// solde de points lui-même (déjà géré par db_addPoints séparément).
export async function db_addSpend(tenantId: string, customerId: string, euros: number): Promise<void> {
  if (!(euros > 0)) return;
  const { data: customer } = await supabase().from("customers")
    .select("total_spent").eq("id", customerId).eq("merchant_id", tenantId).maybeSingle();
  if (!customer) return;
  await supabase().from("customers")
    .update({ total_spent: Number(customer.total_spent ?? 0) + euros })
    .eq("id", customerId).eq("merchant_id", tenantId);
}

// Ajoute N tampons d'un coup, plafonné à stampsRequired — utilisé pour le
// bonus de bienvenue du filleul (le parrain, lui, passe par db_addReferral).
export async function db_addStampsAmount(
  tenantId: string, customerCardId: string, amount: number, stampsRequired: number,
): Promise<DbCustomerCard | null> {
  const cc = await getCardInTenant(tenantId, customerCardId);
  if (!cc) return null;
  const now = new Date().toISOString();
  const res = await updateCardBalance(tenantId, customerCardId, (fresh) => ({
    patch: { stamps: Math.max(fresh.stamps, Math.min(fresh.stamps + amount, stampsRequired)), last_activity: now },
  }));
  return res.ok ? mapCard(res.after) : null;
}

// ── Historique rédemptions ────────────────────────────────────────────────────

export async function db_addRedemption(tenantId: string, r: Omit<DbRedemption, "id">): Promise<void> {
  await supabase().from("redemptions").insert({
    id: `red_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    merchant_id: tenantId,
    customer_id: r.customerId || null,
    customer_card_id: r.customerCardId || null,
    reward_name: r.rewardName,
    reward_emoji: r.rewardEmoji,
    cost: r.cost,
    cost_type: r.costType,
    redeemed_at: r.redeemedAt,
  });
}

export async function db_getRedemptions(tenantId: string): Promise<DbRedemption[]> {
  const { data } = await supabase().from("redemptions").select("*")
    .eq("merchant_id", tenantId).order("redeemed_at");
  return ((data ?? []) as RedemptionRow[]).map(mapRedemption);
}

// ── Déduction récompenses (portail client) ────────────────────────────────────

export interface DeductResult {
  success: boolean;
  reason?: string;
  card?: DbCustomerCard;
}

export async function db_deductReward(
  tenantId: string,
  customerCardId: string,
  costType: "stamps" | "points",
  cost: number,
): Promise<DeductResult> {
  // costType sert de nom de colonne dans le patch : seules ces deux valeurs
  // sont acceptées, quoi qu'envoie l'appelant.
  if (costType !== "stamps" && costType !== "points") return { success: false, reason: "Type de coût invalide" };
  if (!Number.isInteger(cost) || cost <= 0) return { success: false, reason: "Coût invalide" };
  const now = new Date().toISOString();
  const res = await updateCardBalance(tenantId, customerCardId, (cc) => {
    const solde = costType === "stamps" ? (cc.stamps ?? 0) : (cc.points ?? 0);
    if (solde < cost) return { refuse: costType === "stamps" ? "Pas assez de tampons" : "Pas assez de points" };
    return { patch: { [costType]: solde - cost, last_activity: now } };
  });
  if (!res.ok) return { success: false, reason: res.reason, card: res.card ? mapCard(res.card) : undefined };
  await maybeRecordVisit(res.before.customer_id);
  return { success: true, card: mapCard(res.after) };
}

/**
 * Rend ce qui vient d'être débité, quand l'opération qui suivait a échoué
 * (lot de jeu impossible à enregistrer, récompense non déduite…). Le client
 * ne doit jamais perdre des tampons pour rien.
 */
export async function db_refundBalance(
  tenantId: string,
  customerCardId: string,
  costType: "stamps" | "points",
  amount: number,
): Promise<boolean> {
  if (costType !== "stamps" && costType !== "points") return false;
  if (!(amount > 0)) return true;
  const res = await updateCardBalance(tenantId, customerCardId, (cc) => ({
    patch: { [costType]: (costType === "stamps" ? cc.stamps ?? 0 : cc.points ?? 0) + amount },
  }));
  return res.ok;
}

// ── Recherche cross-tenant (routes Apple Wallet sans session) ─────────────────

export async function findTenantByCustomerCardId(
  customerCardId: string,
): Promise<{ tenantId: string; card: DbCustomerCard } | null> {
  const { data } = await supabase().from("customer_cards").select("*, merchant_id")
    .eq("id", customerCardId).maybeSingle();
  if (!data) return null;
  return { tenantId: data.merchant_id as string, card: mapCard(data as CardRow) };
}

export async function db_incrementRewardUsage(tenantId: string, rewardName: string): Promise<void> {
  const sb = supabase();
  const { data } = await sb.from("rewards").select("id, usage_count")
    .eq("merchant_id", tenantId).eq("name", rewardName);
  for (const r of data ?? []) {
    await sb.from("rewards").update({ usage_count: (r.usage_count ?? 0) + 1 }).eq("id", r.id);
  }
}

export async function findTenantByCardId(cardId: string): Promise<string | null> {
  const { data } = await supabase().from("loyalty_cards").select("merchant_id")
    .eq("id", cardId).maybeSingle();
  return (data?.merchant_id as string) ?? null;
}
