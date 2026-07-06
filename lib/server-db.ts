import fs from "fs";
import path from "path";
import { indexAddCustomer, indexRemoveCustomer } from "./client-index";

// ── Chemin par tenant ─────────────────────────────────────────────────────────

function dbPath(tenantId: string): string {
  return path.join(process.cwd(), "data", "tenants", tenantId, "db.json");
}

export interface DbRedemption {
  id: string;
  customerId: string;
  customerCardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  costType: "stamps" | "points" | "referral";
  redeemedAt: string;
}

interface DbShape {
  customers: DbCustomer[];
  customerCards: DbCustomerCard[];
  redemptions: DbRedemption[];
}

export interface DbCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  totalVisits: number;
  lastVisitAt: string | null;
}

export interface DbCustomerCard {
  id: string;
  customerId: string;
  cardId: string;
  stamps: number;
  points: number;
  referralCount: number;
  referralPoints: number;
  joinDate: string;
  lastActivity: string;
}

function read(tenantId: string): DbShape {
  try {
    const raw = JSON.parse(fs.readFileSync(dbPath(tenantId), "utf8"));
    return { customers: [], customerCards: [], redemptions: [], ...raw };
  } catch {
    return { customers: [], customerCards: [], redemptions: [] };
  }
}

function write(tenantId: string, data: DbShape) {
  const p = dbPath(tenantId);
  const tmp = p + ".tmp";
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p); // atomic — protège contre la corruption si le process crash mid-write
}

export function db_getAll(tenantId: string): DbShape {
  return read(tenantId);
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

function maybeRecordVisit(data: DbShape, customerId: string): void {
  const idx = data.customers.findIndex((c) => c.id === customerId);
  if (idx === -1) return;
  const c = data.customers[idx];
  const last = c.lastVisitAt ? new Date(c.lastVisitAt).getTime() : 0;
  if (Date.now() - last > TWO_HOURS) {
    data.customers[idx].totalVisits = (c.totalVisits ?? 0) + 1;
    data.customers[idx].lastVisitAt = new Date().toISOString();
  }
}

export function db_addCustomer(tenantId: string, customer: DbCustomer, customerCard: DbCustomerCard): void {
  const data = read(tenantId);
  data.customers.push({ ...customer, totalVisits: 0, lastVisitAt: null });
  data.customerCards.push(customerCard);
  write(tenantId, data);
  if (customer.email) indexAddCustomer(customer.email, tenantId);
}

export function db_addStamp(tenantId: string, customerCardId: string): DbCustomerCard | null {
  const data = read(tenantId);
  const idx = data.customerCards.findIndex((c) => c.id === customerCardId);
  if (idx === -1) return null;
  data.customerCards[idx].stamps += 1;
  data.customerCards[idx].lastActivity = new Date().toISOString();
  maybeRecordVisit(data, data.customerCards[idx].customerId);
  write(tenantId, data);
  return data.customerCards[idx];
}

export function db_deleteCustomer(tenantId: string, customerId: string): void {
  const data = read(tenantId);
  const customer = data.customers.find((c) => c.id === customerId);
  data.customers = data.customers.filter((c) => c.id !== customerId);
  data.customerCards = data.customerCards.filter((cc) => cc.customerId !== customerId);
  write(tenantId, data);
  if (customer?.email) indexRemoveCustomer(customer.email, tenantId);
}

export function db_addReferral(tenantId: string, customerCardId: string): DbCustomerCard | null {
  const data = read(tenantId);
  const idx = data.customerCards.findIndex((c) => c.id === customerCardId);
  if (idx === -1) return null;
  data.customerCards[idx].referralCount = (data.customerCards[idx].referralCount ?? 0) + 1;
  data.customerCards[idx].referralPoints = (data.customerCards[idx].referralPoints ?? 0) + 1;
  write(tenantId, data);
  return data.customerCards[idx];
}

export function db_addPoints(tenantId: string, customerCardId: string, points: number): DbCustomerCard | null {
  const data = read(tenantId);
  const idx = data.customerCards.findIndex((c) => c.id === customerCardId);
  if (idx === -1) return null;
  data.customerCards[idx].points += points;
  data.customerCards[idx].lastActivity = new Date().toISOString();
  maybeRecordVisit(data, data.customerCards[idx].customerId);
  write(tenantId, data);
  return data.customerCards[idx];
}

// ── Historique rédemptions ────────────────────────────────────────────────────

export function db_addRedemption(tenantId: string, r: Omit<DbRedemption, "id">): void {
  const data = read(tenantId);
  data.redemptions.push({ id: `red_${Date.now()}`, ...r });
  write(tenantId, data);
}

export function db_getRedemptions(tenantId: string): DbRedemption[] {
  return read(tenantId).redemptions;
}

// ── Déduction récompenses (portail client) ────────────────────────────────────

export interface DeductResult {
  success: boolean;
  reason?: string;
  card?: DbCustomerCard;
}

export function db_deductReward(
  tenantId: string,
  customerCardId: string,
  costType: "stamps" | "points" | "referral",
  cost: number,
): DeductResult {
  const data = read(tenantId);
  const idx = data.customerCards.findIndex((c) => c.id === customerCardId);
  if (idx === -1) return { success: false, reason: "Carte introuvable" };
  const cc = data.customerCards[idx];
  if (costType === "stamps" && cc.stamps < cost) return { success: false, reason: "Pas assez de tampons", card: cc };
  if (costType === "points" && cc.points < cost) return { success: false, reason: "Pas assez de points", card: cc };
  if (costType === "referral" && (cc.referralPoints ?? 0) < cost) return { success: false, reason: "Pas assez de points de parrainage", card: cc };
  if (costType === "stamps") data.customerCards[idx].stamps -= cost;
  else if (costType === "points") data.customerCards[idx].points -= cost;
  else data.customerCards[idx].referralPoints = (data.customerCards[idx].referralPoints ?? 0) - cost;
  data.customerCards[idx].lastActivity = new Date().toISOString();
  maybeRecordVisit(data, data.customerCards[idx].customerId);
  write(tenantId, data);
  return { success: true, card: data.customerCards[idx] };
}

// ── Recherche cross-tenant (pour les routes Apple Wallet sans session) ─────────

export function findTenantByCustomerCardId(customerCardId: string): { tenantId: string; card: DbCustomerCard } | null {
  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) return null;
  for (const tenantId of fs.readdirSync(tenantsDir)) {
    const data = read(tenantId);
    const card = data.customerCards.find((cc) => cc.id === customerCardId);
    if (card) return { tenantId, card };
  }
  return null;
}

export function db_incrementRewardUsage(tenantId: string, rewardName: string): void {
  const settingsPath = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const rewards: Array<{ id: string; name: string; usageCount?: number }> = settings.rewards ?? [];
    let changed = false;
    for (const r of rewards) {
      if (r.name === rewardName) { r.usageCount = (r.usageCount ?? 0) + 1; changed = true; }
    }
    if (changed) fs.writeFileSync(settingsPath, JSON.stringify({ ...settings, rewards }, null, 2));
  } catch { /* settings manquants */ }
}

export function findTenantByCardId(cardId: string): string | null {
  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) return null;
  for (const tenantId of fs.readdirSync(tenantsDir)) {
    const settingsPath = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const cards: Array<{ id: string }> = settings.loyaltyCards ?? [];
      if (cards.some((c) => c.id === cardId)) return tenantId;
    } catch { /* pas de settings pour ce tenant */ }
  }
  return null;
}
