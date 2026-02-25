-- Academic settings: configurable subjects, grades, sections, boards
CREATE TABLE IF NOT EXISTS academic_settings (
  setting_key   TEXT PRIMARY KEY,
  setting_values TEXT[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO academic_settings (setting_key, setting_values) VALUES
  ('subjects', ARRAY['Physics', 'Chemistry', 'Mathematics', 'Social Science', 'English', 'Malayalam', 'Arabic']),
  ('grades', ARRAY['1','2','3','4','5','6','7','8','9','10','11','12']),
  ('sections', ARRAY['A','B','C','D','E','F']),
  ('boards', ARRAY['CBSE', 'ICSE', 'State Board'])
ON CONFLICT (setting_key) DO NOTHING;
