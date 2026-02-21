-- ═══════════════════════════════════════════════════════════════
-- Migration 004 — Add HR Role + User Profiles Table
-- ═══════════════════════════════════════════════════════════════
-- Run: node scripts/run-migration.js 004_add_hr_role_and_profiles.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Update portal_role constraint to allow 'hr' ─────────────
ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS chk_portal_role;

ALTER TABLE portal_users
  ADD CONSTRAINT chk_portal_role CHECK (
    portal_role IN (
      'teacher', 'student', 'coordinator', 'academic_operator',
      'hr', 'academic', 'parent', 'owner', 'ghost'
    )
  );

-- ── 2. Create user_profiles table ─────────────────────────────
-- Extends portal_users with role-specific metadata.
-- HR Associate populates this when creating/editing users.
CREATE TABLE IF NOT EXISTS user_profiles (
  email              TEXT PRIMARY KEY REFERENCES portal_users(email) ON DELETE CASCADE,

  -- Common fields
  phone              TEXT,
  whatsapp           TEXT,
  date_of_birth      DATE,
  address            TEXT,
  qualification      TEXT,         -- Highest degree / qualification
  notes              TEXT,         -- Internal HR notes

  -- Teacher-specific
  subjects           TEXT[],       -- e.g. ['Mathematics', 'Physics']
  experience_years   INTEGER,      -- Years of teaching experience

  -- Student-specific
  grade              TEXT,         -- e.g. 'Class 10'
  section            TEXT,         -- e.g. 'A', 'Morning Batch'
  board              TEXT,         -- e.g. 'CBSE', 'ICSE', 'State'
  parent_email       TEXT,         -- Links to parent's portal_users.email
  admission_date     DATE,

  -- Batch Coordinator-specific
  assigned_region    TEXT,         -- GCC region they oversee

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for parent lookup (find all children of a parent)
CREATE INDEX IF NOT EXISTS idx_user_profiles_parent_email
  ON user_profiles(parent_email)
  WHERE parent_email IS NOT NULL;

-- Index for subject search
CREATE INDEX IF NOT EXISTS idx_user_profiles_subjects
  ON user_profiles USING gin(subjects)
  WHERE subjects IS NOT NULL;

-- ── 3. Auto-update updated_at on user_profiles ─────────────────
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

COMMIT;
