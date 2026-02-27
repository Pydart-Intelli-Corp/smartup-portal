-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 033: Create System Room
-- Creates a 'system' room row for logging system-level events
-- (admission_status_change etc.) in room_events table.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO rooms (
  room_id, room_name, subject, grade, coordinator_email,
  status, scheduled_start, duration_minutes, open_at, expires_at
) VALUES (
  'system', 'System Events', 'system', 'system', 'system@smartup.local',
  'ended', '2099-01-01', 1, '2099-01-01', '2099-12-31'
) ON CONFLICT (room_id) DO NOTHING;
