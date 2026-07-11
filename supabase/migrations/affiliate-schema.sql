-- ═══════════════════════════════════════════════════════════════════
-- SYSTÈME D'AFFILIATION — à exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Comptes affiliés (séparés des comptes marchands et clients)
CREATE TABLE IF NOT EXISTS affiliates (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  commerce TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  referral_code TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze',
  status TEXT NOT NULL DEFAULT 'active',
  suspension_reason TEXT,
  bank_method TEXT,
  bank_details JSONB,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cagnotte
CREATE TABLE IF NOT EXISTS affiliate_wallets (
  affiliate_id TEXT PRIMARY KEY REFERENCES affiliates(id) ON DELETE CASCADE,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  last_withdrawal_date TIMESTAMPTZ
);

-- Clients apportés (marchands parrainés)
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL,
  merchant_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  status TEXT NOT NULL DEFAULT 'active',
  referral_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_payment_date TIMESTAMPTZ,
  last_payment_date TIMESTAMPTZ,
  UNIQUE (affiliate_id, merchant_id)
);

-- Historique de toutes les opérations (audit trail)
CREATE TABLE IF NOT EXISTS affiliate_transactions (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  stripe_payment_intent_id TEXT,
  related_merchant_id TEXT,
  related_withdrawal_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_tx_stripe ON affiliate_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aff_tx_affiliate ON affiliate_transactions(affiliate_id);

-- Demandes de retrait
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_method TEXT NOT NULL,
  bank_details JSONB NOT NULL DEFAULT '{}',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Jobs planifiés (déblocage des commissions à J+18)
CREATE TABLE IF NOT EXISTS affiliate_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  related_tx_id TEXT,
  execute_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_aff_jobs_due ON affiliate_jobs(execute_at) WHERE status = 'pending';

-- Sessions affiliés (cookie opaque, comme les sessions clients)
CREATE TABLE IF NOT EXISTS affiliate_sessions (
  token TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Attribution : code affilié stocké sur le marchand à l'inscription
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

-- RLS activé partout (accès uniquement via service_role, comme le reste)
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_sessions ENABLE ROW LEVEL SECURITY;
