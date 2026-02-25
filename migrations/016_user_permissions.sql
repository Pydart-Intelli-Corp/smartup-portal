-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 016: User Permissions
-- Adds custom_permissions JSONB column to portal_users
-- for fine-grained per-user permission overrides.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '016_user_permissions.sql') THEN
    RAISE EXCEPTION 'Migration 016_user_permissions.sql already applied — skipping';
  END IF;
END $$;

-- Add custom_permissions column
-- Stores per-user permission overrides as JSONB.
-- Example: {"salary_view": false, "reports_view": true}
-- Empty {} means "use all role defaults" — no custom overrides.
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '{}';

-- Index for querying users with custom permissions
CREATE INDEX idx_portal_users_custom_perms
  ON portal_users USING GIN (custom_permissions)
  WHERE custom_permissions != '{}';

-- Record migration
INSERT INTO _migrations (filename) VALUES ('016_user_permissions.sql');

COMMIT;
