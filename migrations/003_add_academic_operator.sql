-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 003: Add academic_operator role
-- Separates Academic Operator (room creation) from Batch
-- Coordinator (monitoring/communication).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '003_add_academic_operator.sql') THEN
    RAISE EXCEPTION 'Migration 003_add_academic_operator.sql already applied — skipping';
  END IF;
END $$;

-- 1. Drop the old check constraint on portal_users
ALTER TABLE portal_users
  DROP CONSTRAINT IF EXISTS chk_portal_role;

-- 2. Re-add with academic_operator included
ALTER TABLE portal_users
  ADD CONSTRAINT chk_portal_role CHECK (
    portal_role IN ('teacher', 'student', 'coordinator', 'academic_operator', 'academic', 'parent', 'owner', 'ghost')
  );

-- 3. Re-map existing 'academic' users → 'academic_operator'
--    (The 'academic' role was the original room-creation role.
--     Going forward 'academic' is legacy-only.)
UPDATE portal_users
  SET portal_role = 'academic_operator'
  WHERE portal_role = 'academic';

-- Record migration
INSERT INTO _migrations (filename) VALUES ('003_add_academic_operator.sql');

COMMIT;
