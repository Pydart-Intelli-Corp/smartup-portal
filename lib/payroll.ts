// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Payroll Service
// ═══════════════════════════════════════════════════════════════
// Teacher salary calculation, payslip generation, and management
//
// Usage:
//   import { calculatePayroll, generatePayslips, ... } from '@/lib/payroll';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────

export interface TeacherPayConfig {
  teacher_email: string;
  rate_per_class: number;
  incentive_rules: Record<string, unknown>;
}

export interface PayslipInput {
  payrollPeriodId: string;
  teacherEmail: string;
  classesConducted: number;
  classesMissed: number;
  classesCancelled: number;
  ratePerClass: number;
  incentivePaise?: number;
  lopPaise?: number;
}

// ── Teacher Pay Config CRUD ─────────────────────────────────

export async function getTeacherPayConfig(teacherEmail: string) {
  const result = await db.query(
    `SELECT * FROM teacher_pay_config WHERE teacher_email = $1`,
    [teacherEmail]
  );
  return result.rows[0] || null;
}

export async function getAllPayConfigs() {
  const result = await db.query(
    `SELECT tpc.*, pu.full_name AS teacher_name
     FROM teacher_pay_config tpc
     LEFT JOIN portal_users pu ON pu.email = tpc.teacher_email
     ORDER BY pu.full_name`
  );
  return result.rows;
}

export async function upsertPayConfig(teacherEmail: string, ratePerClass: number, incentiveRules?: Record<string, unknown>) {
  const result = await db.query(
    `INSERT INTO teacher_pay_config (teacher_email, rate_per_class, incentive_rules)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (teacher_email) DO UPDATE
     SET rate_per_class = $2, incentive_rules = $3::jsonb, updated_at = NOW()
     RETURNING *`,
    [teacherEmail, ratePerClass, JSON.stringify(incentiveRules || {})]
  );
  return result.rows[0];
}

// ── Payroll Period CRUD ─────────────────────────────────────

export async function createPayrollPeriod(periodLabel: string, startDate: string, endDate: string) {
  const result = await db.query(
    `INSERT INTO payroll_periods (period_label, start_date, end_date, status)
     VALUES ($1, $2, $3, 'draft')
     RETURNING *`,
    [periodLabel, startDate, endDate]
  );
  return result.rows[0];
}

export async function getPayrollPeriods() {
  const result = await db.query(
    `SELECT pp.*,
            (SELECT COUNT(*) FROM payslips WHERE payroll_period_id = pp.id) AS payslip_count,
            (SELECT COALESCE(SUM(total_paise), 0) FROM payslips WHERE payroll_period_id = pp.id) AS total_paise
     FROM payroll_periods pp
     ORDER BY pp.start_date DESC`
  );
  return result.rows;
}

export async function getPayrollPeriod(periodId: string) {
  const result = await db.query(
    `SELECT * FROM payroll_periods WHERE id = $1`,
    [periodId]
  );
  return result.rows[0];
}

// ── Calculate and Generate Payslips ─────────────────────────

