import fs from "fs";
import path from "path";

export interface Redemption {
  token: string;
  tenantId: string;
  customerId: string;
  customerCardId: string;
  cardId: string;
  rewardName: string;
  rewardEmoji: string;
  cost: number;
  costType: "stamps" | "points" | "referral";
  exp: number;
  used: boolean;
  usedAt: string | null;
  createdAt: string;
}

const REDEMPTIONS_DIR = path.join(process.cwd(), "data", "redemptions");

function ensureDir() {
  if (!fs.existsSync(REDEMPTIONS_DIR)) fs.mkdirSync(REDEMPTIONS_DIR, { recursive: true });
}

function cleanupOld() {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(REDEMPTIONS_DIR)) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(REDEMPTIONS_DIR, f);
      try {
        const r: Redemption = JSON.parse(fs.readFileSync(p, "utf8"));
        if (r.exp < cutoff || (r.used && r.usedAt && new Date(r.usedAt).getTime() < cutoff)) {
          fs.unlinkSync(p);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
}

function filePath(token: string) {
  return path.join(REDEMPTIONS_DIR, `${token}.json`);
}

export function createRedemption(
  data: Omit<Redemption, "token" | "used" | "usedAt" | "createdAt">,
): Redemption {
  ensureDir();
  cleanupOld();
  const token = crypto.randomUUID();
  const r: Redemption = { ...data, token, used: false, usedAt: null, createdAt: new Date().toISOString() };
  fs.writeFileSync(filePath(token), JSON.stringify(r, null, 2));
  return r;
}

export function getRedemption(token: string): Redemption | null {
  try { return JSON.parse(fs.readFileSync(filePath(token), "utf8")); }
  catch { return null; }
}

export function markUsed(token: string): void {
  const r = getRedemption(token);
  if (!r) return;
  r.used = true;
  r.usedAt = new Date().toISOString();
  fs.writeFileSync(filePath(token), JSON.stringify(r, null, 2));
}

export function cancelPendingForCard(customerCardId: string): void {
  ensureDir();
  const now = Date.now();
  try {
    for (const f of fs.readdirSync(REDEMPTIONS_DIR)) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(REDEMPTIONS_DIR, f);
      try {
        const r: Redemption = JSON.parse(fs.readFileSync(p, "utf8"));
        if (r.customerCardId === customerCardId && !r.used && r.exp > now) {
          fs.unlinkSync(p);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
}
