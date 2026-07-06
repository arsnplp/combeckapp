#!/usr/bin/env node
// Migration des données JSON → Supabase.
// Idempotent (upsert partout) : peut être relancé sans dupliquer.
// Usage : node scripts/migrate-to-supabase.mjs [chemin/vers/data]

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ── Env ───────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DATA = process.argv[2] ?? path.join(process.cwd(), "data");
const readJson = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
};

let errors = 0;
async function upsert(table, rows, conflict = "id") {
  if (!rows.length) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict: conflict });
  if (error) { console.error(`  ✗ ${table}:`, error.message); errors++; }
  else console.log(`  ✓ ${table}: ${rows.length} ligne(s)`);
}

// ── 1. Merchants (users.json + tenant admin) ─────────────────
const users = readJson(path.join(DATA, "users.json"), []);
const merchants = users.map((u) => ({
  id: u.id,
  email: u.email,
  password_hash: u.passwordHash ?? "",
  password_plain: u.passwordPlain ?? null,
  google_id: u.googleId ?? null,
  store_name: u.storeName ?? "Commerce",
  city: u.city ?? "",
  plan: u.plan ?? "starter",
  email_verified: u.emailVerified ?? false,
  is_admin: false,
  created_at: u.createdAt ?? new Date().toISOString(),
}));

// Tenant spécial "admin" (console super admin) — pas dans users.json
const tenantsDir = path.join(DATA, "tenants");
const tenantIds = fs.existsSync(tenantsDir) ? fs.readdirSync(tenantsDir).filter((t) => fs.statSync(path.join(tenantsDir, t)).isDirectory()) : [];
if (tenantIds.includes("admin") && !merchants.find((m) => m.id === "admin")) {
  merchants.push({
    id: "admin",
    email: "admin@comeback.local", // interne — le login admin passe par ADMIN_EMAIL en env, pas par cette ligne
    password_hash: "",
    password_plain: null,
    google_id: null,
    store_name: "Mon Établissement",
    city: "",
    plan: "business",
    email_verified: true,
    created_at: new Date().toISOString(),
  });
  merchants[merchants.length - 1].is_admin = true;
}
await upsert("merchants", merchants);

// ── 2. Clients globaux ───────────────────────────────────────
// (upsert manuel : l'unicité est un index fonctionnel lower(email),
//  que ON CONFLICT ne peut pas cibler via PostgREST)
const clientAccounts = readJson(path.join(DATA, "client-accounts.json"), []);
{
  const { data: existing } = await sb.from("clients").select("id, email");
  const byEmail = new Map((existing ?? []).map((c) => [c.email.toLowerCase(), c.id]));
  let n = 0;
  for (const a of clientAccounts) {
    const email = a.email.toLowerCase();
    const row = {
      email,
      password_hash: a.passwordHash ?? "",
      password_plain: a.passwordPlain ?? null,
      name: a.name ?? "",
      google_id: a.googleId ?? null,
      created_at: a.createdAt ?? new Date().toISOString(),
    };
    const existingId = byEmail.get(email);
    const { error } = existingId
      ? await sb.from("clients").update(row).eq("id", existingId)
      : await sb.from("clients").insert({ id: `cl_${email.replace(/[^a-z0-9]/g, "_")}`, ...row });
    if (error) { console.error("  ✗ clients:", error.message); errors++; } else n++;
  }
  console.log(`  ✓ clients: ${n} ligne(s)`);
}

// ── 3. Sessions clients ──────────────────────────────────────
const sessions = readJson(path.join(DATA, "client-sessions.json"), []);
await upsert("client_sessions", sessions.map((s) => ({
  token: s.token,
  client_email: s.email.toLowerCase(),
  created_at: s.createdAt,
  expires_at: s.expiresAt ?? new Date(Date.now() + 30 * 864e5).toISOString(),
})), "token");

// ── 4. Par tenant : cartes, rewards, produits, clients, soldes ──
const validCustomerIds = new Set();
const validCardIds = new Set();
const validCustomerCardIds = new Set();

