-- Migration 019: Multi-subject/teacher batches + cancellation requests
-- 1. Alter batches: subject → subjects[], add section, drop teacher_email
-- 2. Create batch_teachers junction table
-- 3. Create cancellation_requests table

-- ── 1. Alter batches table ──────────────────────────────────

-- Add subjects array column (replaces single subject)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS subjects TEXT[];

-- Migrate existing single subject data into array
UPDATE batches SET subjects = ARRAY[subject] WHERE subject IS NOT NULL AND subjects IS NULL;

-- Add section column
ALTER TABLE batches ADD COLUMN IF NOT EXISTS section TEXT;

-- Drop old single-value columns
ALTER TABLE batches DROP COLUMN IF EXISTS subject;
ALTER TABLE batches DROP COLUMN IF EXISTS teacher_email;

-- Drop old index on teacher_email if it exists
DROP INDEX IF EXISTS idx_batches_teacher;

-- ── 2. Create batch_teachers table ──────────────────────────

CREATE TABLE IF NOT EXISTS batch_teachers (
  id                SERIAL      PRIMARY KEY,
  batch_id          TEXT        NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  teacher_email     TEXT        NOT NULL,
  subject           TEXT        NOT NULL,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_batch_teachers_batch   ON batch_teachers(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_teachers_teacher ON batch_teachers(teacher_email);

-- ── 3. Create cancellation_requests table ───────────────────

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id                    SERIAL      PRIMARY KEY,
  room_id               TEXT        NOT NULL,
  requested_by          TEXT        NOT NULL,
  requester_role        TEXT,
  reason                TEXT,
  cancellation_type     TEXT        NOT NULL DEFAULT 'parent_initiated'
                        CHECK (cancellation_type IN ('parent_initiated', 'group_request', 'teacher_initiated', 'policy')),

  -- Multi-level approval chain status
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'coordinator_approved', 'admin_approved', 'academic_approved', 'hr_approved', 'approved', 'rejected')),

  -- Coordinator level
  coordinator_decision  TEXT,
  coordinator_email     TEXT,
  coordinator_at        TIMESTAMPTZ,

  -- Admin level
  admin_decision        TEXT,
  admin_email           TEXT,
  admin_at              TIMESTAMPTZ,

  -- Academic level
  academic_decision     TEXT,
  academic_email        TEXT,
  academic_at           TIMESTAMPTZ,

  -- HR level
  hr_decision           TEXT,
  hr_email              TEXT,
  hr_at                 TIMESTAMPTZ,

  -- Rejection
  rejection_reason      TEXT,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancel_req_room   ON cancellation_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_cancel_req_status ON cancellation_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancel_req_by     ON cancellation_requests(requested_by);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER trg_cancellation_requests_updated_at
  BEFORE UPDATE ON cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
