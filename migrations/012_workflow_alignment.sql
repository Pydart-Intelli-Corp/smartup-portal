-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 012: Workflow Alignment
-- Adds batch_type, session limits, admission workflow,
-- cancellation requests, class portion/remarks, fee gating
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '012_workflow_alignment.sql') THEN
    RAISE EXCEPTION 'Migration 012_workflow_alignment.sql already applied — skipping';
  END IF;
END $$;

-- ── 1. Add batch_type and class conduct fields to rooms ─────

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_type TEXT DEFAULT 'one_to_many'
  CHECK (batch_type IN ('one_to_one', 'one_to_three', 'one_to_many'));

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_portion TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_remarks TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ── 2. Admission requests table ─────────────────────────────

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

-- ── 3. Cancellation requests table ──────────────────────────

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL REFERENCES rooms(room_id),
  requested_by    TEXT NOT NULL,
  requester_role  TEXT NOT NULL
    CHECK (requester_role IN ('parent', 'student', 'teacher', 'coordinator')),
  reason          TEXT,
  cancellation_type TEXT NOT NULL DEFAULT 'parent_initiated'
    CHECK (cancellation_type IN ('parent_initiated', 'group_request', 'teacher_initiated')),

  -- Multi-level approval chain
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'coordinator_approved', 'admin_approved', 'academic_approved', 'hr_approved', 'approved', 'rejected')),

  coordinator_decision  TEXT CHECK (coordinator_decision IN ('approved', 'rejected')),
  coordinator_email     TEXT,
  coordinator_at        TIMESTAMPTZ,

  admin_decision        TEXT CHECK (admin_decision IN ('approved', 'rejected')),
  admin_email           TEXT,
  admin_at              TIMESTAMPTZ,

  academic_decision     TEXT CHECK (academic_decision IN ('approved', 'rejected')),
  academic_email        TEXT,
  academic_at           TIMESTAMPTZ,

  hr_decision           TEXT CHECK (hr_decision IN ('approved', 'rejected')),
  hr_email              TEXT,
  hr_at                 TIMESTAMPTZ,

  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancel_room ON cancellation_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_cancel_status ON cancellation_requests(status);

-- ── 4. Session config table (teacher limits, defaults) ──────

CREATE TABLE IF NOT EXISTS session_config (
  id                      SERIAL PRIMARY KEY,
  max_sessions_per_day    INTEGER NOT NULL DEFAULT 4,
  default_duration_minutes INTEGER NOT NULL DEFAULT 90,
  teaching_minutes        INTEGER NOT NULL DEFAULT 75,
  prep_buffer_minutes     INTEGER NOT NULL DEFAULT 15,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO session_config (max_sessions_per_day, default_duration_minutes, teaching_minutes, prep_buffer_minutes)
VALUES (4, 90, 75, 15)
ON CONFLICT DO NOTHING;

-- ── 5. Rejoin requests audit table ──────────────────────────

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

-- ── 6. Expand room_events constraint for new event types ────

ALTER TABLE room_events DROP CONSTRAINT IF EXISTS room_events_event_type_check;
ALTER TABLE room_events ADD CONSTRAINT room_events_event_type_check CHECK (
  event_type IN (
    -- existing types
    'room_created', 'room_cancelled', 'room_ended', 'room_ended_by_teacher',
    'room_started', 'notification_sent',
    'participant_joined', 'participant_left',
    'teacher_joined', 'teacher_left',
    'go_live', 'attendance_marked', 'attendance_update',
    'recording_started', 'recording_stopped', 'recording_completed', 'recording_failed',
    'attention_update', 'contact_violation', 'contact_violation_detected',
    'student_feedback', 'reminder_sent',
    -- new workflow types
    'class_portion_updated', 'class_remarks_updated',
    'cancellation_requested', 'cancellation_approved', 'cancellation_rejected',
    'rejoin_requested', 'rejoin_approved', 'rejoin_denied',
    'fee_payment_confirmed', 'fee_payment',
    'admission_status_change',
    'session_report_generated', 'parent_report_generated'
  )
);

-- ── 7. Add payment_status to room_assignments for fee gating ──

ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_required'
  CHECK (payment_status IN ('not_required', 'pending', 'paid', 'overdue'));

-- ── Track migration ─────────────────────────────────────────

INSERT INTO _migrations (filename) VALUES ('012_workflow_alignment.sql');

COMMIT;
