-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 011: Reports & Notifications
-- Tables: generated_reports, notification_log
-- Also adds recording columns to rooms
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '011_reports_notifications.sql') THEN
    RAISE EXCEPTION 'Migration 011_reports_notifications.sql already applied — skipping';
  END IF;
END $$;

-- ── generated_reports — All system reports ──────────────────
CREATE TABLE generated_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  period_start      DATE,
  period_end        DATE,
  generated_by      TEXT,
  data              JSONB       NOT NULL DEFAULT '{}',
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_report_type CHECK (
    report_type IN (
      'daily_business_summary',
      'weekly_sales',
      'monthly_academic',
      'monthly_revenue',
      'teacher_performance',
      'session_report',
      'parent_monthly'
    )
  )
);

-- ── notification_log — All WhatsApp / email / push ──────────
CREATE TABLE notification_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel           TEXT        NOT NULL,
  recipient         TEXT        NOT NULL,
  template          TEXT        NOT NULL,
  payload           JSONB,
  status            TEXT        NOT NULL DEFAULT 'pending',
  sent_at           TIMESTAMPTZ,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_notif_channel CHECK (channel IN ('whatsapp', 'email', 'push')),
  CONSTRAINT chk_notif_status CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
);

-- ── Add recording columns to rooms ──────────────────────────
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS egress_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS recording_status TEXT DEFAULT 'none';

-- Add 'attention_update' and 'recording_started' to room_events valid types
-- We drop and recreate the constraint to add new valid event types
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
    'exam_submitted'
  )
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_reports_type ON generated_reports(report_type);
CREATE INDEX idx_reports_dates ON generated_reports(period_start, period_end);
CREATE INDEX idx_notif_channel ON notification_log(channel);
CREATE INDEX idx_notif_recipient ON notification_log(recipient);
CREATE INDEX idx_notif_status ON notification_log(status);
CREATE INDEX idx_rooms_recording ON rooms(recording_status);

INSERT INTO _migrations (filename) VALUES ('011_reports_notifications.sql');

COMMIT;
