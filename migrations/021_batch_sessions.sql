-- Migration 021: Batch Sessions — Scheduled class sessions per batch
-- Per workflow.json: 90 min sessions (75 min teaching + 15 min prep)
-- Each teacher: max 4 sessions per day
-- LiveKit rooms auto-created when session starts

CREATE TABLE IF NOT EXISTS batch_sessions (
  session_id          TEXT        PRIMARY KEY DEFAULT 'sess_' || substr(gen_random_uuid()::text, 1, 12),
  batch_id            TEXT        NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,

  -- Class details
  subject             TEXT        NOT NULL,
  teacher_email       TEXT,
  teacher_name        TEXT,

  -- Schedule
  scheduled_date      DATE        NOT NULL,
  start_time          TIME        NOT NULL,
  duration_minutes    INTEGER     NOT NULL DEFAULT 90,
  teaching_minutes    INTEGER     NOT NULL DEFAULT 75,
  prep_buffer_minutes INTEGER     NOT NULL DEFAULT 15,

  -- Status tracking
  status              TEXT        NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),

  -- LiveKit integration
  livekit_room_name   TEXT,

  -- Notes & metadata
  topic               TEXT,
  notes               TEXT,

  -- Lifecycle timestamps
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,

  -- Audit
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bsess_batch     ON batch_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_bsess_teacher   ON batch_sessions(teacher_email);
CREATE INDEX IF NOT EXISTS idx_bsess_date      ON batch_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bsess_status    ON batch_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bsess_livekit   ON batch_sessions(livekit_room_name);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER trg_batch_sessions_updated_at
  BEFORE UPDATE ON batch_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
