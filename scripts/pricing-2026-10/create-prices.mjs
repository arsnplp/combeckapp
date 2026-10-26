#!/usr/bin/env node
/**
 * Étape 1 : crée les nouveaux prix Stripe (grille du 26 octobre 2026).
 *
 *   Pro      : 14,99 € / mois  ·  144 € / an
 *   Business : 29,99 € / mois  ·  288 € / an
 *
 * Les nouveaux prix sont créés sur le MÊME produit Stripe que les prix
 * actuels, avec le même comportement de TVA. Rien n'est modifié sur les
 * prix existants ni sur les abonnements : un prix Stripe ne change jamais,
 * on en ajoute simplement un nouveau à côté.
 *
 * Par défaut le script n'écrit rien (simulation). Ajouter --apply pour créer.
 * Il peut être relancé sans risque : un prix déjà créé est retrouvé par sa
 * clé (lookup_key) au lieu d'être créé une deuxième fois.
 *
 * Usage, sur le serveur, dans le dossier de l'app :
 *   set -a && . ./.env.local && set +a
 *   node scripts/pricing-2026-10/create-prices.mjs           # simulation
 *   node scripts/pricing-2026-10/create-prices.mjs --apply   # création
 */
import Stripe from "stripe";

const APPLY = process.argv.includes("--apply");

const TARGETS = [
  { plan: "pro", cycle: "monthly", amount: 1499, interval: "month" },
  { plan: "pro", cycle: "annual", amount: 14400, interval: "year" },
  { plan: "business", cycle: "monthly", amount: 2999, interval: "month" },
  { plan: "business", cycle: "annual", amount: 28800, interval: "year" },
];

function envKey(plan, cycle) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${cycle === "monthly" ? "MONTHLY" : "ANNUAL"}`;
}

function idsFromEnv(key) {
  return (process.env[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY manquant : charger le .env.local de production d'abord.");
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "PRODUCTION (live)" : "TEST";
console.log(`Stripe : ${mode} · ${APPLY ? "CRÉATION" : "SIMULATION (rien n'est créé)"}\n`);

const envLines = [];

for (const t of TARGETS) {
  const key = envKey(t.plan, t.cycle);
  const current = idsFromEnv(key);
  if (current.length === 0) {
    console.error(`✗ ${key} est vide : impossible de savoir sur quel produit créer le prix.`);
    process.exit(1);
  }
  const reference = await stripe.prices.retrieve(current[0]);
  const lookupKey = `comeback_${t.plan}_${t.cycle}_2026_10`;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  let newId = existing.data[0]?.id ?? null;

  const label = `${t.plan} ${t.cycle} : ${(reference.unit_amount / 100).toFixed(2)} € → ${(t.amount / 100).toFixed(2)} €`;

  if (newId) {
    console.log(`= ${label} · déjà créé (${newId})`);
  } else if (!APPLY) {
    console.log(`+ ${label} · sera créé sur le produit ${reference.product}`);
    newId = "<nouveau_prix>";
  } else {
    const created = await stripe.prices.create({
      product: typeof reference.product === "string" ? reference.product : reference.product.id,
      currency: reference.currency,
      unit_amount: t.amount,
      recurring: { interval: t.interval, interval_count: 1 },
      tax_behavior: reference.tax_behavior ?? "unspecified",
      lookup_key: lookupKey,
      nickname: `${t.plan} ${t.cycle} (grille 2026-10)`,
      metadata: { grille: "2026-10", plan: t.plan, cycle: t.cycle },
    });
    newId = created.id;
    console.log(`✓ ${label} · créé (${newId})`);
  }

  // Le nouveau prix en premier (nouveaux abonnements), les anciens ensuite
  // (abonnés existants, toujours reconnus par l'app).
  const others = current.filter((id) => id !== newId);
  envLines.push(`${key}=${[newId, ...others].join(",")}`);
}

console.log("\nLignes à mettre dans le .env.local de production (remplacent les 4 actuelles) :\n");
for (const line of envLines) console.log(line);
console.log("\nNe JAMAIS retirer les anciens IDs : des abonnés les utilisent encore.");
