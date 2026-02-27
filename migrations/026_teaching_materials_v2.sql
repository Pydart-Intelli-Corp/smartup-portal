-- ═══════════════════════════════════════════════════════════════
-- 026 · Teaching Materials v2 — add file metadata columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE teaching_materials
  ADD COLUMN IF NOT EXISTS file_size  BIGINT,       -- bytes
  ADD COLUMN IF NOT EXISTS mime_type  TEXT;         -- e.g. application/pdf

-- Make batch_id required going forward (backfill any NULLs first)
-- DELETE FROM teaching_materials WHERE batch_id IS NULL;
-- ALTER TABLE teaching_materials ALTER COLUMN batch_id SET NOT NULL;
