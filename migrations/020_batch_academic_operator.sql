-- Migration 020: Add academic_operator_email to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS academic_operator_email TEXT;
