#!/usr/bin/env node
/**
 * Auto-test Stripe (MODE TEST UNIQUEMENT) des règles de facturation :
 *
 *  1. Essai Business trimestriel : abonnement en essai, 0 € facturé.
 *  2. Passage sur Pro pendant l'essai, exactement comme le fait
 *     /api/billing/checkout : la fin d'essai ne bouge pas, rien n'est
 *     facturé, le prix devient Pro.
 *  3. Pro payé sans essai : facturé tout de suite.
 *
 * Utilise le moyen de paiement de test Stripe `pm_card_visa` (aucune vraie
 * carte) et supprime le client de test à la fin. Refuse de tourner avec une
 * clé live.
 *
 *   eval "$(node scripts/pricing-2026-10/stripe-env.mjs .env.local)"
 *   node scripts/pricing-2026-10/selftest-trial-switch.mjs
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test")) {
  console.error("Auto-test réservé au mode test Stripe (clé sk_test). Rien n'a été fait.");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
const first = (k) => (process.env[k] ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0];
const businessQ = first("STRIPE_PRICE_BUSINESS_QUARTERLY");
const proM = first("STRIPE_PRICE_PRO_MONTHLY");
if (!businessQ || !proM) {
  console.error("Prix manquants (STRIPE_PRICE_BUSINESS_QUARTERLY, STRIPE_PRICE_PRO_MONTHLY).");
  process.exit(1);
}

let ok = true;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!cond) ok = false;
};

const customer = await stripe.customers.create({
  email: "autotest-trimestre@example.com",
  payment_method: "pm_card_visa",
  metadata: { autotest: "1" },
});
try {
  const pm = (await stripe.paymentMethods.list({ customer: customer.id, type: "card" })).data[0];
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });

  // 1. Essai Business trimestriel
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: businessQ }],
    trial_period_days: 30,
  });
  const inv1 = await stripe.invoices.retrieve(sub.latest_invoice);
  check("Essai Business trimestriel créé en essai", sub.status === "trialing", sub.status);
  check("Rien facturé à l'inscription", inv1.amount_due === 0, `${inv1.amount_due / 100} €`);
  const price1 = sub.items.data[0].price;
  check("Prix trimestriel : 3 mois", price1.recurring.interval === "month" && price1.recurring.interval_count === 3,
    `${price1.unit_amount / 100} € / ${price1.recurring.interval_count} ${price1.recurring.interval}`);

  // 2. Passage sur Pro pendant l'essai (même appel que /api/billing/checkout)
  const before = sub.trial_end;
  const upd = await stripe.subscriptions.update(sub.id, {
    items: [{ id: sub.items.data[0].id, price: proM }],
    proration_behavior: "none",
    cancel_at_period_end: false,
    metadata: { plan: "pro", billingCycle: "monthly" },
  });
  check("Toujours en essai après le passage sur Pro", upd.status === "trialing", upd.status);
  check("Fin d'essai inchangée", upd.trial_end === before);
  check("Prix devenu Pro mensuel", upd.items.data[0].price.id === proM);
  const invs = await stripe.invoices.list({ customer: customer.id, limit: 10 });
  check("Aucune facture payante pendant l'essai", invs.data.every((i) => i.amount_due === 0),
    invs.data.map((i) => `${i.amount_due / 100} €`).join(", "));
  await stripe.subscriptions.cancel(sub.id);

  // 3. Pro payé sans essai
  const paid = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: proM }] });
  const inv3 = await stripe.invoices.retrieve(paid.latest_invoice);
  check("Pro sans essai facturé tout de suite", paid.status === "active" && inv3.amount_paid > 0,
    `${paid.status}, ${inv3.amount_paid / 100} €`);
  await stripe.subscriptions.cancel(paid.id);
} finally {
  await stripe.customers.del(customer.id);
}

console.log(ok ? "\nAUTOTEST OK" : "\nAUTOTEST EN ÉCHEC");
process.exit(ok ? 0 : 1);
