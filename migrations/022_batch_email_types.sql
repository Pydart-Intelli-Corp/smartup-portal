-- Migration 022: Add batch notification template types to email_log
-- Allows logging batch creation emails (coordinator, teacher, student, parent)
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '022_batch_email_types.sql') THEN
    RAISE EXCEPTION 'Migration 022_batch_email_types.sql already applied — skipping';
  END IF;
END $$;

-- Drop the old CHECK constraint and add new one with batch types
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
    'batch_parent_notify'
  )
);

INSERT INTO _migrations (filename) VALUES ('022_batch_email_types.sql');
COMMIT;
