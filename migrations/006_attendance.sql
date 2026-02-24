-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 006: Attendance Management System
-- Tracks student join/leave/rejoin per class session
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Skip if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '006_attendance.sql') THEN
    RAISE EXCEPTION 'Migration 006_attendance.sql already applied — skipping';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- attendance_sessions — One row per student per class session
-- Stores computed totals; real-time details live in attendance_logs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE attendance_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_email   TEXT        NOT NULL,
  participant_name    TEXT        NOT NULL,
  participant_role    TEXT        NOT NULL DEFAULT 'student',

  -- Timing
  first_join_at       TIMESTAMPTZ,          -- absolute first connection
  last_leave_at       TIMESTAMPTZ,          -- most recent disconnect
  total_duration_sec  INTEGER     DEFAULT 0, -- total seconds present
  join_count          INTEGER     DEFAULT 0, -- number of join events (1 = normal, >1 = rejoins)

  -- Attendance verdict
  status              TEXT        NOT NULL DEFAULT 'absent',
  late_join           BOOLEAN     NOT NULL DEFAULT false,  -- joined after scheduled_start
  late_by_sec         INTEGER     DEFAULT 0,                -- how many seconds late

  -- Leave tracking
  leave_approved      BOOLEAN,              -- NULL = still in class, true = teacher approved leave
  leave_reason        TEXT,                 -- optional reason

  -- Teacher / AI notes
  teacher_remarks     TEXT,
  engagement_score    SMALLINT,             -- 0-100, nullable, for future AI

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_att_status CHECK (
    status IN ('present', 'absent', 'late', 'left_early', 'excused')
  ),
  CONSTRAINT chk_att_role CHECK (
    participant_role IN ('student', 'teacher')
  ),
  CONSTRAINT uq_attendance_session UNIQUE (room_id, participant_email)
);

CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- attendance_logs — Immutable join/leave/rejoin event log
-- Every connect and disconnect is one row
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE attendance_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_email   TEXT        NOT NULL,
  participant_name    TEXT,
  participant_role    TEXT,
  event_type          TEXT        NOT NULL,
  event_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload             JSONB,

  CONSTRAINT chk_att_log_type CHECK (
    event_type IN (
      'join',           -- student/teacher connected
      'leave',          -- student/teacher disconnected
      'rejoin',         -- student reconnected after leave
      'leave_request',  -- student requested to leave
      'leave_approved', -- teacher approved leave
      'leave_denied',   -- teacher denied leave
      'late_join',      -- system marked as late
      'kicked'          -- removed by teacher/system
    )
  )
);


-- ═══════════════════════════════════════════════════════════════
-- contact_violations — Unauthorized contact attempt detection
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE contact_violations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  sender_email        TEXT        NOT NULL,
  sender_name         TEXT,
  sender_role         TEXT,
  message_text        TEXT        NOT NULL,
  detected_pattern    TEXT        NOT NULL,  -- e.g. 'phone_number', 'instagram', 'whatsapp'
  severity            TEXT        NOT NULL DEFAULT 'warning',
  notified            BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_violation_severity CHECK (
    severity IN ('info', 'warning', 'critical')
  )
);


-- ═══════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════

-- attendance_sessions
CREATE INDEX idx_att_sess_room       ON attendance_sessions (room_id);
CREATE INDEX idx_att_sess_email      ON attendance_sessions (participant_email);
CREATE INDEX idx_att_sess_status     ON attendance_sessions (room_id, status);

-- attendance_logs
CREATE INDEX idx_att_log_room        ON attendance_logs (room_id);
CREATE INDEX idx_att_log_email       ON attendance_logs (participant_email);
CREATE INDEX idx_att_log_event_at    ON attendance_logs (event_at DESC);

-- contact_violations
CREATE INDEX idx_cv_room             ON contact_violations (room_id);
CREATE INDEX idx_cv_sender           ON contact_violations (sender_email);


-- ═══════════════════════════════════════════════════════════════
-- Add new event types to room_events check constraint
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE room_events DROP CONSTRAINT IF EXISTS chk_event_type;
ALTER TABLE room_events ADD CONSTRAINT chk_event_type CHECK (
  event_type IN (
    'room_created',
    'room_started',
    'room_ended_by_teacher',
    'room_expired',
    'room_cancelled',
    'participant_joined',
    'participant_left',
    'payment_completed',
    'notification_sent',
    'reminder_sent',
    'attendance_marked',
    'contact_violation'
  )
);


-- Record migration
INSERT INTO _migrations (filename) VALUES ('006_attendance.sql');

COMMIT;
