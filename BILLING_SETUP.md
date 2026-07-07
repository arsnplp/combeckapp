# Configuration du système de facturation Stripe

## Étape 1 : Ajouter les variables d'environnement

Ajouter les lignes suivantes à `.env.local` :

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://app.getcomeback.fr
```

**Où trouver :**
- `STRIPE_SECRET_KEY` : Stripe Dashboard → Developers → API Keys → Secret Key
- `STRIPE_WEBHOOK_SECRET` : Stripe Dashboard → Developers → Webhooks → Endpoint créé (voir Étape 2)

## Étape 2 : Configurer le webhook Stripe

1. Aller à **Stripe Dashboard** → **Developers** → **Webhooks**
2. Cliquer sur **Add endpoint**
3. Entrer l'URL : `https://app.getcomeback.fr/api/billing/webhook`
4. Choisir les événements : `checkout.session.completed`
5. Copier le **Signing Secret** vers `STRIPE_WEBHOOK_SECRET` dans `.env.local`

## Étape 3 : Mettre à jour la base de données Supabase

Exécuter le SQL suivant dans **Supabase SQL Editor** :

```sql
-- Add billing columns to merchants table
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for plan expiration lookups
CREATE INDEX IF NOT EXISTS idx_merchants_plan_expires_at ON merchants(plan_expires_at)
  WHERE plan_expires_at IS NOT NULL;
```

## Étape 4 : Mettre en place la cron job pour les expirations

Configurer une tâche cron quotidienne (par exemple avec Vercel Cron ou une autre solution) :

```
GET /api/cron/plan-expiration?secret={CRON_SECRET}
```

Cette route downgrade automatiquement les plans expirés.

## Étape 5 : Déployer

```bash
npm run build
npm run deploy
```

## Flux de paiement

1. **Utilisateur clique sur "Essai gratuit"** → POST `/api/auth/free-trial`
   - Crée un compte avec `plan='free'` et `plan_expires_at=now+90j`

2. **Après 3 mois, utilisateur doit payer** → `/tarifs?plan=X&billing=monthly|annual`
   - Redirige vers le site (gestion côté site)

3. **Utilisateur clique "Payer"** → POST `/api/billing/checkout`
   - Crée Stripe Checkout Session
   - Redirige vers Stripe

4. **Stripe webhook** → POST `/api/billing/webhook`
   - Reçoit `checkout.session.completed`
   - Active le plan pour 30j (mensuel) ou 365j (annuel)
   - Met à jour `plan` et `plan_expires_at`

5. **Quotidienne, cron** → GET `/api/cron/plan-expiration`
   - Downgrade automatiquement les plans expirés de `starter|pro|business` → `free`

## Gestion de l'expiration

- **Plan = `free`, expires_at = future** → Free trial actif (accès complet)
- **Plan = `free`, expires_at = past** → Free trial expiré (accès bloqué)
- **Plan = `starter|pro|business`, expires_at = future** → Plan payant actif
- **Plan = `starter|pro|business`, expires_at = past** → Impossible (cron les downgrade)

Le banneau de plan expiration apparaît automatiquement dans le dashboard si le plan expire dans < 7 jours ou est expiré.

## Tests (sandbox Stripe)

Utiliser les clés de test (pk_test_, sk_test_) :

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

Numéro de carte test : `4242 4242 4242 4242`, expiration future, CVC aléatoire
