-- 023_attendance_confirmed.sql — Add attendance_confirmed column to student_feedback
-- Run via: npm run db:migrate

ALTER TABLE student_feedback
  ADD COLUMN IF NOT EXISTS attendance_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
