# Nouvelle grille tarifaire (26 octobre 2026)

| Plan | Avant | Après (nouveaux abonnements) |
|---|---|---|
| Pro | 9,99 € / mois · 96 € / an · 100 clients | 14,99 € / mois · 144 € / an · 300 clients |
| Business | 39,99 € / mois · 384 € / an | 29,99 € / mois · 288 € / an |

## Ce qui arrive aux abonnés existants

- **Pro** : rien ne change sur leur abonnement Stripe. Ils continuent de payer
  9,99 € (ou 96 € / an) et passent à 300 clients.
- **Business** (et essais en cours) : passent au nouveau prix, plus bas, à leur
  prochaine échéance, via `migrate-business.mjs`. Même abonnement, même carte,
  même date d'échéance. Rien à refaire de leur côté.
- Aucun abonnement n'est annulé ni recréé.

## Pourquoi l'ordre compte

L'app retrouve le plan d'un abonné à partir de l'ID de son prix Stripe
(`planFromPriceId`). Si les anciens IDs disparaissaient de la config, les
abonnés restés sur l'ancien prix ne seraient plus reconnus au renouvellement.
Les variables `STRIPE_PRICE_*` acceptent donc une liste : le premier ID est le
prix des nouveaux abonnements, les suivants restent reconnus.

## Marche à suivre (sur le serveur de production, dossier de l'app)

1. Charger la config : `set -a && . ./.env.local && set +a`
2. Simuler puis créer les prix :
   `node scripts/pricing-2026-10/create-prices.mjs` puis `--apply`.
   Le script affiche 4 lignes `STRIPE_PRICE_…=nouveau,ancien`.
3. Sauvegarder le `.env.local` (`cp .env.local .env.local.bak-2026-10`),
   remplacer les 4 lignes `STRIPE_PRICE_*` par celles affichées.
4. Déployer ce code, `npm run build`, puis `pm2 restart comeback --update-env`.
   (Code et config doivent partir ensemble : le code affiche les nouveaux prix,
   la config fait payer les nouveaux prix.)
5. Recharger la config, simuler puis migrer les Business :
   `node scripts/pricing-2026-10/migrate-business.mjs` puis `--apply`.
6. Dans le Dashboard Stripe → Paramètres → Portail client : si le changement
   de plan y est activé, remplacer les anciens prix par les nouveaux dans la
   liste des produits proposés.

## Retour arrière

Remettre le `.env.local` sauvegardé et redéployer la version précédente. Les
nouveaux prix Stripe restent créés mais inutilisés. Les abonnements Business
déjà migrés peuvent être remis sur l'ancien prix avec le même script en
inversant les IDs (ce n'est pas souhaitable : ce serait une hausse).
