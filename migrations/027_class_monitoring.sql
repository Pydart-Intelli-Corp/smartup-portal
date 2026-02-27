-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 027: AI Class Monitoring System
-- Tables: class_monitoring_events, monitoring_alerts, monitoring_reports
-- Enables MediaPipe-based attention tracking + automated alerts
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '027_class_monitoring.sql') THEN
    RAISE EXCEPTION 'Migration 027_class_monitoring.sql already applied — skipping';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- class_monitoring_events
-- Per-student attention/behavior events from MediaPipe AI
-- Batched every 30s from client → server
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE class_monitoring_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL,
  session_id          UUID,                   -- links to batch_sessions if available
  student_email       TEXT        NOT NULL,
  student_name        TEXT,

  -- Event classification
  event_type          TEXT        NOT NULL,
  confidence          SMALLINT    DEFAULT 100, -- 0-100 AI confidence
  duration_seconds    INTEGER     DEFAULT 0,   -- how long the event lasted

  -- Context
  details             JSONB       DEFAULT '{}', -- extra context (head pose angles, etc.)
  snapshot_url        TEXT,                      -- optional frame capture URL

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mon_event_type CHECK (
    event_type IN (
      'attentive',           -- student is focused and looking at screen
      'looking_away',        -- head turned away from screen
      'eyes_closed',         -- likely sleeping or drowsy
      'not_in_frame',        -- student not visible in camera
      'low_engagement',      -- combination of signals = low engagement
      'hand_raised',         -- student raised hand
      'speaking',            -- student speaking (mouth movement detected)
      'distracted',          -- frequent head movement / fidgeting
      'phone_detected',      -- phone/device in view
      'multiple_faces'       -- multiple people in frame
    )
  )
);

CREATE INDEX idx_mon_events_room ON class_monitoring_events(room_id);
CREATE INDEX idx_mon_events_student ON class_monitoring_events(student_email);
CREATE INDEX idx_mon_events_session ON class_monitoring_events(session_id);
CREATE INDEX idx_mon_events_created ON class_monitoring_events(created_at);
CREATE INDEX idx_mon_events_type ON class_monitoring_events(event_type);

-- ═══════════════════════════════════════════════════════════════
-- monitoring_alerts
-- Real-time alerts generated from monitoring events
-- Pushed to coordinator + AO dashboards
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE monitoring_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT,
  session_id          UUID,
  batch_id            UUID,

  -- Alert details
  alert_type          TEXT        NOT NULL,
  severity            TEXT        NOT NULL DEFAULT 'warning',
  title               TEXT        NOT NULL,
  message             TEXT        NOT NULL,
  target_email        TEXT,        -- student/teacher this alert is about

  -- Recipient roles
  notify_coordinator  BOOLEAN     DEFAULT true,
  notify_ao           BOOLEAN     DEFAULT true,
  notify_teacher      BOOLEAN     DEFAULT false,

  -- State
  status              TEXT        NOT NULL DEFAULT 'active',
  dismissed_by        TEXT,
  dismissed_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_alert_type CHECK (
    alert_type IN (
      'teacher_absent',       -- teacher hasn't joined after start
      'teacher_camera_off',   -- teacher disabled camera during class
      'class_started_late',   -- session started >10 min late
      'class_cancelled',      -- session cancelled
      'low_attendance',       -- <50% students joined
      'student_sleeping',     -- student eyes closed >2 min
      'student_not_looking',  -- student looking away >4 min
      'student_left_frame',   -- student not visible >3 min
      'student_distracted',   -- student showing distracted behavior
      'class_disruption',     -- many students low engagement
      'contact_violation',    -- chat contact sharing detected
      'phone_detected',       -- student using phone in class
      'unusual_leave'         -- student left without requesting
    )
  ),
  CONSTRAINT chk_alert_severity CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT chk_alert_status CHECK (
    status IN ('active', 'dismissed', 'resolved', 'escalated')
  )
);

