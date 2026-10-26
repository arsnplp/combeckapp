#!/usr/bin/env node
/**
 * Étape 3 : fait passer les abonnés Business actuels au nouveau prix
 * (39,99 € → 29,99 € par mois, 384 € → 288 € par an).
 *
 * C'est une BAISSE : on l'applique à tout le monde, sinon un ancien client
 * paierait plus cher qu'un nouveau. Les abonnés Pro ne sont PAS touchés :
 * ils gardent 9,99 € (et profitent de la nouvelle limite de 300 clients).
 *
 * Ce que fait la mise à jour, abonnement par abonnement :
 *   - remplace le prix de la ligne d'abonnement par le nouveau prix ;
 *   - proration_behavior "none" : aucune facture ni remboursement immédiat,
 *     le nouveau montant s'applique à la prochaine échéance ;
 *   - ne touche ni à la carte enregistrée, ni à la date d'échéance, ni à la
 *     fin d'essai, ni aux codes promo, ni aux métadonnées.
 * L'abonnement n'est jamais annulé ni recréé : le client n'a rien à refaire.
 *
 * Prérequis : le .env.local doit déjà contenir les nouvelles lignes
 * produites par create-prices.mjs (nouveau prix en premier, ancien ensuite).
 *
 * Par défaut le script n'écrit rien (simulation). Ajouter --apply pour migrer.
 *
 * Usage, sur le serveur, dans le dossier de l'app :
 *   set -a && . ./.env.local && set +a
 *   node scripts/pricing-2026-10/migrate-business.mjs           # simulation
 *   node scripts/pricing-2026-10/migrate-business.mjs --apply   # migration
 */
import Stripe from "stripe";

const APPLY = process.argv.includes("--apply");
const LIVE_STATUSES = new Set(["trialing", "active", "past_due", "unpaid"]);

function idsFromEnv(key) {
  return (process.env[key] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY manquant : charger le .env.local de production d'abord.");
  process.exit(1);
}

// old price id → new price id, pour le mensuel et l'annuel
const mapping = new Map();
for (const key of ["STRIPE_PRICE_BUSINESS_MONTHLY", "STRIPE_PRICE_BUSINESS_ANNUAL"]) {
  const [newId, ...oldIds] = idsFromEnv(key);
  if (!newId || oldIds.length === 0) {
    console.error(`✗ ${key} doit contenir « nouveau,ancien » : lancer create-prices.mjs et mettre à jour le .env.local d'abord.`);
    process.exit(1);
  }
  for (const oldId of oldIds) mapping.set(oldId, newId);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "PRODUCTION (live)" : "TEST";
console.log(`Stripe : ${mode} · ${APPLY ? "MIGRATION" : "SIMULATION (rien n'est modifié)"}\n`);

// Vérifie que chaque nouveau prix a bien le même intervalle que l'ancien
for (const [oldId, newId] of mapping) {
  const [o, n] = await Promise.all([stripe.prices.retrieve(oldId), stripe.prices.retrieve(newId)]);
  if (o.recurring?.interval !== n.recurring?.interval || o.currency !== n.currency) {
    console.error(`✗ ${oldId} (${o.recurring?.interval}) et ${newId} (${n.recurring?.interval}) ne correspondent pas : arrêt.`);
    process.exit(1);
  }
  console.log(`  ${(o.unit_amount / 100).toFixed(2)} €/${o.recurring.interval} → ${(n.unit_amount / 100).toFixed(2)} €/${n.recurring.interval}`);
}
console.log("");

let migrated = 0, skipped = 0, failed = 0, alreadyNew = 0;

for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
  if (!LIVE_STATUSES.has(sub.status)) continue;
  const items = sub.items?.data ?? [];
  const target = items.find((it) => mapping.has(it.price?.id));
  if (!target) {
    if (items.some((it) => [...mapping.values()].includes(it.price?.id))) alreadyNew++;
    continue;
  }

  const who = `${sub.id} · ${sub.metadata?.merchantId ?? sub.customer} · ${sub.status}`;
  if (items.length > 1) {
    console.log(`! ignoré (plusieurs lignes, à faire à la main) : ${who}`);
    skipped++;
    continue;
  }
  if (sub.schedule) {
    console.log(`! ignoré (échéancier Stripe attaché, à faire à la main) : ${who}`);
    skipped++;
    continue;
  }

  const newId = mapping.get(target.price.id);
  if (!APPLY) {
    console.log(`→ à migrer : ${who}`);
    migrated++;
    continue;
  }
  try {
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: target.id, price: newId }],
      proration_behavior: "none",
    });
    console.log(`✓ migré : ${who}`);
    migrated++;
  } catch (e) {
    console.error(`✗ échec : ${who} · ${e.message}`);
    failed++;
  }
}

console.log(`\n${APPLY ? "Migrés" : "À migrer"} : ${migrated} · déjà au nouveau prix : ${alreadyNew} · ignorés : ${skipped} · échecs : ${failed}`);
if (failed > 0) process.exit(1);
