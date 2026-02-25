-- Migration 018: Standalone batches table with template-based creation
-- Supports one_to_one, one_to_three, one_to_many, and custom batch types
-- Each batch has students, a teacher, parents (auto-linked), and a coordinator

CREATE TABLE IF NOT EXISTS batches (
  batch_id            TEXT        PRIMARY KEY DEFAULT 'batch_' || substr(gen_random_uuid()::text, 1, 12),
  batch_name          TEXT        NOT NULL,
  batch_type          TEXT        NOT NULL DEFAULT 'one_to_many'
                      CHECK (batch_type IN ('one_to_one', 'one_to_three', 'one_to_many', 'custom')),

  -- Academic info
  subject             TEXT,
  grade               TEXT,
  board               TEXT,

  -- People assignments
  teacher_email       TEXT,
  coordinator_email   TEXT,

  -- Limits & config
  max_students        INTEGER     NOT NULL DEFAULT 50,
  status              TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'archived')),
  notes               TEXT,

  -- Audit
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Batch students — links students to batches
CREATE TABLE IF NOT EXISTS batch_students (
  id                  SERIAL      PRIMARY KEY,
  batch_id            TEXT        NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  student_email       TEXT        NOT NULL,
  parent_email        TEXT,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, student_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batches_status       ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_type          ON batches(batch_type);
CREATE INDEX IF NOT EXISTS idx_batches_teacher       ON batches(teacher_email);
CREATE INDEX IF NOT EXISTS idx_batches_coordinator   ON batches(coordinator_email);
CREATE INDEX IF NOT EXISTS idx_batch_students_batch  ON batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student ON batch_students(student_email);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