for (const tenantId of tenantIds) {
  console.log(`\nTenant ${tenantId}:`);
  const settings = readJson(path.join(tenantsDir, tenantId, "settings.json"), {});
  const db = readJson(path.join(tenantsDir, tenantId, "db.json"), {});

  // Settings divers → colonnes + jsonb
  const s = settings.settings ?? {};
  await sb.from("merchants").update({
    store_name: s.storeName ?? s.name ?? undefined,
    address: s.address ?? "",
    phone: s.phone ?? "",
    website: s.website ?? "",
    logo_url: s.logoUrl ?? null,
    settings: s,
    wallet_config: settings.walletConfig ?? {},
  }).eq("id", tenantId);

  // Cartes de fidélité
  const cards = (settings.loyaltyCards ?? []).filter((c) => c.id);
  cards.forEach((c) => validCardIds.add(c.id));
  await upsert("loyalty_cards", cards.map((c) => ({
    id: c.id,
    merchant_id: tenantId,
    name: c.name ?? "Carte",
    loyalty_mode: c.loyaltyMode === "points" ? "points" : "stamps",
    stamps_required: c.stampsRequired ?? 8,
    points_per_euro: c.pointsPerEuro ?? 10,
    welcome_points: c.welcomePoints ?? 0,
    welcome_message: c.welcomeMessage ?? "",
    background_color: c.backgroundColor ?? "#1e293b",
    accent_color: c.accentColor ?? "#16a34a",
    text_color: c.textColor ?? "#ffffff",
    referral_enabled: c.referral?.enabled ?? false,
    referral_bonus: c.referral?.referrerBonus ?? 1,
    referral_bonus_type: c.referral?.bonusType ?? "stamps",
    rank_thresholds: c.rankThresholds ?? { silver: 2, gold: 5, platine: 10 },
    active: c.active ?? true,
  })));

  // Récompenses
  const rewards = (settings.rewards ?? []).filter((r) => r.id);
  await upsert("rewards", rewards.map((r) => ({
    id: r.id,
    merchant_id: tenantId,
    name: r.name ?? "",
    description: r.description ?? "",
    emoji: r.emoji ?? "🎁",
    cost: Math.max(1, r.cost ?? 1),
    mode: r.mode === "points" ? "points" : "stamps",
    is_referral: r.referral ?? false,
    usage_count: r.usageCount ?? 0,
  })));

  // Produits
  const products = (settings.products ?? []).filter((p) => p.id);
  await upsert("products", products.map((p) => ({
    id: p.id,
    merchant_id: tenantId,
    name: p.name ?? "",
    description: p.description ?? "",
    price: p.price ?? 0,
    category: p.category ?? "",
    active: p.active ?? true,
    points_value: p.pointsValue ?? 0,
  })));

  // Clients du commerce
  const customers = (db.customers ?? []).filter((c) => c.id);
  customers.forEach((c) => validCustomerIds.add(c.id));
  await upsert("customers", customers.map((c) => ({
    id: c.id,
    merchant_id: tenantId,
    name: c.name ?? "",
    email: (c.email ?? "").toLowerCase(),
    phone: c.phone ?? "",
    total_visits: c.totalVisits ?? 0,
    last_visit_at: c.lastVisitAt ?? null,
    join_date: c.joinDate ?? new Date().toISOString(),
  })));

  // Cartes détenues (soldes) — FK carte requise
  const ccs = (db.customerCards ?? []).filter(
    (cc) => cc.id && validCustomerIds.has(cc.customerId) && validCardIds.has(cc.cardId),
  );
  ccs.forEach((cc) => validCustomerCardIds.add(cc.id));
  await upsert("customer_cards", ccs.map((cc) => ({
    id: cc.id,
    merchant_id: tenantId,
    customer_id: cc.customerId,
    card_id: cc.cardId,
    stamps: cc.stamps ?? 0,
    points: cc.points ?? 0,
    referral_count: cc.referralCount ?? 0,
    referral_points: cc.referralPoints ?? 0,
    join_date: cc.joinDate ?? new Date().toISOString(),
    last_activity: cc.lastActivity ?? new Date().toISOString(),
  })));

  // Historique de récompenses
  const reds = (db.redemptions ?? []);
  await upsert("redemptions", reds.map((r, i) => ({
    id: r.id ?? `red_${tenantId}_${i}_${r.redeemedAt ?? ""}`.replace(/[^a-zA-Z0-9_-]/g, ""),
    merchant_id: tenantId,
    customer_id: validCustomerIds.has(r.customerId) ? r.customerId : null,
    customer_card_id: validCustomerCardIds.has(r.customerCardId) ? r.customerCardId : null,
    reward_name: r.rewardName ?? "",
    reward_emoji: r.rewardEmoji ?? "🎁",
    cost: r.cost ?? 0,
    cost_type: ["stamps", "points", "referral"].includes(r.costType) ? r.costType : "stamps",
    redeemed_at: r.redeemedAt ?? new Date().toISOString(),
  })));
}