CREATE INDEX idx_mon_alerts_room ON monitoring_alerts(room_id);
CREATE INDEX idx_mon_alerts_status ON monitoring_alerts(status);
CREATE INDEX idx_mon_alerts_created ON monitoring_alerts(created_at);
CREATE INDEX idx_mon_alerts_batch ON monitoring_alerts(batch_id);
CREATE INDEX idx_mon_alerts_type ON monitoring_alerts(alert_type);

-- ═══════════════════════════════════════════════════════════════
-- monitoring_reports
-- Aggregated daily/weekly/monthly reports per student and teacher
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE monitoring_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type         TEXT        NOT NULL,
  report_period       TEXT        NOT NULL,   -- 'daily', 'weekly', 'monthly'
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,

  -- Who this report is about
  target_email        TEXT        NOT NULL,   -- student or teacher email
  target_role         TEXT        NOT NULL,   -- 'student' or 'teacher'
  target_name         TEXT,

  -- Context
  batch_id            UUID,
  batch_name          TEXT,
  grade               TEXT,
  section             TEXT,

  -- Aggregated metrics (JSONB for flexibility)
  metrics             JSONB       NOT NULL DEFAULT '{}',
  -- student metrics: { attendance_rate, avg_attention_score, total_classes, classes_attended,
  --   time_in_class_minutes, looking_away_minutes, eyes_closed_minutes, not_in_frame_minutes,
  --   hand_raises, engagement_trend: [daily scores], alerts_count, top_subjects, weak_subjects }
  -- teacher metrics: { sessions_conducted, sessions_cancelled, avg_start_delay_minutes,
  --   on_time_rate, avg_class_duration_minutes, avg_student_engagement, camera_off_incidents,
  --   total_teaching_hours, feedback_avg_score }

  -- Delivery
  sent_to_parent      BOOLEAN     DEFAULT false, -- for monthly student reports
  parent_email        TEXT,
  sent_at             TIMESTAMPTZ,

  -- Generated by
  generated_by        TEXT        DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mrep_type CHECK (
    report_type IN (
      'student_daily',       -- daily student attention + attendance
      'student_weekly',      -- weekly aggregated student report
      'student_monthly',     -- monthly report (sent to parent)
      'teacher_daily',       -- daily teacher performance
      'teacher_weekly',      -- weekly teacher summary
      'teacher_monthly'      -- monthly teacher report (for AO/owner)
    )
  ),
  CONSTRAINT chk_mrep_period CHECK (
    report_period IN ('daily', 'weekly', 'monthly')
  ),
  CONSTRAINT chk_mrep_role CHECK (
    target_role IN ('student', 'teacher')
  )
);

CREATE INDEX idx_mon_reports_target ON monitoring_reports(target_email);
CREATE INDEX idx_mon_reports_type ON monitoring_reports(report_type);
CREATE INDEX idx_mon_reports_period ON monitoring_reports(period_start, period_end);
CREATE INDEX idx_mon_reports_batch ON monitoring_reports(batch_id);

-- ═══════════════════════════════════════════════════════════════
-- Update room_events constraint to include monitoring events
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
    'recording_started',
    'recording_stopped',
    'attention_update',
    'exam_started',
    'exam_submitted',
    'monitoring_alert',
    'teacher_camera_toggle',
    'student_attention_low',
    'class_report_generated'
  )
);

-- ═══════════════════════════════════════════════════════════════
-- Update generated_reports constraint to include new report types
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE generated_reports DROP CONSTRAINT IF EXISTS chk_report_type;
ALTER TABLE generated_reports ADD CONSTRAINT chk_report_type CHECK (
  report_type IN (
    'daily_business_summary',
    'weekly_sales',
    'monthly_academic',
    'monthly_revenue',
    'teacher_performance',
    'session_report',
    'parent_monthly',
    'student_daily_monitoring',
    'student_weekly_monitoring',
    'student_monthly_monitoring',
    'teacher_daily_monitoring',
    'teacher_weekly_monitoring',
    'teacher_monthly_monitoring',
    'class_session_monitoring'
  )
);

-- ── Record migration ────────────────────────────────────────
INSERT INTO _migrations (filename) VALUES ('027_class_monitoring.sql');

COMMIT;
