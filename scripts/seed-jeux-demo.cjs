/**
 * Seed de démonstration du module Jeux — PRÉPROD uniquement.
 *
 * Monte un commerce crédible et surtout un historique : un tableau de bord
 * vide ne se montre pas en rendez-vous commercial.
 *
 * Usage (sur le serveur) : node scripts/seed-jeux-demo.cjs
 */
const fs = require("node:fs");
const crypto = require("node:crypto");

const DIR = "/var/www/getcomeback-staging";
for (const l of fs.readFileSync(DIR + "/.env.local", "utf8").split("\n")) {
  if (!l.includes("=") || l.trimStart().startsWith("#")) continue;
  const k = l.slice(0, l.indexOf("=")).trim();
  let v = l.slice(l.indexOf("=") + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}
const bcrypt = require(DIR + "/node_modules/bcryptjs");
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

const post = async (t, b) => {
  const r = await fetch(`${URL_}/rest/v1/${t}`, { method: "POST", headers: H, body: JSON.stringify(b) });
  if (!r.ok) console.log("  ! " + t, r.status, (await r.text()).slice(0, 140));
  return r.ok;
};
const del = (t, q) => fetch(`${URL_}/rest/v1/${t}?${q}`, { method: "DELETE", headers: H });
const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const MERCHANT = "jeux.demo@example.com";
const PWD_M = "JeuxDemo2026!";
const PWD_C = "JoueurDemo2026!";

// Récompenses volontairement génériques : aucune ne trahit un secteur.
const RECOMPENSES = [
  { name: "Une boisson offerte",   emoji: "🥤", cost: 5 },
  { name: "Un dessert offert",     emoji: "🍰", cost: 8 },
  { name: "-10 % sur l'addition",  emoji: "🏷️", cost: 4 },
  { name: "Le grand lot",          emoji: "🎁", cost: 15 },
];

const JEUX = [
  { key: "wheel",   cost: 2, limit: 3, lose: 40, parts: [25, 15, 15, 5] },
  { key: "scratch", cost: 1, limit: 5, lose: 55, parts: [20, 10, 12, 3] },
  { key: "chests",  cost: 3, limit: 2, lose: 30, parts: [30, 20, 15, 5] },
];

const PRENOMS = ["Léa", "Thomas", "Inès", "Hugo", "Camille", "Noah", "Jade", "Lucas"];

(async () => {
  console.log("Nettoyage de l'ancien jeu de démonstration…");
  const [old] = await (await fetch(`${URL_}/rest/v1/merchants?email=eq.${MERCHANT}&select=id`, { headers: H })).json();
  if (old) {
    for (const t of ["game_plays", "game_configs", "activities", "customer_cards", "customers", "rewards", "loyalty_cards"])
      await del(t, `merchant_id=eq.${old.id}`);
    await del("merchants", `id=eq.${old.id}`);
  }
  for (const p of PRENOMS) await del("clients", `email=eq.${p.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.joueur@example.com`);

  const mid = uid("u_jeux");
  await post("merchants", {
    id: mid, email: MERCHANT, password_hash: await bcrypt.hash(PWD_M, 12),
    store_name: "La Boutique Démo", city: "Paris", address: "10 Rue de Rivoli",
    phone: "0600000000", plan: "business",
    plan_expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    created_at: new Date(Date.now() - 60 * 864e5).toISOString(),
    email_verified: true, is_admin: false,
    wallet_config: { games: { enabled: true } },
  });

  const cardId = uid("lc_jeux");
  await post("loyalty_cards", {
    id: cardId, merchant_id: mid, name: "Carte La Boutique Démo",
    loyalty_mode: "stamps", stamps_required: 10, active: true,
    background_color: "#1e293b", accent_color: "#16a34a", text_color: "#ffffff",
  });

  const rewardIds = [];
  for (const r of RECOMPENSES) {
    const id = uid("rw");
    rewardIds.push(id);
    await post("rewards", { id, merchant_id: mid, name: r.name, emoji: r.emoji, cost: r.cost, mode: "stamps", usage_count: 0, description: "" });
  }

  for (const j of JEUX) {
    await post("game_configs", {
      id: `gc_${mid}_${j.key}`, merchant_id: mid, game_key: j.key, enabled: true,
      cost: j.cost, cost_type: "stamps", daily_limit: j.limit, lose_probability: j.lose,
      prizes: rewardIds.map((id, i) => ({
        rewardId: id, probability: j.parts[i],
        stock: i === 3 ? 20 : null,   // le grand lot est le seul limité
        wonCount: 0,
      })),
    });
  }

  // Joueur principal de la démo, avec de quoi enchaîner les parties.
  const custPrincipal = uid("c_joueur");
  await post("customers", { id: custPrincipal, merchant_id: mid, email: "joueur.demo@example.com", name: "Alex Martin", phone: "0611111111" });
  await post("customer_cards", { id: uid("cc_joueur"), merchant_id: mid, customer_id: custPrincipal, card_id: cardId, stamps: 40, points: 0 });
  await del("clients", "email=eq.joueur.demo@example.com");
  await post("clients", { id: uid("cl"), email: "joueur.demo@example.com", password_hash: await bcrypt.hash(PWD_C, 10), name: "Alex Martin" });

  // Historique : 30 jours de parties, plusieurs joueurs, pour que les
  // chiffres et la courbe aient quelque chose à raconter.
  console.log("Génération de l'historique…");
  const joueurs = [{ id: custPrincipal, nom: "Alex Martin" }];
  for (const p of PRENOMS) {
    const id = uid("c");
    await post("customers", { id, merchant_id: mid, email: `${p.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.joueur@example.com`, name: `${p} D.`, phone: "" });
    await post("customer_cards", { id: uid("cc"), merchant_id: mid, customer_id: id, card_id: cardId, stamps: 5 + Math.floor(Math.random() * 20), points: 0 });
    joueurs.push({ id, nom: `${p} D.` });
  }

  const lignes = [];
  for (let jour = 29; jour >= 0; jour--) {
    // Un peu plus d'activité le week-end, comme dans la vraie vie.
    const d = new Date(Date.now() - jour * 864e5);
    const we = [0, 6].includes(d.getDay());
    const nb = Math.floor(Math.random() * (we ? 9 : 5)) + (we ? 3 : 1);
    for (let k = 0; k < nb; k++) {
      const j = JEUX[Math.floor(Math.random() * JEUX.length)];
      const joueur = joueurs[Math.floor(Math.random() * joueurs.length)];
      const total = j.parts.reduce((s, x) => s + x, 0) + j.lose;
      let tirage = Math.random() * total, gagnant = null;
      for (let i = 0; i < j.parts.length; i++) { tirage -= j.parts[i]; if (tirage < 0) { gagnant = i; break; } }
      const gagne = gagnant !== null;
      const quand = new Date(d); quand.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));
      lignes.push({
        id: uid("gp"), merchant_id: mid, game_key: j.key,
        customer_id: joueur.id, customer_card_id: "cc_demo_historique",
        played_at: quand.toISOString(), cost: j.cost, cost_type: "stamps",
        result_type: gagne ? "win" : "lose",
        reward_id: gagne ? rewardIds[gagnant] : null,
        reward_name: gagne ? RECOMPENSES[gagnant].name : null,
        reward_emoji: gagne ? RECOMPENSES[gagnant].emoji : null,
        prize_code: gagne ? crypto.randomUUID() : null,
        // Deux lots gagnés sur trois ont déjà été utilisés en caisse.
        used_at: gagne && Math.random() < 0.66 ? new Date(quand.getTime() + 864e5).toISOString() : null,
      });
    }
  }
  for (let i = 0; i < lignes.length; i += 50) await post("game_plays", lignes.slice(i, i + 50));

  // Le stock doit refléter l'historique : sans ça le tableau de bord
  // annonce « 20/20 » alors que des exemplaires ont déjà été gagnés.
  for (const j of JEUX) {
    const gagnes = {};
    for (const l of lignes) {
      if (l.game_key !== j.key || !l.reward_id) continue;
      gagnes[l.reward_id] = (gagnes[l.reward_id] ?? 0) + 1;
    }
    await fetch(`${URL_}/rest/v1/game_configs?id=eq.gc_${mid}_${j.key}`, {
      method: "PATCH", headers: H,
      body: JSON.stringify({
        prizes: rewardIds.map((id, i) => ({
          rewardId: id, probability: j.parts[i],
          stock: i === 3 ? 20 : null,
          wonCount: gagnes[id] ?? 0,
        })),
      }),
    });
  }

  console.log(`\n=== PRÊT — ${lignes.length} parties sur 30 jours ===`);
  console.log("Commerçant : " + MERCHANT + " / " + PWD_M);
  console.log("Joueur     : joueur.demo@example.com / " + PWD_C + "  (40 tampons)");
})().catch((e) => { console.error("ECHEC", e); process.exit(1); });
