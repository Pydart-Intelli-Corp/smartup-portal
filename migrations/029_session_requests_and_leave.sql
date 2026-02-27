-- ═══════════════════════════════════════════════════════════════
-- Migration 029: Session Requests, Availability & Teacher Leave
-- ═══════════════════════════════════════════════════════════════

-- 1. Session change/cancel requests from students & parents
CREATE TABLE IF NOT EXISTS session_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  -- Who is requesting
  requester_email   TEXT NOT NULL,
  requester_role    TEXT NOT NULL CHECK (requester_role IN ('student', 'parent')),
  -- What session
  batch_session_id  TEXT,                        -- FK to batch_sessions.session_id
  batch_id          TEXT,                        -- FK to batches.batch_id
  room_id           TEXT,                        -- FK to rooms.room_id (if already created)
  -- Request details
  reason            TEXT NOT NULL,
  -- For reschedule: proposed new date/time
  proposed_date     DATE,
  proposed_time     TIME,
  -- Approval workflow
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by       TEXT,                        -- email of approver
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  -- Notification tracking
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

-- 2. Student availability submissions
CREATE TABLE IF NOT EXISTS student_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email   TEXT NOT NULL,
  batch_id        TEXT,                          -- FK to batches.batch_id (optional scope)
  -- Availability slots
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  -- Preferences
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

-- 3. Teacher leave requests
CREATE TABLE IF NOT EXISTS teacher_leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email   TEXT NOT NULL,
  leave_type      TEXT NOT NULL CHECK (leave_type IN ('sick', 'personal', 'emergency', 'planned', 'other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          TEXT NOT NULL,
  -- Approval chain: AO → HR → Owner (any can approve)
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  -- First level: AO
  ao_status       TEXT DEFAULT 'pending' CHECK (ao_status IN ('pending', 'approved', 'rejected', 'skipped')),
  ao_reviewed_by  TEXT,
  ao_reviewed_at  TIMESTAMPTZ,
  ao_notes        TEXT,
  -- Second level: HR
  hr_status       TEXT DEFAULT 'pending' CHECK (hr_status IN ('pending', 'approved', 'rejected', 'skipped')),
  hr_reviewed_by  TEXT,
  hr_reviewed_at  TIMESTAMPTZ,
  hr_notes        TEXT,
  -- Final: Owner (optional override)
  owner_status    TEXT DEFAULT 'pending' CHECK (owner_status IN ('pending', 'approved', 'rejected', 'skipped')),
  owner_reviewed_by TEXT,
  owner_reviewed_at TIMESTAMPTZ,
  owner_notes     TEXT,
  -- Affected sessions (auto-computed on approval)
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

-- 4. Add batch_id FK to rooms for better linkage
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS batch_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rooms_batch_id ON rooms(batch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_batch_session_id ON rooms(batch_session_id);

-- 5. Expand email_log template_type for new notification types
ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check
  CHECK (template_type IN (
    'teacher_invite', 'student_invite', 'room_reminder', 'room_cancelled',
    'room_rescheduled', 'payment_confirmation', 'coordinator_summary',
    'batch_coordinator_notify', 'batch_teacher_notify', 'batch_student_notify',
    'batch_parent_notify', 'daily_timetable', 'session_reminder',
    'weekly_timetable', 'weekly_timetable_auto',
    -- New types
    'session_request_submitted', 'session_request_approved', 'session_request_rejected',
    'session_rescheduled_notify', 'session_cancelled_notify',
    'availability_submitted',
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'leave_sessions_affected'
  ));
