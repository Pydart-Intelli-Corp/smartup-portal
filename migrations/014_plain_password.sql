-- ═══════════════════════════════════════════════════════════════
-- Migration 014 — Add plain_password column for admin visibility
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS plain_password TEXT DEFAULT NULL;

-- Backfill existing seeded users with default password
UPDATE portal_users
  SET plain_password = 'Test@1234'
  WHERE password_hash IS NOT NULL AND plain_password IS NULL;

INSERT INTO _migrations (filename) VALUES ('014_plain_password.sql');

COMMIT;
