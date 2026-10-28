#!/usr/bin/env node
/**
 * Crée les prix trimestriels (28 octobre 2026) :
 *
 *   Pro      : 39,99 € tous les 3 mois  (au lieu de 3 × 14,99 € = 44,97 €)
 *   Business : 79,99 € tous les 3 mois  (au lieu de 3 × 29,99 € = 89,97 €)
 *
 * Sur le MÊME produit Stripe que le prix mensuel actuel, avec le même
 * comportement de TVA. Rien n'est modifié sur les prix ou abonnements
 * existants.
 *
 * Par défaut : simulation. Ajouter --apply pour créer. Relançable sans
 * risque : un prix déjà créé est retrouvé par sa clé (lookup_key).
 *
 * Usage, sur le serveur, dans le dossier de l'app :
 *   eval "$(node scripts/pricing-2026-10/stripe-env.mjs .env.local)"
 *   node scripts/pricing-2026-10/create-quarterly-prices.mjs           # simulation
 *   node scripts/pricing-2026-10/create-quarterly-prices.mjs --apply   # création
 *
 * Affiche à la fin les 2 lignes STRIPE_PRICE_*_QUARTERLY à ajouter au .env.local.
 */
import Stripe from "stripe";

const APPLY = process.argv.includes("--apply");

const TARGETS = [
  { plan: "pro", amount: 3999 },
  { plan: "business", amount: 7999 },
];

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY manquant : charger le .env.local d'abord.");
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "PRODUCTION (live)" : "TEST";
console.log(`Stripe : ${mode} · ${APPLY ? "CRÉATION" : "SIMULATION (rien n'est créé)"}\n`);

const envLines = [];
for (const t of TARGETS) {
  const monthlyKey = `STRIPE_PRICE_${t.plan.toUpperCase()}_MONTHLY`;
  const monthlyId = (process.env[monthlyKey] ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0];
  if (!monthlyId) {
    console.error(`✗ ${monthlyKey} est vide : impossible de savoir sur quel produit créer le prix.`);
    process.exit(1);
  }
  const reference = await stripe.prices.retrieve(monthlyId);
  const product = typeof reference.product === "string" ? reference.product : reference.product.id;
  const lookupKey = `comeback_${t.plan}_quarterly_2026_10`;
  const label = `${t.plan} trimestriel : ${(t.amount / 100).toFixed(2)} € tous les 3 mois`;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  let id = existing.data[0]?.id ?? null;
  if (id) {
    console.log(`= ${label} · déjà créé (${id})`);
  } else if (!APPLY) {
    console.log(`+ ${label} · sera créé sur le produit ${product}`);
    id = "<nouveau_prix>";
  } else {
    const created = await stripe.prices.create({
      product,
      currency: reference.currency,
      unit_amount: t.amount,
      recurring: { interval: "month", interval_count: 3 },
      tax_behavior: reference.tax_behavior ?? "unspecified",
      lookup_key: lookupKey,
      nickname: `${t.plan} quarterly (grille 2026-10)`,
      metadata: { grille: "2026-10", plan: t.plan, cycle: "quarterly" },
    });
    id = created.id;
    console.log(`✓ ${label} · créé (${id})`);
  }
  envLines.push(`STRIPE_PRICE_${t.plan.toUpperCase()}_QUARTERLY=${id}`);
}

console.log("\nLignes à ajouter au .env.local :\n");
for (const line of envLines) console.log(line);
