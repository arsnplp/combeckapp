#!/usr/bin/env bash
# Lancement de la grille du 26 octobre 2026 (Pro 14,99 €, Business 29,99 €).
# À lancer en root sur le VPS :  bash launch.sh
#
# 1. Prépare la nouvelle version de l'app à côté de la prod (prod intacte).
# 2. Crée les 4 nouveaux prix Stripe (live) et met leurs IDs dans le .env.local
#    (nouveau prix en premier, anciens conservés pour les abonnés existants).
# 3. Build, puis bascule l'app (ancienne version gardée en sauvegarde).
# 4. Passe le site et la landing sur la nouvelle grille.
# 5. SIMULE la migration des abonnés Business (rien n'est modifié chez eux).
#
# Si une étape échoue, le script s'arrête. Tant que l'étape 3 n'est pas
# atteinte, la prod n'a pas bougé (au pire, des prix Stripe créés et inutilisés).
set -euo pipefail

APP=/var/www/getcomeback-app
NEXT=/var/www/getcomeback-app-grille
BACKUP=/var/www/getcomeback-app-avant-grille
SITE=/var/www/getcomeback-site
LANDING=/var/www/foodtruck.getcomeback
BRANCH=nouvelle-grille-tarifaire

echo "== 1/5 Préparation de l'app"
cd /root
rm -rf /tmp/cb-grille "$NEXT"
[ -e "$BACKUP" ] && { echo "Le dossier $BACKUP existe déjà : arrêt (lancement déjà fait ?)"; exit 1; }
git clone -q --depth 1 -b "$BRANCH" https://github.com/arsnplp/combeckapp.git /tmp/cb-grille
rsync -a --exclude .next "$APP/" "$NEXT/"
rsync -a --exclude .env.local --exclude data/ --exclude node_modules --exclude .git \
  --exclude .next --exclude tsconfig.tsbuildinfo --exclude certificates /tmp/cb-grille/ "$NEXT/"

echo "== 2/5 Création des prix Stripe"
cd "$NEXT"
set -a; . ./.env.local; set +a
node scripts/pricing-2026-10/create-prices.mjs --apply | tee /root/grille-prix.log
grep -E '^STRIPE_PRICE_(PRO|BUSINESS)_(MONTHLY|ANNUAL)=price_[A-Za-z0-9]+,price_' /root/grille-prix.log > /root/grille-lignes.env
if [ "$(wc -l < /root/grille-lignes.env)" -ne 4 ]; then
  echo "Les 4 lignes de prix n'ont pas été trouvées : arrêt, la prod n'a pas bougé."; exit 1
fi
cp "$APP/.env.local" /root/env.local.avant-grille
while IFS= read -r line; do
  key="${line%%=*}"
  sed -i "s|^${key}=.*|${line}|" .env.local
done < /root/grille-lignes.env
echo "Nouvelles lignes dans le .env.local :"; grep '^STRIPE_PRICE_' .env.local

echo "== 3/5 Build et bascule de l'app"
npm run build
cd /root
mv "$APP" "$BACKUP"
mv "$NEXT" "$APP"
rsync -a "$BACKUP/data/" "$APP/data/" 2>/dev/null || true
cd "$APP" && pm2 restart comeback-app --update-env

echo "== 4/5 Site et landing"
git config --global --add safe.directory "$SITE" || true
git config --global --add safe.directory "$LANDING" || true
cd "$SITE"
git stash -q || true
git fetch -q origin && git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH"
npm ci --no-audit --no-fund && npm run build
pm2 restart comeback-site --update-env
cd "$LANDING"
git stash -q || true
git fetch -q origin && git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH"
npm ci --no-audit --no-fund && npm run build

echo "== 5/5 Simulation de la migration Business (rien n'est modifié)"
cd "$APP"
set -a; . ./.env.local; set +a
node scripts/pricing-2026-10/migrate-business.mjs | tee /root/grille-migration-simulation.log

echo
echo "GRILLE OK"
