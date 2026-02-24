-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 013: Parent Complaints & Fee Ledger
-- Adds parent_complaints table for parent-submitted complaints
-- and fee_ledger view for running balance tracking.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '013_parent_complaints_and_ledger.sql') THEN
    RAISE EXCEPTION 'Migration 013_parent_complaints_and_ledger.sql already applied — skipping';
  END IF;
END $$;

-- ── 1. Parent Complaints table ──────────────────────────────

CREATE TABLE IF NOT EXISTS parent_complaints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email    TEXT NOT NULL,
  student_email   TEXT,
  subject         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'teaching', 'fee', 'facility', 'behaviour', 'academic', 'other')),
  description     TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to     TEXT,
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_parent ON parent_complaints(parent_email);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON parent_complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON parent_complaints(student_email);

-- ── 2. Expand room_events for complaint events ─────────────

ALTER TABLE room_events DROP CONSTRAINT IF EXISTS room_events_event_type_check;
ALTER TABLE room_events ADD CONSTRAINT room_events_event_type_check CHECK (
  event_type IN (
    'room_created', 'room_cancelled', 'room_ended', 'room_ended_by_teacher',
    'room_started', 'notification_sent',
    'participant_joined', 'participant_left',
    'teacher_joined', 'teacher_left',
    'go_live', 'attendance_marked', 'attendance_update',
    'recording_started', 'recording_stopped', 'recording_completed', 'recording_failed',
    'attention_update', 'contact_violation', 'contact_violation_detected',
    'student_feedback', 'reminder_sent',
    'class_portion_updated', 'class_remarks_updated',
    'cancellation_requested', 'cancellation_approved', 'cancellation_rejected',
    'rejoin_requested', 'rejoin_approved', 'rejoin_denied',
    'fee_payment_confirmed', 'fee_payment',
    'admission_status_change',
    'session_report_generated', 'parent_report_generated',
    'complaint_submitted', 'complaint_resolved',
    'payment_completed'
  )
);

-- ── Track migration ─────────────────────────────────────────

INSERT INTO _migrations (filename) VALUES ('013_parent_complaints_and_ledger.sql');

COMMIT;
