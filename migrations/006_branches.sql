-- ═══════════════════════════════════════════════════════════════
-- Migration 006 — Branches + Branch Manager Role
-- ═══════════════════════════════════════════════════════════════
-- Adds the branches table and branch_manager portal role.
-- A Branch is a physical center/location where classes run.
-- Branch Manager oversees all classes, batches, teachers and
-- students assigned to their branch.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Update portal_role constraint to allow 'branch_manager' ──
ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS chk_portal_role;

ALTER TABLE portal_users
  ADD CONSTRAINT chk_portal_role CHECK (
    portal_role IN (
      'teacher', 'student', 'coordinator', 'academic_operator',
      'hr', 'branch_manager', 'academic', 'parent', 'owner', 'ghost'
    )
  );

-- ── 2. Create branches table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  branch_id           TEXT        PRIMARY KEY DEFAULT 'BR-' || substr(gen_random_uuid()::text, 1, 8),
  branch_name         TEXT        NOT NULL,
  branch_code         TEXT        NOT NULL UNIQUE,                   -- short code e.g. 'MUM-01'
  address             TEXT,
  city                TEXT,
  state               TEXT,
  phone               TEXT,
  email               TEXT,
  manager_email       TEXT        REFERENCES portal_users(email),    -- branch_manager FK
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  max_rooms           INTEGER     DEFAULT 20,                        -- capacity: max concurrent rooms
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_branches_active   ON branches (is_active) WHERE is_active = true;
CREATE INDEX idx_branches_manager  ON branches (manager_email) WHERE manager_email IS NOT NULL;
CREATE INDEX idx_branches_city     ON branches (city);

-- ── 3. Add branch_id FK to rooms (optional link) ───────────────
-- MANUAL STEP: The smartup user does not own the rooms table.
-- Run the following as the table owner (e.g. postgres) later:
--   ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(branch_id);
--   CREATE INDEX IF NOT EXISTS idx_rooms_branch ON rooms (branch_id) WHERE branch_id IS NOT NULL;

-- ── 4. Add branch_id to portal_users (which branch a user belongs to)
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(branch_id);

CREATE INDEX IF NOT EXISTS idx_portal_users_branch ON portal_users (branch_id) WHERE branch_id IS NOT NULL;

-- Record migration
INSERT INTO _migrations (filename) VALUES ('006_branches.sql');

COMMIT;
