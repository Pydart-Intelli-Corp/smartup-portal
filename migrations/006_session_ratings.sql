-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 006: Session Ratings
-- Students/parents can rate teacher sessions after they end
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '006_session_ratings.sql') THEN
    RAISE EXCEPTION 'Migration 006_session_ratings.sql already applied — skipping';
  END IF;
END $$;

-- ── session_ratings ──────────────────────────────────────────
-- One row per student per session. Stores 4 category scores + comment.

CREATE TABLE IF NOT EXISTS session_ratings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        TEXT        NOT NULL,
  student_email     TEXT        NOT NULL,
  teacher_email     TEXT        NOT NULL,
  batch_id          TEXT,
  -- Category scores 1–5
  punctuality       SMALLINT    CHECK (punctuality       BETWEEN 1 AND 5),
  teaching_quality  SMALLINT    CHECK (teaching_quality  BETWEEN 1 AND 5),
  communication     SMALLINT    CHECK (communication     BETWEEN 1 AND 5),
  overall           SMALLINT    CHECK (overall           BETWEEN 1 AND 5),
  -- Optional comment
  comment           TEXT,
  is_anonymous      BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One rating per student per session
  CONSTRAINT uq_session_student_rating UNIQUE (session_id, student_email)
);

-- Indexes for fast teacher-level queries
CREATE INDEX IF NOT EXISTS idx_ratings_teacher ON session_ratings (teacher_email);
CREATE INDEX IF NOT EXISTS idx_ratings_session ON session_ratings (session_id);
CREATE INDEX IF NOT EXISTS idx_ratings_batch   ON session_ratings (batch_id) WHERE batch_id IS NOT NULL;

INSERT INTO _migrations (filename) VALUES ('006_session_ratings.sql');

COMMIT;