// ── 5. Apple Wallet ──────────────────────────────────────────
console.log("\nWallet:");
const walletDb = readJson(path.join(DATA, "wallet-db.json"), { passes: [], devices: [] });
const passes = walletDb.passes ?? [];
const validSerials = new Set(passes.map((p) => p.serialNumber));
await upsert("wallet_passes", passes.map((p) => ({
  serial_number: p.serialNumber,
  id: p.id ?? `wp-${p.serialNumber}`,
  customer_id: p.customerId ?? null,
  customer_card_id: validCustomerCardIds.has(p.customerCardId) ? p.customerCardId : null,
  auth_token: p.authenticationToken ?? "",
  pass_type_identifier: p.passTypeIdentifier ?? "pass.comeback",
  pass_data: p.passData ?? {},
  campaign_message: p.campaignMessage ?? null,
  updated_at: p.updatedAt ?? new Date().toISOString(),
  created_at: p.createdAt ?? new Date().toISOString(),
})), "serial_number");

const devices = walletDb.devices ?? [];
await upsert("wallet_registrations", devices
  .map((d) => {
    const passId = d.passId ?? (d.id ?? "").replace(/^dev-[^-]+-/, "");
    const serial = passId.replace(/^wp-/, "");
    return {
      id: d.id ?? `dev-${d.deviceLibraryIdentifier}-${passId}`,
      device_library_id: d.deviceLibraryIdentifier,
      push_token: d.pushToken ?? "",
      serial_number: serial,
      pass_id: passId,
      created_at: d.registeredAt ?? new Date().toISOString(),
    };
  })
  .filter((d) => validSerials.has(d.serial_number)));

// ── 6. Tokens reset / vérif email ────────────────────────────
const resetTokens = readJson(path.join(DATA, "reset-tokens.json"), []);
await upsert("auth_tokens", resetTokens
  .filter((t) => t.token && t.email)
  .map((t) => ({
    token: t.token,
    type: t.type === "client" ? "client_reset" : t.type === "verify" ? "email_verify" : "merchant_reset",
    email: t.email.toLowerCase(),
    expires_at: t.expiresAt ?? new Date(t.exp ?? Date.now() + 36e5).toISOString(),
  })), "token");

// ── 7. Tokens de redemption (QR récompenses en cours) ────────
const redDir = path.join(DATA, "redemptions");
if (fs.existsSync(redDir)) {
  const tokens = fs.readdirSync(redDir).filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(redDir, f), null)).filter(Boolean);
  await upsert("redemption_tokens", tokens.map((t) => ({
    id: t.token,
    merchant_id: t.tenantId ?? null,
    payload: t,
    used: t.used ?? false,
  })));
}

console.log(errors ? `\n⚠ Terminé avec ${errors} erreur(s)` : "\n✅ Migration terminée sans erreur");
process.exit(errors ? 1 : 0);
