-- ═══════════════════════════════════════════════════════════════════
-- SCHÉMA COMPLET — à exécuter UNE FOIS dans le SQL Editor du NOUVEAU
-- projet Supabase (celui de test). Ne jamais l'exécuter sur la prod.
-- ═══════════════════════════════════════════════════════════════════
-- Reconstruit à partir du schéma de production. Les tables affiliés et
-- employés ne sont pas ici : leurs fichiers de migration existent déjà
-- (affiliate-schema.sql et employees-schema.sql) et sont à passer ensuite.

-- ── Socle ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchants (
  id                       TEXT PRIMARY KEY,
  email                    TEXT NOT NULL,
  password_hash            TEXT NOT NULL DEFAULT '',
  password_plain           TEXT,
  google_id                TEXT,
  store_name               TEXT NOT NULL DEFAULT '',
  city                     TEXT NOT NULL DEFAULT '',
  plan                     TEXT NOT NULL DEFAULT 'starter',
  logo_url                 TEXT,
  email_verified           BOOLEAN NOT NULL DEFAULT false,
  is_admin                 BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  address                  TEXT NOT NULL DEFAULT '',
  phone                    TEXT NOT NULL DEFAULT '',
  website                  TEXT NOT NULL DEFAULT '',
  settings                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  wallet_config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_verification_token TEXT,
  onboarding_needed        BOOLEAN NOT NULL DEFAULT false,
  plan_expires_at          TIMESTAMPTZ,
  stripe_customer_id       VARCHAR,
  affiliate_code           TEXT
);
-- Unicité d'email insensible à la casse (comme en production)
CREATE UNIQUE INDEX IF NOT EXISTS merchants_email_key ON merchants (lower(email));

CREATE TABLE IF NOT EXISTS clients (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL DEFAULT '',
  password_plain TEXT,
  name           TEXT NOT NULL DEFAULT '',
  google_id      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_key ON clients (lower(email));

CREATE TABLE IF NOT EXISTS folders (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id                  TEXT PRIMARY KEY,
  merchant_id         TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT '',
  loyalty_mode        TEXT NOT NULL DEFAULT 'stamps',
  stamps_required     INTEGER NOT NULL DEFAULT 8,
  points_per_euro     INTEGER NOT NULL DEFAULT 10,
  welcome_points      INTEGER NOT NULL DEFAULT 0,
  welcome_message     TEXT NOT NULL DEFAULT '',
  background_color    TEXT NOT NULL DEFAULT '#1e293b',
  accent_color        TEXT NOT NULL DEFAULT '#16a34a',
  text_color          TEXT NOT NULL DEFAULT '#ffffff',
  referral_enabled    BOOLEAN NOT NULL DEFAULT false,
  referral_bonus      INTEGER NOT NULL DEFAULT 1,
  referral_bonus_type TEXT NOT NULL DEFAULT 'stamps',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  rank_thresholds     JSONB NOT NULL DEFAULT '{"silver":2,"gold":5,"platine":10}'::jsonb,
  active              BOOLEAN NOT NULL DEFAULT true,
  referred_bonus      INTEGER NOT NULL DEFAULT 0,
  strip_preset        VARCHAR
);

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  merchant_id   TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id     TEXT REFERENCES clients(id) ON DELETE SET NULL,
  folder_id     TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  total_visits  INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  join_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_spent   NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_customers_merchant ON customers(merchant_id);

CREATE TABLE IF NOT EXISTS customer_cards (
  id              TEXT PRIMARY KEY,
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  card_id         TEXT NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  stamps          INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 0,
  referral_count  INTEGER NOT NULL DEFAULT 0,
  referral_points INTEGER NOT NULL DEFAULT 0,
  join_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_cards_merchant ON customer_cards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_cards_customer ON customer_cards(customer_id);

-- ── Fidélité ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  emoji       TEXT NOT NULL DEFAULT '🎁',
  cost        INTEGER NOT NULL DEFAULT 0,
  mode        TEXT NOT NULL DEFAULT 'stamps',
  is_referral BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  price        NUMERIC NOT NULL DEFAULT 0,
  emoji        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  active       BOOLEAN NOT NULL DEFAULT true,
  points_value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS redemptions (
  id               TEXT PRIMARY KEY,
  merchant_id      TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_card_id TEXT REFERENCES customer_cards(id) ON DELETE SET NULL,
  reward_name      TEXT NOT NULL DEFAULT '',
  reward_emoji     TEXT NOT NULL DEFAULT '',
  cost             INTEGER NOT NULL DEFAULT 0,
  cost_type        TEXT NOT NULL DEFAULT 'stamps',
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redemption_tokens (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id                   TEXT PRIMARY KEY,
  merchant_id          TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  referrer_card_id     TEXT NOT NULL REFERENCES customer_cards(id) ON DELETE CASCADE,
  referred_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  credited             BOOLEAN NOT NULL DEFAULT false,
  referred_email       TEXT NOT NULL DEFAULT ''
);

-- ── Journal d'activité (avec l'auteur de chaque action) ────────────
CREATE TABLE IF NOT EXISTS activities (
  id               TEXT PRIMARY KEY,
  merchant_id      TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id      TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_card_id TEXT REFERENCES customer_cards(id) ON DELETE SET NULL,
  type             TEXT NOT NULL DEFAULT 'visit',
  amount           INTEGER NOT NULL DEFAULT 0,
  label            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type       TEXT NOT NULL DEFAULT 'merchant',
  actor_id         TEXT,
  actor_name       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_activities_merchant_created ON activities(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(merchant_id, actor_id);

-- ── Notifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  message     TEXT NOT NULL DEFAULT '',
  target      TEXT NOT NULL DEFAULT 'all',
  sent_count  INTEGER NOT NULL DEFAULT 0,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_notifications (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  message      TEXT NOT NULL DEFAULT '',
  frequency    TEXT NOT NULL DEFAULT 'weekly',
  day_of_week  INTEGER,
  day_of_month INTEGER,
  hour         INTEGER NOT NULL DEFAULT 10,
  active       BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_usage (
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (merchant_id, month)
);

-- ── Sessions et jetons ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_sessions (
  token        TEXT PRIMARY KEY,
  client_email TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_sessions_email ON client_sessions(client_email);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token      TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Wallet ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_passes (
  serial_number        TEXT PRIMARY KEY,
  customer_card_id     TEXT REFERENCES customer_cards(id) ON DELETE SET NULL,
  auth_token           TEXT NOT NULL DEFAULT '',
  campaign_message     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  id                   TEXT,
  customer_id          TEXT,
  pass_type_identifier TEXT NOT NULL DEFAULT '',
  pass_data            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS wallet_registrations (
  id                TEXT PRIMARY KEY,
  device_library_id TEXT NOT NULL,
  push_token        TEXT NOT NULL,
  serial_number     TEXT NOT NULL REFERENCES wallet_passes(serial_number) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  pass_id           TEXT
);

-- ── Support et supervision ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id               TEXT PRIMARY KEY,
  merchant_id      TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sender           TEXT NOT NULL DEFAULT 'merchant',
  body             TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by_admin    BOOLEAN NOT NULL DEFAULT false,
  read_by_merchant BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS system_errors (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved   BOOLEAN NOT NULL DEFAULT false
);
