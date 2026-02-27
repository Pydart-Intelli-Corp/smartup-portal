-- 
-- SmartUp Portal — Migration 028: Session Payment Structure
-- Per-hour session rates per batch/subject for payment gating
-- 

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '028_session_payment_structure.sql') THEN
    RAISE EXCEPTION 'Migration 028_session_payment_structure.sql already applied — skipping';
  END IF;
END $$;

--  session_fee_rates — Per-batch/subject hourly rates 
CREATE TABLE IF NOT EXISTS session_fee_rates (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            TEXT        REFERENCES batches(batch_id) ON DELETE CASCADE,
  subject             TEXT,
  grade               TEXT,
  per_hour_rate_paise INTEGER     NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'INR',
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  notes               TEXT,
  created_by          TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sfr_currency CHECK (currency IN ('INR','AED','SAR','QAR','KWD','OMR','BHD','USD'))
);

CREATE TRIGGER trg_session_fee_rates_updated_at
  BEFORE UPDATE ON session_fee_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

--  Add session payment columns to rooms 
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS session_fee_paise INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT false;

--  Add payment_verified to room_assignments 
ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false;
ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS session_invoice_id UUID;

--  session_payments — Per-session payment records 
CREATE TABLE IF NOT EXISTS session_payments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT        NOT NULL,
  student_email       TEXT        NOT NULL,
  parent_email        TEXT,
  invoice_id          UUID        REFERENCES invoices(id),
  amount_paise        INTEGER     NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'INR',
  status              TEXT        NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  payment_method      TEXT,
  transaction_id      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sp_status CHECK (status IN ('pending','paid','failed','refunded')),
  UNIQUE(room_id, student_email)
);

--  Indexes 
CREATE INDEX IF NOT EXISTS idx_sfr_batch    ON session_fee_rates(batch_id);
CREATE INDEX IF NOT EXISTS idx_sfr_active   ON session_fee_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_sfr_subject  ON session_fee_rates(subject);
CREATE INDEX IF NOT EXISTS idx_sp_room      ON session_payments(room_id);
CREATE INDEX IF NOT EXISTS idx_sp_student   ON session_payments(student_email);
CREATE INDEX IF NOT EXISTS idx_sp_status    ON session_payments(status);
CREATE INDEX IF NOT EXISTS idx_sp_invoice   ON session_payments(invoice_id);

INSERT INTO _migrations (filename) VALUES ('028_session_payment_structure.sql');

COMMIT;
