import fs from "fs";
import path from "path";
import { db_getAll } from "./server-db";
import { indexGetTenants } from "./client-index";

interface TenantSettings {
  settings?: { storeName?: string; storeCity?: string; logoUrl?: string };
  loyaltyCards?: Array<{
    id: string; name: string; loyaltyMode: string;
    stampsRequired: number; pointsPerEuro: number; welcomePoints: number; welcomeMessage: string;
    backgroundColor: string; accentColor: string; textColor: string;
    referral?: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
  }>;
  rewards?: Array<{
    id: string; name: string; description: string;
    cost: number; mode: string; emoji: string; referral?: boolean;
  }>;
}

export interface ClientCard {
  tenantId: string;
  storeName: string;
  storeCity: string;
  customerId: string;
  customerName: string;
  customerCardId: string;
  cardId: string;
  cardName: string;
  loyaltyMode: "stamps" | "points";
  stampsRequired: number;
  pointsPerEuro: number;
  welcomePoints: number;
  welcomeMessage: string;
  stamps: number;
  points: number;
  referralCount: number;
  referralPoints: number;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string;
  rewards: Array<{
    id: string; name: string; description: string;
    cost: number; mode: string; emoji: string; referral?: boolean;
  }>;
  referral?: { enabled: boolean; referrerBonus: number; bonusType: "stamps" | "points" };
}

function readSettings(tenantId: string): TenantSettings {
  try {
    const p = path.join(process.cwd(), "data", "tenants", tenantId, "settings.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return {}; }
}

export function findClientCards(email: string): ClientCard[] {
  const tenantsDir = path.join(process.cwd(), "data", "tenants");
  if (!fs.existsSync(tenantsDir)) return [];

  const results: ClientCard[] = [];
  const normalizedEmail = email.toLowerCase().trim();

  // Utilise l'index si disponible, sinon fallback sur le scan complet
  const tenantIds = indexGetTenants(normalizedEmail) ?? fs.readdirSync(tenantsDir);

  for (const tenantId of tenantIds) {
    const db = db_getAll(tenantId);
    const customer = db.customers.find((c) => c.email.toLowerCase() === normalizedEmail);
    if (!customer) continue;

    const s = readSettings(tenantId);
    const cards = s.loyaltyCards ?? [];
    const rewards = s.rewards ?? [];
    const storeName = s.settings?.storeName ?? "Commerce";
    const storeCity = s.settings?.storeCity ?? "";
    const logoUrl = s.settings?.logoUrl ?? "";

    for (const cc of db.customerCards.filter((c) => c.customerId === customer.id)) {
      const lc = cards.find((c) => c.id === cc.cardId);
      if (!lc) continue;

      const mode = (lc.loyaltyMode ?? "stamps") as "stamps" | "points";
      const cardRewards = [
        ...rewards.filter((r) => r.mode === mode && !r.referral),
        ...rewards.filter((r) => r.referral),
      ];

      results.push({
        tenantId,
        storeName,
        storeCity,
        customerId: customer.id,
        customerName: customer.name,
        customerCardId: cc.id,
        cardId: lc.id,
        cardName: lc.name,
        loyaltyMode: mode,
        stampsRequired: lc.stampsRequired ?? 8,
        pointsPerEuro: lc.pointsPerEuro ?? 10,
        welcomePoints: lc.welcomePoints ?? 0,
        welcomeMessage: lc.welcomeMessage ?? "",
        stamps: cc.stamps,
        points: cc.points,
        referralCount: (cc as { referralCount?: number }).referralCount ?? 0,
        referralPoints: (cc as { referralPoints?: number }).referralPoints ?? 0,
        accentColor: lc.accentColor ?? "#16a34a",
        backgroundColor: lc.backgroundColor ?? "#1e1b4b",
        logoUrl,
        rewards: cardRewards,
        referral: lc.referral,
      });
    }
  }

  return results;
}
