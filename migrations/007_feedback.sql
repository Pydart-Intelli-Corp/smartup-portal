-- 007_feedback.sql — Student post-class feedback + contact violation alerts
-- Run via: npm run db:migrate

-- ── Student feedback table ────────────────────────────────
-- One row per student per session. Captured when student leaves class.
CREATE TABLE IF NOT EXISTS student_feedback (
  id              SERIAL PRIMARY KEY,
  room_id         TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  student_email   TEXT NOT NULL,
  student_name    TEXT NOT NULL DEFAULT '',
  -- Star rating 1-5
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- Optional text feedback
  feedback_text   TEXT DEFAULT '',
  -- Quick tags (comma-separated): e.g. 'clear_teaching,good_pace'
  tags            TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_feedback_room ON student_feedback(room_id);
CREATE INDEX IF NOT EXISTS idx_student_feedback_student ON student_feedback(student_email);

-- Unique: one feedback per student per room
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_feedback_unique
  ON student_feedback(room_id, student_email);
