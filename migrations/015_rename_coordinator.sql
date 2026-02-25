-- ═══════════════════════════════════════════════════════════════
-- Migration 015: Rename role 'coordinator' → 'batch_coordinator'
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Drop ALL existing role constraints first (before updating data)
ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS chk_portal_role;
ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS portal_users_portal_role_check;

-- Step 2: Update existing users
UPDATE portal_users SET portal_role = 'batch_coordinator' WHERE portal_role = 'coordinator';

-- Step 3: Add new constraint with batch_coordinator
ALTER TABLE portal_users ADD CONSTRAINT portal_users_portal_role_check
  CHECK (portal_role IN (
    'teacher', 'teacher_screen', 'student',
    'batch_coordinator', 'academic_operator', 'academic',
    'hr', 'parent', 'owner', 'ghost'
  ));

-- Step 4: Update cancellation_requests if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cancellation_requests') THEN
    ALTER TABLE cancellation_requests DROP CONSTRAINT IF EXISTS cancellation_requests_requester_role_check;
    ALTER TABLE cancellation_requests ADD CONSTRAINT cancellation_requests_requester_role_check
      CHECK (requester_role IN ('parent', 'student', 'teacher', 'batch_coordinator'));
  END IF;
END $$;
