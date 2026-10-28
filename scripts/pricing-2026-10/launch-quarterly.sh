#!/usr/bin/env bash
# Mise en ligne de l'abonnement trimestriel (Pro 39,99 €, Business 79,99 €).
# À lancer en root sur le VPS :
#   bash launch-quarterly.sh staging   # test.getcomeback.fr, Stripe en mode test
#   bash launch-quarterly.sh prod      # app.getcomeback.fr, Stripe live
#
# 1. Prépare la nouvelle version de l'app à côté de celle en ligne (intacte).
# 2. Crée les 2 prix trimestriels dans le Stripe de cet environnement et
#    ajoute leurs IDs au .env.local (rien n'est modifié sur les prix existants).
# 3. Build, puis bascule (l'ancienne version est gardée en sauvegarde).
# 4. En prod seulement : met en ligne le site avec le sélecteur de période.
#
# Si une étape échoue avant la bascule, rien n'a changé en ligne.
set -euo pipefail

TARGET="${1:-}"
case "$TARGET" in
  staging) APP=/var/www/getcomeback-staging; PM2=comeback-staging; URL=https://test.getcomeback.fr ;;
  prod)    APP=/var/www/getcomeback-app;     PM2=comeback-app;     URL=https://app.getcomeback.fr ;;
  *) echo "Usage : bash launch-quarterly.sh staging|prod"; exit 1 ;;
esac
NEXT="${APP}-trimestre"
BACKUP="${APP}-avant-trimestre"
BRANCH=master

echo "== 1/3 Préparation ($TARGET)"
cd /root
[ -e "$BACKUP" ] && { echo "Le dossier $BACKUP existe déjà : arrêt (déjà lancé ?)"; exit 1; }
rm -rf /tmp/cb-trimestre "$NEXT"
git clone -q --depth 1 -b "$BRANCH" https://github.com/arsnplp/combeckapp.git /tmp/cb-trimestre
rsync -a --exclude .next "$APP/" "$NEXT/"
rsync -a --exclude .env.local --exclude data/ --exclude node_modules --exclude .git \
  --exclude .next --exclude tsconfig.tsbuildinfo --exclude certificates /tmp/cb-trimestre/ "$NEXT/"

echo "== 2/3 Prix trimestriels Stripe"
cd "$NEXT"
eval "$(node scripts/pricing-2026-10/stripe-env.mjs .env.local)"
node scripts/pricing-2026-10/create-quarterly-prices.mjs --apply | tee "/root/trimestre-$TARGET.log"
grep -E '^STRIPE_PRICE_(PRO|BUSINESS)_QUARTERLY=price_[A-Za-z0-9]+$' "/root/trimestre-$TARGET.log" > "/root/trimestre-$TARGET.env"
if [ "$(wc -l < "/root/trimestre-$TARGET.env")" -ne 2 ]; then
  echo "Les 2 lignes de prix n'ont pas été trouvées : arrêt, rien n'a changé en ligne."; exit 1
fi
cp .env.local "/root/env.local.$TARGET.avant-trimestre"
while IFS= read -r line; do
  key="${line%%=*}"
  if grep -q "^${key}=" .env.local; then
    sed -i "s|^${key}=.*|${line}|" .env.local
  else
    printf '\n%s\n' "$line" >> .env.local
  fi
done < "/root/trimestre-$TARGET.env"
echo "Prix dans le .env.local :"; grep '^STRIPE_PRICE_' .env.local

echo "== 3/3 Build et bascule"
npm run build
cd /root
mv "$APP" "$BACKUP"
mv "$NEXT" "$APP"
rsync -a "$BACKUP/data/" "$APP/data/" 2>/dev/null || true
cd "$APP" && pm2 restart "$PM2" --update-env
sleep 4
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/login")
echo "$URL/login → HTTP $CODE"

# Staging : auto-test Stripe (mode test) de l'essai, du passage sur Pro pendant
# l'essai et de Pro payé. N'arrête rien en cas d'échec : il le signale.
if [ "$TARGET" = "staging" ]; then
  echo "== Auto-test Stripe (mode test)"
  cd "$APP"
  eval "$(node scripts/pricing-2026-10/stripe-env.mjs .env.local)"
  node scripts/pricing-2026-10/selftest-trial-switch.mjs || echo "!! Auto-test en échec : envoie-moi ce bloc."
fi

# Site vitrine : le sélecteur de période ne part qu'avec l'app de prod, qui
# sait facturer le trimestriel.
# Construit à côté du site en ligne, puis bascule : un build raté ne coupe
# jamais le site (il reste sur l'ancienne version).
if [ "$TARGET" = "prod" ]; then
  echo "== Site getcomeback.fr (sélecteur de période)"
  SITE=/var/www/getcomeback-site
  SITE_NEXT=/var/www/getcomeback-site-trimestre
  SITE_BACKUP=/var/www/getcomeback-site-avant-trimestre
  if [ -e "$SITE_BACKUP" ]; then
    echo "Le dossier $SITE_BACKUP existe déjà : site non modifié."
  else
    rm -rf "$SITE_NEXT"
    rsync -a "$SITE/" "$SITE_NEXT/"
    git config --global --add safe.directory "$SITE_NEXT" || true
    cd "$SITE_NEXT"
    git stash -q || true
    git fetch -q origin && git checkout -q trimestriel && git pull -q --ff-only origin trimestriel
    if npm ci --no-audit --no-fund && npm run build; then
      cd /root
      mv "$SITE" "$SITE_BACKUP"
      mv "$SITE_NEXT" "$SITE"
      git config --global --add safe.directory "$SITE" || true
      cd "$SITE" && pm2 restart comeback-site --update-env
      sleep 3
      echo "https://getcomeback.fr/tarifs → HTTP $(curl -s -o /dev/null -w "%{http_code}" https://getcomeback.fr/tarifs)"
    else
      echo "!! Build du site en échec : le site en ligne n'a pas bougé."
    fi
  fi
fi
echo
echo "TRIMESTRE OK ($TARGET)"
echo "Retour arrière si besoin : cd /root && mv $APP ${APP}-casse && mv $BACKUP $APP && pm2 restart $PM2 --update-env"
