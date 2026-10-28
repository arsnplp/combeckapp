#!/usr/bin/env node
/**
 * Lit un .env.local et affiche les variables STRIPE_* sous forme de
 * lignes `export KEY='valeur'` sûres pour bash (eval). Évite de « sourcer »
 * le .env.local, qui peut contenir des valeurs que bash ne sait pas lire
 * (parenthèses, &, espaces…).
 *
 * Usage : eval "$(node scripts/pricing-2026-10/stripe-env.mjs .env.local)"
 */
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? ".env.local";
const q = (v) => `'${v.replace(/'/g, `'\\''`)}'`;

for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m || !m[1].startsWith("STRIPE_")) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  console.log(`export ${m[1]}=${q(v)}`);
}
