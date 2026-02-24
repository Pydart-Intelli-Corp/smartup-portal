-- ═══════════════════════════════════════════════════════════════
-- SmartUp Portal — Migration 010: Payroll System
-- Tables: teacher_pay_config, payroll_periods, payslips
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = '010_payroll.sql') THEN
    RAISE EXCEPTION 'Migration 010_payroll.sql already applied — skipping';
  END IF;
END $$;

-- ── teacher_pay_config — Per-teacher salary settings ────────
CREATE TABLE teacher_pay_config (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email     TEXT        NOT NULL UNIQUE,
  rate_per_class    INTEGER     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'INR',
  incentive_rules   JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_teacher_pay_updated_at
  BEFORE UPDATE ON teacher_pay_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── payroll_periods — Monthly payroll runs ──────────────────
CREATE TABLE payroll_periods (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label      TEXT        NOT NULL,
  period_start      DATE        NOT NULL,
  period_end        DATE        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'draft',
  finalized_at      TIMESTAMPTZ,
  finalized_by      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payroll_status CHECK (status IN ('draft', 'finalized', 'paid'))
);

-- ── payslips — Individual teacher payslip ───────────────────
CREATE TABLE payslips (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id   UUID        NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  teacher_email       TEXT        NOT NULL,
  teacher_name        TEXT        NOT NULL,
  classes_conducted   INTEGER     NOT NULL DEFAULT 0,
  classes_missed      INTEGER     NOT NULL DEFAULT 0,
  classes_cancelled   INTEGER     NOT NULL DEFAULT 0,
  rate_per_class      INTEGER     NOT NULL,
  base_pay_paise      INTEGER     NOT NULL DEFAULT 0,
  incentive_paise     INTEGER     DEFAULT 0,
  loss_of_pay_paise   INTEGER     DEFAULT 0,
  total_pay_paise     INTEGER     NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'INR',
  notes               TEXT,
  pdf_url             TEXT,
  status              TEXT        NOT NULL DEFAULT 'draft',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_payslip_status CHECK (status IN ('draft', 'finalized', 'paid')),
  CONSTRAINT uq_payslip UNIQUE (payroll_period_id, teacher_email)
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_payslips_teacher ON payslips(teacher_email);
CREATE INDEX idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX idx_teacher_pay_config_email ON teacher_pay_config(teacher_email);

INSERT INTO _migrations (filename) VALUES ('010_payroll.sql');

COMMIT;
