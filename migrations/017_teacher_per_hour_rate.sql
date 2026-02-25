-- Migration 017: Add per_hour_rate to user_profiles for teachers
-- Stores the per-hour teaching rate set by HR when creating/editing a teacher.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS per_hour_rate INTEGER;  -- Amount in smallest currency unit (e.g. paise/fils)

COMMENT ON COLUMN user_profiles.per_hour_rate IS 'Teacher per-hour rate set by HR';
