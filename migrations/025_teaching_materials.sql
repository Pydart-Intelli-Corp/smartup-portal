-- ═══════════════════════════════════════════════════════════════
-- 025 · Teaching Materials
-- Uploaded by academic operators; visible to assigned teachers.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS teaching_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        TEXT REFERENCES batches(batch_id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  material_type   TEXT NOT NULL DEFAULT 'notes',
  uploaded_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teaching_materials_batch   ON teaching_materials(batch_id);
CREATE INDEX IF NOT EXISTS idx_teaching_materials_subject ON teaching_materials(subject);
CREATE INDEX IF NOT EXISTS idx_teaching_materials_uploader ON teaching_materials(uploaded_by);
