-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 001: Initial Schema
-- Step 02 of portal_dev build plan
-- ═══════════════════════════════════════════════════════════════
-- Run: npm run db:migrate
-- Manual: psql -d smartup_portal -f migrations/001_initial.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Enable UUID generation ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- Migration tracking table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS _migrations (
  id            SERIAL PRIMARY KEY,
  filename      TEXT NOT NULL UNIQUE,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skip if already applied
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '001_initial.sql') THEN
    RAISE EXCEPTION 'Migration 001_initial.sql already applied — skipping';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2.2 — Core Tables
-- ═══════════════════════════════════════════════════════════════

-- ── rooms ───────────────────────────────────────────────────
-- Central table. Every room created by a coordinator lives here.
-- All other tables reference room_id.

CREATE TABLE rooms (
  room_id             TEXT        PRIMARY KEY,
  room_name           TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  grade               TEXT        NOT NULL,
  section             TEXT,
  coordinator_email   TEXT        NOT NULL,
  teacher_email       TEXT,
  status              TEXT        NOT NULL DEFAULT 'scheduled',
  scheduled_start     TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER     NOT NULL,
  open_at             TIMESTAMPTZ NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ,
  max_participants    INTEGER     DEFAULT 50,
  fee_paise           INTEGER     DEFAULT 0,
  notes_for_teacher   TEXT,
  reminder_sent_at    TIMESTAMPTZ,
  livekit_room_id     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rooms_status CHECK (
    status IN ('scheduled', 'live', 'ended', 'cancelled')
  ),
  CONSTRAINT chk_rooms_duration CHECK (
    duration_minutes > 0
  ),
  CONSTRAINT chk_rooms_fee CHECK (
    fee_paise >= 0
  )
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ── room_events ─────────────────────────────────────────────
-- Audit log for everything that happens inside a room.

CREATE TABLE room_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  event_type          TEXT        NOT NULL,
  participant_email   TEXT,
  participant_role    TEXT,
  payload             JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_event_type CHECK (
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
      'reminder_sent'
    )
  )
);


-- ═══════════════════════════════════════════════════════════════
-- 2.3 — Assignment and Participant Tables
-- ═══════════════════════════════════════════════════════════════

-- ── room_assignments ────────────────────────────────────────
-- Every teacher and student assigned to a room.
-- One row per person per room.

CREATE TABLE room_assignments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_type    TEXT        NOT NULL,
  participant_email   TEXT        NOT NULL,
  participant_name    TEXT        NOT NULL,
  frappe_user_id      TEXT,
  join_token          TEXT,
  device_preference   TEXT        DEFAULT 'desktop',
  notification_sent_at TIMESTAMPTZ,
  joined_at           TIMESTAMPTZ,
  left_at             TIMESTAMPTZ,
  payment_status      TEXT        NOT NULL DEFAULT 'unknown',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_participant_type CHECK (
    participant_type IN ('teacher', 'student')
  ),
  CONSTRAINT chk_payment_status CHECK (
    payment_status IN ('paid', 'unpaid', 'exempt', 'scholarship', 'unknown')
  ),
  CONSTRAINT chk_device_preference CHECK (
    device_preference IN ('desktop', 'tablet')
  ),
  CONSTRAINT uq_room_participant UNIQUE (room_id, participant_email)
);


-- ═══════════════════════════════════════════════════════════════
-- 2.4 — Payment Tables
-- ═══════════════════════════════════════════════════════════════

-- ── payment_attempts ────────────────────────────────────────
-- One row per payment attempt.
-- A student may attempt payment multiple times.

CREATE TABLE payment_attempts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT        UNIQUE NOT NULL,
  room_id             TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  student_email       TEXT        NOT NULL,
  student_frappe_id   TEXT,
  amount_paise        INTEGER     NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'initiated',
  transaction_id      TEXT,
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  raw_callback        JSONB,

  CONSTRAINT chk_payment_status CHECK (
    status IN ('initiated', 'completed', 'failed', 'pending', 'fraud_attempt')
  ),
  CONSTRAINT chk_amount_positive CHECK (
    amount_paise > 0
  )
);


-- ═══════════════════════════════════════════════════════════════
-- 2.5 — Email Log Table
-- ═══════════════════════════════════════════════════════════════

-- ── email_log ───────────────────────────────────────────────
-- Every email dispatched by the portal.

CREATE TABLE email_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        REFERENCES rooms(room_id) ON DELETE SET NULL,
  recipient_email     TEXT        NOT NULL,
  template_type       TEXT        NOT NULL,
  subject             TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'queued',
  smtp_message_id     TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,

  CONSTRAINT chk_template_type CHECK (
    template_type IN (
      'teacher_invite',
      'student_invite',
      'payment_confirmation',
      'room_reminder',
      'room_cancelled',
      'room_rescheduled',
      'coordinator_summary'
    )
  ),
  CONSTRAINT chk_email_status CHECK (
    status IN ('queued', 'sent', 'failed')
  )
);


-- ═══════════════════════════════════════════════════════════════
-- 2.6 — Configuration Table
-- ═══════════════════════════════════════════════════════════════

-- ── school_config ───────────────────────────────────────────
-- Key-value store for school-wide settings.

CREATE TABLE school_config (
  key                 TEXT        PRIMARY KEY,
  value               TEXT        NOT NULL,
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config values
INSERT INTO school_config (key, value, description) VALUES
  ('default_class_fee_paise', '0',      'Default fee if coordinator does not set one'),
  ('early_join_minutes',      '15',     'How many minutes before start the lobby opens'),
  ('grace_period_minutes',    '15',     'Extra time after class end before link dies'),
  ('max_students_per_room',   '50',     'Default room capacity'),
  ('email_reminder_minutes',  '30',     'How far ahead to send reminder emails'),
  ('smtp_provider',           'google', 'Active SMTP provider label');


-- ═══════════════════════════════════════════════════════════════
-- 2.7 — Indexes
-- ═══════════════════════════════════════════════════════════════

-- rooms
CREATE INDEX idx_rooms_status          ON rooms (status);
CREATE INDEX idx_rooms_coordinator     ON rooms (coordinator_email);
CREATE INDEX idx_rooms_expires_at      ON rooms (expires_at);
CREATE INDEX idx_rooms_scheduled_start ON rooms (scheduled_start);

-- room_events
CREATE INDEX idx_room_events_room_id   ON room_events (room_id);
CREATE INDEX idx_room_events_created   ON room_events (created_at DESC);

-- room_assignments
CREATE INDEX idx_assignments_room_id   ON room_assignments (room_id);
CREATE INDEX idx_assignments_email     ON room_assignments (participant_email);
CREATE INDEX idx_assignments_payment   ON room_assignments (room_id, payment_status);

-- payment_attempts
CREATE INDEX idx_payment_order_id      ON payment_attempts (order_id);
CREATE INDEX idx_payment_room_student  ON payment_attempts (room_id, student_email);

-- email_log
CREATE INDEX idx_email_log_room_id     ON email_log (room_id);
CREATE INDEX idx_email_log_status      ON email_log (status);


-- ═══════════════════════════════════════════════════════════════
-- Record migration
-- ═══════════════════════════════════════════════════════════════

INSERT INTO _migrations (filename) VALUES ('001_initial.sql');

COMMIT;
