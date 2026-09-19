#!/bin/bash
# Envoie le code local vers l'environnement de TEST (test.getcomeback.fr).
# Ne touche jamais la production : dossier, port, processus PM2 et base
# de donnees sont tous distincts.
set -e

VPS="root@217.65.144.174"
KEY="$HOME/.ssh/vps1_ed25519"
DEST="/var/www/getcomeback-staging"

echo "→ Copie du code vers le STAGING ($DEST)"
rsync -az -e "ssh -i $KEY" \
  --exclude '.env.local' --exclude 'data/' --exclude 'node_modules' \
  --exclude '.git' --exclude '.next' --exclude 'tsconfig.tsbuildinfo' \
  --exclude 'certificates' \
  ./ "$VPS:$DEST/"

echo "→ Compilation sur le serveur"
ssh -i "$KEY" "$VPS" "cd $DEST && npm run build"

echo "→ Redemarrage du staging"
ssh -i "$KEY" "$VPS" "pm2 restart comeback-staging --update-env"

sleep 4
CODE=$(curl -s -o /dev/null -w "%{http_code}" https://test.getcomeback.fr/login)
echo "→ https://test.getcomeback.fr/login → HTTP $CODE"
[ "$CODE" = "200" ] && echo "✅ Staging a jour" || { echo "❌ Le staging ne repond pas"; exit 1; }
