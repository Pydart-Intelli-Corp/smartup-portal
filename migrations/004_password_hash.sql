-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 004: Add password_hash to portal_users
-- Enables direct PostgreSQL-based authentication.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '004_password_hash.sql') THEN
    RAISE EXCEPTION 'Migration 004_password_hash.sql already applied — skipping';
  END IF;
END $$;

-- Add password_hash column (nullable: set explicitly via seed or admin)
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;

-- Make frappe_role nullable (will be dropped in migration 005)
ALTER TABLE portal_users
  ALTER COLUMN frappe_role DROP NOT NULL,
  ALTER COLUMN frappe_role SET DEFAULT '';

-- Record migration
INSERT INTO _migrations (filename) VALUES ('004_password_hash.sql');

COMMIT;
