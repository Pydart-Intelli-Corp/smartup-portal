-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 030: Attendance Media Event Tracking
-- Adds mic/camera off counts, leave request count,
-- and attention score to attendance_sessions.
-- Expands event_type constraint on attendance_logs.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── New columns on attendance_sessions ────────────────────────
ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS mic_off_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camera_off_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_request_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attention_avg       SMALLINT;  -- 0-100, from MediaPipe face-detection

-- ── Expand event_type constraint on attendance_logs ───────────
-- Drop old constraint and add new one with media events
ALTER TABLE attendance_logs DROP CONSTRAINT IF EXISTS chk_att_log_type;
ALTER TABLE attendance_logs ADD CONSTRAINT chk_att_log_type CHECK (
  event_type IN (
    'join', 'leave', 'rejoin',
    'leave_request', 'leave_approved', 'leave_denied',
    'late_join', 'kicked',
    'mic_off', 'mic_on',
    'camera_off', 'camera_on',
    'attention_report'
  )
);

-- ── Record migration ──────────────────────────────────────────
INSERT INTO _migrations (filename) VALUES ('030_attendance_media_tracking.sql')
ON CONFLICT DO NOTHING;

COMMIT;
