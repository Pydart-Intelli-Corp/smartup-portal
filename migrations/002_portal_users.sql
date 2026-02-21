-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 002: Portal Users
-- Stores user profiles for authentication and access control.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '002_portal_users.sql') THEN
    RAISE EXCEPTION 'Migration 002_portal_users.sql already applied — skipping';
  END IF;
END $$;

-- ── portal_users ────────────────────────────────────────────
-- User accounts for portal authentication and access control.

CREATE TABLE IF NOT EXISTS portal_users (
  email               TEXT        PRIMARY KEY,
  full_name           TEXT        NOT NULL,
  portal_role         TEXT        NOT NULL,
  frappe_role         TEXT        NOT NULL,
  phone               TEXT,
  profile_image       TEXT,
  batch_ids           TEXT[]      DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at       TIMESTAMPTZ,
  frappe_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_portal_role CHECK (
    portal_role IN ('teacher', 'student', 'coordinator', 'academic', 'parent', 'owner', 'ghost')
  )
);

CREATE TRIGGER trg_portal_users_updated_at
  BEFORE UPDATE ON portal_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_portal_users_role     ON portal_users (portal_role);
CREATE INDEX idx_portal_users_active   ON portal_users (is_active) WHERE is_active = true;
CREATE INDEX idx_portal_users_batch    ON portal_users USING GIN (batch_ids);

-- Record migration
INSERT INTO _migrations (filename) VALUES ('002_portal_users.sql');

COMMIT;
