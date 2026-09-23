#!/bin/bash
# Lance l'app en local sur http://localhost:3100, branchée sur la base de
# PRÉPRODUCTION — jamais sur les données des vrais commerçants.
#
# Next.js ne réécrit pas une variable déjà présente dans l'environnement : les
# valeurs exportées ici l'emportent donc sur celles de .env.local, qui pointe
# vers la production.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.preprod ]; then
  echo "❌ .env.preprod manquant (identifiants de la base de test)." >&2
  exit 1
fi
set -a; source .env.preprod; set +a

# Garde-fou : refuser de démarrer si on pointe sur la production.
case "$SUPABASE_URL" in
  *xpstwccszmxzjnlsyksm*) : ;;
  *) echo "❌ SUPABASE_URL ne pointe pas sur la préprod — arrêt." >&2; exit 1 ;;
esac

# Clés capables d'atteindre de vraies personnes : vidées. `getStripe()` et les
# générateurs de pass testent la présence de la clé, une chaîne vide les
# désactive proprement.
export APPLE_P12_PATH=""
export APPLE_P12_PASSWORD=""
export APPLE_PASS_TYPE_ID=""
export APPLE_TEAM_ID=""
export RESEND_API_KEY=""
export STRIPE_SECRET_KEY=""
export GOOGLE_WALLET_CLIENT_EMAIL=""
export GOOGLE_WALLET_PRIVATE_KEY=""

export AUTH_URL="http://localhost:3100"
export NEXTAUTH_URL="http://localhost:3100"
export NEXT_PUBLIC_APP_URL="http://localhost:3100"
export WALLET_WEB_SERVICE_URL="http://localhost:3100/api/wallet"

echo "→ base    : ${SUPABASE_URL}  (préproduction)"
echo "→ désactivés : Stripe, Apple Wallet, Google Wallet, Resend"
echo "→ http://localhost:3100"
exec npx next dev -p 3100
