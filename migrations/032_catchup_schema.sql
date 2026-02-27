-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 032: Catch-Up Schema Alignment
-- Applies all missing schema from unapplied migrations:
--   012 (partial), 017, 021, 022, 023, 025, 026, 027, 029, 030, 031
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- A. FIX payslips column names to match application code
--    DB has: loss_of_pay_paise, total_pay_paise
--    Code uses: lop_paise, total_paise (consistently across 6+ files)
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payslips' AND column_name = 'loss_of_pay_paise'
  ) THEN
    ALTER TABLE payslips RENAME COLUMN loss_of_pay_paise TO lop_paise;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payslips' AND column_name = 'total_pay_paise'
  ) THEN
    ALTER TABLE payslips RENAME COLUMN total_pay_paise TO total_paise;
  END IF;
END $$;

-- Make teacher_name nullable (INSERT in generatePayslips doesn't supply it)
ALTER TABLE payslips ALTER COLUMN teacher_name DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- B. ADD missing columns to rooms (from 012 + 029)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_type TEXT DEFAULT 'one_to_many';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_portion TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_remarks TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rooms_batch_id ON rooms(batch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_batch_session_id ON rooms(batch_session_id);

-- ═══════════════════════════════════════════════════════════════
-- C. ADD missing columns to attendance_sessions (from 030)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS mic_off_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camera_off_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_request_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attention_avg       SMALLINT;

-- ═══════════════════════════════════════════════════════════════
-- D. CREATE missing tables
-- ═══════════════════════════════════════════════════════════════

-- D1. admission_requests (from 012)
CREATE TABLE IF NOT EXISTS admission_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name    TEXT NOT NULL,
  student_email   TEXT NOT NULL,
  parent_name     TEXT,
  parent_email    TEXT,
  parent_phone    TEXT,
  grade           TEXT NOT NULL,
  subjects        TEXT[] DEFAULT '{}',
  board           TEXT,
  batch_type_pref TEXT DEFAULT 'one_to_many'
    CHECK (batch_type_pref IN ('one_to_one', 'one_to_three', 'one_to_many')),
  status          TEXT NOT NULL DEFAULT 'enquiry'
    CHECK (status IN ('enquiry', 'registered', 'fee_confirmed', 'allocated', 'active', 'rejected')),
  fee_structure_id UUID,
  allocated_batch_id TEXT,
  notes           TEXT,
  processed_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admission_status ON admission_requests(status);
CREATE INDEX IF NOT EXISTS idx_admission_email ON admission_requests(student_email);

-- D2. rejoin_requests (from 012)
CREATE TABLE IF NOT EXISTS rejoin_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES rooms(room_id),
  student_email   TEXT NOT NULL,
  teacher_email   TEXT,
  decision        TEXT CHECK (decision IN ('approved', 'denied', 'pending')),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rejoin_room ON rejoin_requests(room_id);

-- D3. session_config (from 012)
CREATE TABLE IF NOT EXISTS session_config (
  id                      SERIAL PRIMARY KEY,
  max_sessions_per_day    INTEGER NOT NULL DEFAULT 4,
  default_duration_minutes INTEGER NOT NULL DEFAULT 90,
  teaching_minutes        INTEGER NOT NULL DEFAULT 75,
  prep_buffer_minutes     INTEGER NOT NULL DEFAULT 15,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO session_config (max_sessions_per_day, default_duration_minutes, teaching_minutes, prep_buffer_minutes)
VALUES (4, 90, 75, 15)
ON CONFLICT DO NOTHING;

-- D4. class_monitoring_events (from 027)
CREATE TABLE IF NOT EXISTS class_monitoring_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL,
  session_id          UUID,
  student_email       TEXT        NOT NULL,
  student_name        TEXT,
  event_type          TEXT        NOT NULL,
  confidence          SMALLINT    DEFAULT 100,
  duration_seconds    INTEGER     DEFAULT 0,
  details             JSONB       DEFAULT '{}',
  snapshot_url        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_mon_event_type CHECK (
    event_type IN (
      'attentive', 'looking_away', 'eyes_closed', 'not_in_frame',
      'low_engagement', 'hand_raised', 'speaking', 'distracted',
      'phone_detected', 'multiple_faces'
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_mon_events_room ON class_monitoring_events(room_id);
CREATE INDEX IF NOT EXISTS idx_mon_events_student ON class_monitoring_events(student_email);
CREATE INDEX IF NOT EXISTS idx_mon_events_session ON class_monitoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_mon_events_created ON class_monitoring_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mon_events_type ON class_monitoring_events(event_type);

-- D5. monitoring_alerts (from 027)
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT,
  session_id          UUID,
  batch_id            UUID,
  alert_type          TEXT        NOT NULL,
  severity            TEXT        NOT NULL DEFAULT 'warning',
  title               TEXT        NOT NULL,
  message             TEXT        NOT NULL,
  target_email        TEXT,
  notify_coordinator  BOOLEAN     DEFAULT true,
  notify_ao           BOOLEAN     DEFAULT true,
  notify_teacher      BOOLEAN     DEFAULT false,
  status              TEXT        NOT NULL DEFAULT 'active',
  dismissed_by        TEXT,
  dismissed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alert_type CHECK (
    alert_type IN (
      'teacher_absent', 'teacher_camera_off', 'class_started_late',
      'class_cancelled', 'low_attendance', 'student_sleeping',
      'student_not_looking', 'student_left_frame', 'student_distracted',
      'class_disruption', 'contact_violation', 'phone_detected', 'unusual_leave'
    )
  ),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT chk_alert_status CHECK (status IN ('active', 'dismissed', 'resolved', 'escalated'))
);
CREATE INDEX IF NOT EXISTS idx_mon_alerts_room ON monitoring_alerts(room_id);
CREATE INDEX IF NOT EXISTS idx_mon_alerts_status ON monitoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_mon_alerts_created ON monitoring_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_mon_alerts_batch ON monitoring_alerts(batch_id);
CREATE INDEX IF NOT EXISTS idx_mon_alerts_type ON monitoring_alerts(alert_type);

-- D6. monitoring_reports (from 027)
CREATE TABLE IF NOT EXISTS monitoring_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type         TEXT        NOT NULL,
  report_period       TEXT        NOT NULL,
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  target_email        TEXT        NOT NULL,
  target_role         TEXT        NOT NULL,
  target_name         TEXT,
  batch_id            UUID,
  batch_name          TEXT,
  grade               TEXT,
  section             TEXT,
  metrics             JSONB       NOT NULL DEFAULT '{}',
  sent_to_parent      BOOLEAN     DEFAULT false,
  parent_email        TEXT,
  sent_at             TIMESTAMPTZ,
  generated_by        TEXT        DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_mrep_type CHECK (
    report_type IN (
      'student_daily', 'student_weekly', 'student_monthly',
      'teacher_daily', 'teacher_weekly', 'teacher_monthly'
    )
  ),
  CONSTRAINT chk_mrep_period CHECK (report_period IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT chk_mrep_role CHECK (target_role IN ('student', 'teacher'))
);
CREATE INDEX IF NOT EXISTS idx_mon_reports_target ON monitoring_reports(target_email);
CREATE INDEX IF NOT EXISTS idx_mon_reports_type ON monitoring_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_mon_reports_period ON monitoring_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_mon_reports_batch ON monitoring_reports(batch_id);

-- D7. session_requests (from 029)
CREATE TABLE IF NOT EXISTS session_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  requester_email   TEXT NOT NULL,
  requester_role    TEXT NOT NULL CHECK (requester_role IN ('student', 'parent')),
  batch_session_id  TEXT,
  batch_id          TEXT,
  room_id           TEXT,
  reason            TEXT NOT NULL,
  proposed_date     DATE,
  proposed_time     TIME,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  notifications_sent BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_requests_batch ON session_requests(batch_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_status ON session_requests(status);
CREATE INDEX IF NOT EXISTS idx_session_requests_requester ON session_requests(requester_email);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS session_requests_updated ON session_requests;
CREATE TRIGGER session_requests_updated BEFORE UPDATE ON session_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- D8. student_availability (from 029)
CREATE TABLE IF NOT EXISTS student_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email   TEXT NOT NULL,
  batch_id        TEXT,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  preference       TEXT DEFAULT 'available'
                   CHECK (preference IN ('available', 'preferred', 'unavailable')),
  notes            TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_availability_student ON student_availability(student_email);
CREATE INDEX IF NOT EXISTS idx_student_availability_batch ON student_availability(batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_availability_unique
  ON student_availability(student_email, COALESCE(batch_id, ''), day_of_week, start_time)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS student_availability_updated ON student_availability;
CREATE TRIGGER student_availability_updated BEFORE UPDATE ON student_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- D9. teacher_leave_requests (from 029)
CREATE TABLE IF NOT EXISTS teacher_leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email   TEXT NOT NULL,
  leave_type      TEXT NOT NULL CHECK (leave_type IN ('sick', 'personal', 'emergency', 'planned', 'other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  ao_status       TEXT DEFAULT 'pending' CHECK (ao_status IN ('pending', 'approved', 'rejected', 'skipped')),
  ao_reviewed_by  TEXT,
  ao_reviewed_at  TIMESTAMPTZ,
  ao_notes        TEXT,
  hr_status       TEXT DEFAULT 'pending' CHECK (hr_status IN ('pending', 'approved', 'rejected', 'skipped')),
  hr_reviewed_by  TEXT,
  hr_reviewed_at  TIMESTAMPTZ,
  hr_notes        TEXT,
  owner_status    TEXT DEFAULT 'pending' CHECK (owner_status IN ('pending', 'approved', 'rejected', 'skipped')),
  owner_reviewed_by TEXT,
  owner_reviewed_at TIMESTAMPTZ,
  owner_notes     TEXT,
  affected_sessions TEXT[] DEFAULT '{}',
  substitute_teacher TEXT,
  notifications_sent BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teacher_leave_teacher ON teacher_leave_requests(teacher_email);
CREATE INDEX IF NOT EXISTS idx_teacher_leave_status ON teacher_leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_teacher_leave_dates ON teacher_leave_requests(start_date, end_date);

DROP TRIGGER IF EXISTS teacher_leave_updated ON teacher_leave_requests;
CREATE TRIGGER teacher_leave_updated BEFORE UPDATE ON teacher_leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- E. UPDATE CONSTRAINTS (using latest versions)
-- ═══════════════════════════════════════════════════════════════

-- E1. room_events — combined event types from 012 + 027
ALTER TABLE room_events DROP CONSTRAINT IF EXISTS room_events_event_type_check;
ALTER TABLE room_events DROP CONSTRAINT IF EXISTS chk_event_type;
ALTER TABLE room_events ADD CONSTRAINT chk_event_type CHECK (
  event_type IN (
    'room_created', 'room_started', 'room_ended_by_teacher', 'room_expired',
    'room_cancelled', 'participant_joined', 'participant_left',
    'payment_completed', 'notification_sent', 'reminder_sent',
    'recording_started', 'recording_stopped',
    'attention_update', 'exam_started', 'exam_submitted',
    'teacher_joined', 'teacher_left', 'go_live', 'attendance_marked', 'attendance_update',
    'recording_completed', 'recording_failed',
    'contact_violation', 'contact_violation_detected',
    'student_feedback',
    'class_portion_updated', 'class_remarks_updated',
    'cancellation_requested', 'cancellation_approved', 'cancellation_rejected',
    'rejoin_requested', 'rejoin_approved', 'rejoin_denied',
    'fee_payment_confirmed', 'fee_payment',
    'admission_status_change',
    'session_report_generated', 'parent_report_generated',
    'monitoring_alert', 'teacher_camera_toggle',
    'student_attention_low', 'class_report_generated'
  )
);

-- E2. email_log — use 031 version (most complete)
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS chk_template_type;
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check
  CHECK (template_type IN (
    'teacher_invite', 'student_invite', 'room_reminder', 'room_cancelled',
    'room_rescheduled', 'payment_confirmation', 'coordinator_summary',
    'batch_coordinator_notify', 'batch_teacher_notify', 'batch_student_notify',
    'batch_parent_notify', 'daily_timetable', 'session_reminder',
    'weekly_timetable', 'weekly_timetable_auto',
    'session_request_submitted', 'session_request_approved', 'session_request_rejected',
    'session_rescheduled_notify', 'session_cancelled_notify',
    'availability_submitted',
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'leave_sessions_affected',
    'invoice_generated', 'payment_receipt', 'payslip_notification', 'payment_reminder',
    'credentials'
  ));

-- E3. generated_reports — from 027
ALTER TABLE generated_reports DROP CONSTRAINT IF EXISTS chk_report_type;
ALTER TABLE generated_reports ADD CONSTRAINT chk_report_type CHECK (
  report_type IN (
    'daily_business_summary', 'weekly_sales', 'monthly_academic',
    'monthly_revenue', 'teacher_performance', 'session_report', 'parent_monthly',
    'student_daily_monitoring', 'student_weekly_monitoring', 'student_monthly_monitoring',
    'teacher_daily_monitoring', 'teacher_weekly_monitoring', 'teacher_monthly_monitoring',
    'class_session_monitoring'
  )
);

-- E4. attendance_logs — from 030
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

-- ═══════════════════════════════════════════════════════════════
-- F. RECORD MIGRATIONS as applied
-- ═══════════════════════════════════════════════════════════════

INSERT INTO _migrations (filename) VALUES
  ('017_teacher_per_hour_rate.sql'),
  ('021_batch_sessions.sql'),
  ('022_batch_email_types.sql'),
  ('023_attendance_confirmed.sql'),
  ('025_teaching_materials.sql'),
  ('026_teaching_materials_v2.sql'),
  ('027_class_monitoring.sql'),
  ('029_session_requests_and_leave.sql'),
  ('030_attendance_media_tracking.sql'),
  ('031_payment_email_types.sql'),
  ('032_catchup_schema.sql')
ON CONFLICT DO NOTHING;

COMMIT;
