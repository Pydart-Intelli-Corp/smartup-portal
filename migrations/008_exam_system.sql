-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 008: Exam System
-- Tables: exams, exam_questions, exam_batch_assignments,
--         exam_attempts, exam_answers
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Skip if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '008_exam_system.sql') THEN
    RAISE EXCEPTION 'Migration 008_exam_system.sql already applied — skipping';
  END IF;
END $$;

-- ── exams — Exam definition ─────────────────────────────────
CREATE TABLE exams (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  subject           TEXT        NOT NULL,
  grade             TEXT        NOT NULL,
  exam_type         TEXT        NOT NULL DEFAULT 'online',
  duration_minutes  INTEGER     NOT NULL,
  passing_marks     INTEGER     NOT NULL DEFAULT 0,
  total_marks       INTEGER     NOT NULL DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  published         BOOLEAN     DEFAULT false,
  results_published BOOLEAN     DEFAULT false,
  created_by        TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_exam_type CHECK (exam_type IN ('online', 'offline')),
  CONSTRAINT chk_exam_duration CHECK (duration_minutes > 0),
  CONSTRAINT chk_exam_marks CHECK (total_marks >= 0 AND passing_marks >= 0)
);

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── exam_questions — Question bank ──────────────────────────
CREATE TABLE exam_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID        REFERENCES exams(id) ON DELETE SET NULL,
  question_text   TEXT        NOT NULL,
  question_type   TEXT        NOT NULL DEFAULT 'mcq',
  options         JSONB,
  correct_answer  INTEGER,
  marks           INTEGER     NOT NULL DEFAULT 1,
  difficulty      TEXT        DEFAULT 'medium',
  topic           TEXT,
  subject         TEXT,
  grade           TEXT,
  sort_order      INTEGER     DEFAULT 0,
  created_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_q_type CHECK (question_type IN ('mcq', 'descriptive')),
  CONSTRAINT chk_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

-- ── exam_batch_assignments — Which batches take this exam ───
CREATE TABLE exam_batch_assignments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id   UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  room_id   TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT uq_exam_batch UNIQUE (exam_id, room_id)
);

-- ── exam_attempts — Student exam session ────────────────────
CREATE TABLE exam_attempts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID        NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_email   TEXT        NOT NULL,
  student_name    TEXT        NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  score           INTEGER,
  total_marks     INTEGER,
  percentage      NUMERIC(5,2),
  grade_letter    TEXT,
  status          TEXT        NOT NULL DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_attempt_status CHECK (status IN ('in_progress', 'submitted', 'graded', 'expired')),
  CONSTRAINT uq_exam_student UNIQUE (exam_id, student_email)
);

-- ── exam_answers — Per-question response ────────────────────
CREATE TABLE exam_answers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID        NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option INTEGER,
  text_answer     TEXT,
  is_correct      BOOLEAN,
  marks_awarded   INTEGER     DEFAULT 0,

  CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_exams_subject_grade ON exams(subject, grade);
CREATE INDEX idx_exams_created_by ON exams(created_by);
CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_subject ON exam_questions(subject, grade);
CREATE INDEX idx_exam_attempts_student ON exam_attempts(student_email);
CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_answers_attempt ON exam_answers(attempt_id);

INSERT INTO _migrations (filename) VALUES ('008_exam_system.sql');

COMMIT;
