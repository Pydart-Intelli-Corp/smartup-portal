-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 009: Payment, Invoice & Fee System
-- Tables: fee_structures, invoices, payment_receipts
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '009_payment_invoices.sql') THEN
    RAISE EXCEPTION 'Migration 009_payment_invoices.sql already applied — skipping';
  END IF;
END $$;

-- ── fee_structures — Owner-configured fee rates ─────────────
CREATE TABLE fee_structures (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type        TEXT        NOT NULL,
  grade             TEXT,
  subject           TEXT,
  amount_paise      INTEGER     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'INR',
  billing_period    TEXT        NOT NULL DEFAULT 'monthly',
  registration_fee  INTEGER     DEFAULT 0,
  security_deposit  INTEGER     DEFAULT 0,
  is_active         BOOLEAN     DEFAULT true,
  created_by        TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_fee_batch_type CHECK (batch_type IN ('one_to_one', 'one_to_three', 'one_to_many')),
  CONSTRAINT chk_fee_currency CHECK (currency IN ('INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD')),
  CONSTRAINT chk_fee_period CHECK (billing_period IN ('monthly', 'quarterly', 'yearly'))
);

CREATE TRIGGER trg_fee_structures_updated_at
  BEFORE UPDATE ON fee_structures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── invoices — Generated billing records ────────────────────
CREATE TABLE invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT        NOT NULL UNIQUE,
  student_email     TEXT        NOT NULL,
  parent_email      TEXT,
  description       TEXT,
  billing_period    TEXT        NOT NULL DEFAULT 'monthly',
  period_start      DATE        NOT NULL,
  period_end        DATE        NOT NULL,
  amount_paise      INTEGER     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'INR',
  status            TEXT        NOT NULL DEFAULT 'pending',
  due_date          DATE        NOT NULL,
  paid_at           TIMESTAMPTZ,
  payment_method    TEXT,
  transaction_id    TEXT,
  gateway_order_id  TEXT,
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_invoice_status CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  CONSTRAINT chk_invoice_currency CHECK (currency IN ('INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'))
);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── payment_receipts — After successful payment ─────────────
CREATE TABLE payment_receipts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    TEXT        NOT NULL UNIQUE,
  invoice_id        UUID        REFERENCES invoices(id),
  student_email     TEXT        NOT NULL,
  amount_paise      INTEGER     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'INR',
  payment_method    TEXT,
  transaction_id    TEXT,
  gateway_response  JSONB,
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_invoices_student ON invoices(student_email);
CREATE INDEX idx_invoices_parent ON invoices(parent_email);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
CREATE INDEX idx_receipts_student ON payment_receipts(student_email);
CREATE INDEX idx_receipts_invoice ON payment_receipts(invoice_id);
CREATE INDEX idx_fee_structures_active ON fee_structures(is_active);

INSERT INTO _migrations (filename) VALUES ('009_payment_invoices.sql');

COMMIT;
