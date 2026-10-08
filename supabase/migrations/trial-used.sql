-- ═══════════════════════════════════════════════════════════════════
-- Mémorise qu'un commerçant a consommé son essai gratuit de 30 jours.
-- À exécuter dans le SQL Editor Supabase (préprod puis production).
-- ═══════════════════════════════════════════════════════════════════
--
-- Jusqu'ici rien ne traçait l'essai : il se déduisait de `plan = 'free'`
-- + `plan_expires_at`, deux champs écrasés dès que le commerçant choisit
-- un plan. Impossible donc de savoir s'il y avait déjà eu droit.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Fin de l'essai, distincte de `plan_expires_at`. Sans elle, impossible de
-- différencier un essai Business en cours d'un abonnement Business payant :
-- les deux portent le même plan et une échéance dans le futur.
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- La colonne que le cron de relance d'essai lit déjà sans qu'elle existe
-- (il a un repli, mais du coup il ne mémorise pas les rappels envoyés et
-- peut les renvoyer).
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS trial_reminders JSONB;

-- Reprise de l'existant : tout commerçant qui a (ou a eu) un essai est
-- marqué comme l'ayant consommé. On se base sur la seule trace restante,
-- `plan_expires_at` posé alors que le plan est l'essai gratuit.
--
-- Les comptes passés sur Starter sans trace d'essai restent à NULL : on
-- leur laisse le bénéfice du doute, ce qui est aussi une occasion de
-- conversion puisque l'essai demande désormais une carte.
UPDATE merchants
   SET trial_used_at = COALESCE(plan_expires_at, created_at),
       trial_ends_at = plan_expires_at
 WHERE trial_used_at IS NULL
   AND plan = 'free'
   AND plan_expires_at IS NOT NULL;

-- Les abonnés payants ont forcément eu leur essai avant de souscrire.
UPDATE merchants
   SET trial_used_at = created_at
 WHERE trial_used_at IS NULL
   AND plan IN ('pro', 'business');
