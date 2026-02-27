-- Migration 024: Add timetable & reminder template types to email_log
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '024_timetable_email_types.sql') THEN
    RAISE EXCEPTION 'Migration 024_timetable_email_types.sql already applied — skipping';
  END IF;
END $$;

ALTER TABLE email_log DROP CONSTRAINT IF EXISTS chk_template_type;

ALTER TABLE email_log ADD CONSTRAINT chk_template_type CHECK (
  template_type IN (
    'teacher_invite',
    'student_invite',
    'payment_confirmation',
    'room_reminder',
    'room_cancelled',
    'room_rescheduled',
    'coordinator_summary',
    'credentials',
    'room_started',
    'batch_coordinator_notify',
    'batch_teacher_notify',
    'batch_student_notify',
    'batch_parent_notify',
    'daily_timetable',
    'session_reminder',
    'weekly_timetable',
    'weekly_timetable_auto'
  )
);

INSERT INTO _migrations (filename) VALUES ('024_timetable_email_types.sql');
COMMIT;
