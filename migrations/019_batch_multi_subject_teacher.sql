-- Migration 019: Multi-subject, multi-teacher batch system
-- Batches now represent real class sections (e.g., Class 10 A)
-- Each batch can have multiple subjects, each with its own teacher

-- Add section column for class sections (A, B, C, etc.)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS section TEXT;

-- Convert subject TEXT → subjects TEXT[] for multi-subject support
ALTER TABLE batches ADD COLUMN IF NOT EXISTS subjects TEXT[];

-- Copy existing subject data into subjects array if it exists
UPDATE batches SET subjects = ARRAY[subject] WHERE subject IS NOT NULL AND subjects IS NULL;

-- We keep `subject` column for backward compat but it's deprecated
-- New code uses `subjects TEXT[]`

-- Batch teachers — maps each subject to a teacher within a batch
CREATE TABLE IF NOT EXISTS batch_teachers (
  id                  SERIAL      PRIMARY KEY,
  batch_id            TEXT        NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  teacher_email       TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, subject)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batch_teachers_batch   ON batch_teachers(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_teachers_teacher  ON batch_teachers(teacher_email);
CREATE INDEX IF NOT EXISTS idx_batches_section         ON batches(section);
CREATE INDEX IF NOT EXISTS idx_batches_subjects        ON batches USING GIN(subjects);