export async function generatePayslips(periodId: string) {
  return db.withTransaction(async (client) => {
    // Get period details
    const periodResult = await client.query(
      `SELECT * FROM payroll_periods WHERE id = $1 AND status = 'draft'`,
      [periodId]
    );
    if (periodResult.rows.length === 0) {
      throw new Error('Payroll period not found or already finalized');
    }
    const period = periodResult.rows[0];

    // Get all teachers with pay configs
    const teacherConfigs = await client.query(
      `SELECT tpc.*, pu.full_name AS teacher_name
       FROM teacher_pay_config tpc
       LEFT JOIN portal_users pu ON pu.email = tpc.teacher_email`
    );

    const payslips = [];

    for (const config of teacherConfigs.rows as Array<Record<string, unknown>>) {
      const teacherEmail = config.teacher_email as string;
      const ratePerClass = config.rate_per_class as number;

      // Count classes conducted in this period
      const classesResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE r.status = 'ended') AS conducted,
           COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled,
           COUNT(*) FILTER (WHERE r.status = 'scheduled' AND r.scheduled_start < NOW()) AS missed
         FROM rooms r
         WHERE r.teacher_email = $1
           AND r.scheduled_start >= $2
           AND r.scheduled_start <= $3`,
        [teacherEmail, period.start_date, period.end_date]
      );

      const stats = classesResult.rows[0] as Record<string, string>;
      const classesConducted = parseInt(stats.conducted || '0');
      const classesCancelled = parseInt(stats.cancelled || '0');
      const classesMissed = parseInt(stats.missed || '0');

      // Calculate pay
      const basePay = classesConducted * ratePerClass;

      // Incentive: extra per class if more than 20 classes
      const incentiveRules = config.incentive_rules as Record<string, unknown>;
      let incentive = 0;
      const bonusThreshold = (incentiveRules?.bonus_threshold as number) || 20;
      const bonusPerClass = (incentiveRules?.bonus_per_class as number) || 50;
      if (classesConducted > bonusThreshold) {
        incentive = (classesConducted - bonusThreshold) * bonusPerClass;
      }

      // LOP (Loss of Pay) for missed classes
      const lop = classesMissed * Math.floor(ratePerClass * 0.5);

      const totalPaise = basePay + incentive - lop;

      // Insert payslip
      const slipResult = await client.query(
        `INSERT INTO payslips (
           payroll_period_id, teacher_email, classes_conducted,
           classes_missed, classes_cancelled, rate_per_class,
           base_pay_paise, incentive_paise, lop_paise, total_paise, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
         ON CONFLICT (payroll_period_id, teacher_email) DO UPDATE
         SET classes_conducted = $3, classes_missed = $4, classes_cancelled = $5,
             rate_per_class = $6, base_pay_paise = $7, incentive_paise = $8,
             lop_paise = $9, total_paise = $10, updated_at = NOW()
         RETURNING *`,
        [
          periodId, teacherEmail, classesConducted,
          classesMissed, classesCancelled, ratePerClass,
          basePay, incentive, lop, totalPaise,
        ]
      );

      payslips.push(slipResult.rows[0]);
    }

    return payslips;
  });
}

// ── Get Payslips for a Period ────────────────────────────────

export async function getPayslipsForPeriod(periodId: string) {
  const result = await db.query(
    `SELECT ps.*, pu.full_name AS teacher_name, pp.period_label
     FROM payslips ps
     LEFT JOIN portal_users pu ON pu.email = ps.teacher_email
     LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
     WHERE ps.payroll_period_id = $1
     ORDER BY pu.full_name`,
    [periodId]
  );
  return result.rows;
}

// ── Get Teacher Payslips ────────────────────────────────────

export async function getTeacherPayslips(teacherEmail: string) {
  const result = await db.query(
    `SELECT ps.*, pp.period_label, pp.start_date, pp.end_date
     FROM payslips ps
     JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
     WHERE ps.teacher_email = $1
     ORDER BY pp.start_date DESC`,
    [teacherEmail]
  );
  return result.rows;
}

// ── Finalize Payroll ────────────────────────────────────────

export async function finalizePayroll(periodId: string) {
  return db.withTransaction(async (client) => {
    // Update period status
    await client.query(
      `UPDATE payroll_periods SET status = 'finalized' WHERE id = $1`,
      [periodId]
    );

    // Update all payslips to finalized
    await client.query(
      `UPDATE payslips SET status = 'finalized' WHERE payroll_period_id = $1`,
      [periodId]
    );

    return { success: true };
  });
}

// ── Mark as Paid ────────────────────────────────────────────

export async function markPayrollPaid(periodId: string) {
  return db.withTransaction(async (client) => {
    await client.query(
      `UPDATE payroll_periods SET status = 'paid' WHERE id = $1`,
      [periodId]
    );
    await client.query(
      `UPDATE payslips SET status = 'paid' WHERE payroll_period_id = $1`,
      [periodId]
    );
    return { success: true };
  });
}
