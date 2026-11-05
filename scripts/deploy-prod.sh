#!/usr/bin/env bash
# Met en ligne la dernière version de master sur app.getcomeback.fr.
# À lancer en root sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/arsnplp/combeckapp/master/scripts/deploy-prod.sh | bash
#
# 1. Construit la nouvelle version À CÔTÉ de celle en ligne (intacte).
# 2. Bascule seulement si le build réussit ; l'ancienne version est gardée.
# 3. Si l'app ne répond pas après la bascule, retour automatique à l'ancienne.
set -euo pipefail

APP=/var/www/getcomeback-app
PM2=comeback-app
URL=https://app.getcomeback.fr
STAMP=$(date +%Y%m%d-%H%M%S)
NEXT="${APP}-next"
BACKUP="${APP}-avant-${STAMP}"
SRC=/tmp/cb-deploy

echo "== 1/3 Récupération de master"
rm -rf "$SRC" "$NEXT"
git clone -q --depth 1 -b master https://github.com/arsnplp/combeckapp.git "$SRC"
rsync -a --exclude .next "$APP/" "$NEXT/"
rsync -a --exclude .env.local --exclude data/ --exclude node_modules --exclude .git \
  --exclude .next --exclude tsconfig.tsbuildinfo --exclude certificates "$SRC/" "$NEXT/"

echo "== 2/3 Build (le site en ligne n'est pas touché)"
cd "$NEXT"
npm install --no-audit --no-fund
npm run build

echo "== 3/3 Bascule"
cd /root
mv "$APP" "$BACKUP"
mv "$NEXT" "$APP"
rsync -a "$BACKUP/data/" "$APP/data/" 2>/dev/null || true
cd "$APP" && pm2 restart "$PM2" --update-env
sleep 5
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/login")
if [ "$CODE" != "200" ]; then
  echo "!! $URL/login répond $CODE : retour à l'ancienne version"
  cd /root
  mv "$APP" "${APP}-echec-${STAMP}"
  mv "$BACKUP" "$APP"
  cd "$APP" && pm2 restart "$PM2" --update-env
  exit 1
fi
echo "OK : $URL/login → HTTP $CODE (ancienne version gardée dans $BACKUP)"
