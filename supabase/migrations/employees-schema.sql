-- ═══════════════════════════════════════════════════════════════════
-- COMPTES EMPLOYÉS — à exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════
-- Modèle : un employé a UN compte global (son email, son mot de passe à lui),
-- et peut être rattaché à PLUSIEURS commerces. Chaque commerce lui définit un
-- mot de passe d'accès distinct. L'employé voit ses commerces, en choisit un,
-- saisit le mot de passe donné par ce commerçant, et accède au scan.
--
-- Séparation volontaire des deux mots de passe :
--   - employees.password_hash        → l'employé seul le connaît (son compte)
--   - employee_merchants.access_...  → défini et connu par le commerçant
-- Un commerçant ne peut donc JAMAIS prendre le contrôle du compte d'un employé
-- ni atteindre les autres commerces où il travaille.

-- Compte global de l'employé (indépendant des comptes marchand/client/affilié)
CREATE TABLE IF NOT EXISTS employees (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rattachement employé ⇄ commerce, avec le mot de passe défini par le commerçant
CREATE TABLE IF NOT EXISTS employee_merchants (
  id                   TEXT PRIMARY KEY,
  employee_id          TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  merchant_id          TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  access_password_hash TEXT NOT NULL,
  display_name         TEXT NOT NULL DEFAULT '',  -- nom affiché côté commerçant
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at       TIMESTAMPTZ,
  -- Un employé ne peut être rattaché qu'une fois au même commerce
  UNIQUE (employee_id, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_merchants_merchant ON employee_merchants(merchant_id);
CREATE INDEX IF NOT EXISTS idx_emp_merchants_employee ON employee_merchants(employee_id);

-- Sessions employé — même modèle que client_sessions (cookie opaque en base).
-- `unlocked_*` mémorise le commerce déverrouillé : le mot de passe d'accès est
-- saisi une fois par service, pas à chaque scan. Révocable côté serveur : si le
-- commerçant retire l'employé, l'accès tombe immédiatement.
CREATE TABLE IF NOT EXISTS employee_sessions (
  token                TEXT PRIMARY KEY,
  employee_email       TEXT NOT NULL,
  unlocked_merchant_id TEXT,
  unlocked_until       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_sessions_email ON employee_sessions(employee_email);

-- ── Traçabilité ────────────────────────────────────────────────────
-- Qui a crédité ? La table activities existe déjà mais n'était jamais
-- alimentée côté serveur (le journal vivait dans le navigateur du
-- commerçant). On y ajoute l'auteur de chaque action.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'merchant';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_id   TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_activities_merchant_created ON activities(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(merchant_id, actor_id);
