-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 005: Remove Frappe Columns & Tables
-- Frappe ERP integration has been removed.
-- Portal is now fully standalone (Next.js + PostgreSQL).
--
-- NOTE: Some tables may be owned by a different DB user (e.g. postgres).
--       This migration uses EXCEPTION handlers to skip those gracefully.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '005_remove_frappe_columns.sql') THEN
    RAISE EXCEPTION 'Migration 005_remove_frappe_columns.sql already applied — skipping';
  END IF;
END $$;

-- ── 1. Drop frappe_sync_log table (if it exists) ────────────
DROP TABLE IF EXISTS frappe_sync_log CASCADE;

-- ── 2. Drop frappe columns (with error handling per table) ──
DO $$ BEGIN
  ALTER TABLE portal_users DROP COLUMN IF EXISTS frappe_role;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping portal_users.frappe_role — insufficient privileges';
END $$;

DO $$ BEGIN
  ALTER TABLE portal_users DROP COLUMN IF EXISTS frappe_synced_at;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping portal_users.frappe_synced_at — insufficient privileges';
END $$;

DO $$ BEGIN
  ALTER TABLE room_assignments DROP COLUMN IF EXISTS frappe_user_id;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping room_assignments.frappe_user_id — insufficient privileges';
END $$;

DO $$ BEGIN
  ALTER TABLE payment_attempts DROP COLUMN IF EXISTS student_frappe_id;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping payment_attempts.student_frappe_id — insufficient privileges';
END $$;

DO $$ BEGIN
  ALTER TABLE rooms DROP COLUMN IF EXISTS frappe_doc_name;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping rooms.frappe_doc_name — insufficient privileges';
END $$;

-- ── 3. Drop related indexes (if they exist) ─────────────────
DROP INDEX IF EXISTS idx_portal_users_frappe_role;
DROP INDEX IF EXISTS idx_rooms_frappe_doc;

-- Record migration
INSERT INTO _migrations (filename) VALUES ('005_remove_frappe_columns.sql');

COMMIT;
