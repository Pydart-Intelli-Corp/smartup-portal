// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Report Generator Service
// ═══════════════════════════════════════════════════════════════
// Generates reports: attendance, revenue, teacher performance,
// student progress, batch summary, exam analytics, payroll
//
// Usage:
//   import { generateReport, getReports } from '@/lib/reports';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────

export type ReportType =
  | 'attendance'
  | 'revenue'
  | 'teacher_performance'
  | 'student_progress'
  | 'batch_summary'
  | 'exam_analytics'
  | 'payroll_summary';

// ── Generate Report ─────────────────────────────────────────

export async function generateReport(
  reportType: ReportType,
  periodStart: string,
  periodEnd: string,
  createdBy: string,
  filters?: Record<string, string>
) {
  let data: Record<string, unknown> = {};
  let title = '';

  switch (reportType) {
    case 'attendance':
      ({ data, title } = await generateAttendanceReport(periodStart, periodEnd, filters));
      break;
    case 'revenue':
      ({ data, title } = await generateRevenueReport(periodStart, periodEnd));
      break;
    case 'teacher_performance':
      ({ data, title } = await generateTeacherPerformanceReport(periodStart, periodEnd));
      break;
    case 'student_progress':
      ({ data, title } = await generateStudentProgressReport(periodStart, periodEnd, filters));
      break;
    case 'batch_summary':
      ({ data, title } = await generateBatchSummaryReport(periodStart, periodEnd));
      break;
    case 'exam_analytics':
      ({ data, title } = await generateExamAnalyticsReport(periodStart, periodEnd));
      break;
    case 'payroll_summary':
      ({ data, title } = await generatePayrollSummaryReport(periodStart, periodEnd));
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  // Store report
  const result = await db.query(
    `INSERT INTO generated_reports (report_type, title, period_start, period_end, data, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [reportType, title, periodStart, periodEnd, JSON.stringify(data), createdBy]
  );

  return result.rows[0];
}

// ── Get Reports ─────────────────────────────────────────────

export async function getReports(filters?: {
  reportType?: string;
  limit?: number;
}) {
  let sql = `SELECT * FROM generated_reports WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.reportType) {
    params.push(filters.reportType);
    sql += ` AND report_type = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC`;
  params.push(filters?.limit || 50);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return result.rows;
}

export async function getReport(reportId: string) {
  const result = await db.query(`SELECT * FROM generated_reports WHERE id = $1`, [reportId]);
  return result.rows[0] || null;
}

// ═══════════════════════════════════════════════════════════════
// Report Generators
// ═══════════════════════════════════════════════════════════════

async function generateAttendanceReport(start: string, end: string, filters?: Record<string, string>) {
  // Total classes and attendance
  let roomFilter = '';
  const params: unknown[] = [start, end];

  if (filters?.grade) {
    params.push(filters.grade);
    roomFilter += ` AND r.grade = $${params.length}`;
  }
  if (filters?.subject) {
    params.push(filters.subject);
    roomFilter += ` AND r.subject = $${params.length}`;
  }

  const classesResult = await db.query(
    `SELECT COUNT(*) AS total_classes,
            COUNT(*) FILTER (WHERE r.status = 'ended') AS completed,
            COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled
     FROM rooms r
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2 ${roomFilter}`,
    params
  );

  // Student attendance per room
  const attendanceResult = await db.query(
    `SELECT re.participant_email,
            COUNT(*) FILTER (WHERE re.event_type = 'joined') AS classes_attended,
            pu.full_name
     FROM room_events re
     JOIN rooms r ON r.room_id = re.room_id
     LEFT JOIN portal_users pu ON pu.email = re.participant_email
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND re.event_type IN ('joined')
       AND re.participant_email NOT LIKE 'ghost_%'
     GROUP BY re.participant_email, pu.full_name
     ORDER BY classes_attended DESC`,
    [start, end]
  );

  const stats = classesResult.rows[0] as Record<string, string>;

  return {
    title: `Attendance Report (${start} to ${end})`,
    data: {
      summary: {
        total_classes: parseInt(stats.total_classes),
        completed: parseInt(stats.completed),
        cancelled: parseInt(stats.cancelled),
        period: { start, end },
      },
      students: attendanceResult.rows,
    },
  };
}

async function generateRevenueReport(start: string, end: string) {
  const revenueResult = await db.query(
    `SELECT
       COUNT(*) AS total_invoices,
       COUNT(*) FILTER (WHERE status = 'paid') AS paid_invoices,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending_invoices,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0) AS total_revenue_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0) AS pending_revenue_paise,
       currency
     FROM invoices
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY currency`,
    [start, end]
  );

  // Monthly breakdown
  const monthlyResult = await db.query(
    `SELECT
       TO_CHAR(paid_at, 'YYYY-MM') AS month,
       COUNT(*) AS payments,
       SUM(amount_paise) AS amount_paise
     FROM invoices
     WHERE status = 'paid'
       AND paid_at >= $1 AND paid_at <= $2
     GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
     ORDER BY month`,
    [start, end]
  );

  return {
    title: `Revenue Report (${start} to ${end})`,
    data: {
      by_currency: revenueResult.rows,
      monthly_breakdown: monthlyResult.rows,
    },
  };
}

async function generateTeacherPerformanceReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       r.teacher_email,
       pu.full_name AS teacher_name,
       COUNT(*) AS total_classes,
       COUNT(*) FILTER (WHERE r.status = 'ended') AS completed_classes,
       COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled_classes,
       AVG(r.duration_minutes) AS avg_duration,
       COUNT(DISTINCT ra.participant_email) FILTER (WHERE ra.participant_type = 'student') AS unique_students
     FROM rooms r
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND r.teacher_email IS NOT NULL
     GROUP BY r.teacher_email, pu.full_name
     ORDER BY completed_classes DESC`,
    [start, end]
  );

  return {
    title: `Teacher Performance Report (${start} to ${end})`,
    data: { teachers: result.rows },
  };
}

async function generateStudentProgressReport(start: string, end: string, filters?: Record<string, string>) {
  let studentFilter = '';
  const params: unknown[] = [start, end];

  if (filters?.studentEmail) {
    params.push(filters.studentEmail);
    studentFilter = ` AND ea.student_email = $${params.length}`;
  }

  // Exam performance
  const examResult = await db.query(
    `SELECT
       ea.student_email,
       pu.full_name AS student_name,
       COUNT(*) AS exams_taken,
       AVG(ea.percentage) AS avg_percentage,
       MAX(ea.percentage) AS best_percentage,
       MIN(ea.percentage) AS worst_percentage,
       COUNT(*) FILTER (WHERE ea.percentage >= e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS exams_passed
     FROM exam_attempts ea
     JOIN exams e ON e.id = ea.exam_id
     LEFT JOIN portal_users pu ON pu.email = ea.student_email
     WHERE ea.created_at >= $1 AND ea.created_at <= $2
       ${studentFilter}
     GROUP BY ea.student_email, pu.full_name
     ORDER BY avg_percentage DESC`,
    params
  );

  // Attendance
  const attendanceResult = await db.query(
    `SELECT
       re.participant_email AS student_email,
       COUNT(DISTINCT re.room_id) AS classes_attended
     FROM room_events re
     JOIN rooms r ON r.room_id = re.room_id
     WHERE re.event_type = 'joined'
       AND r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND re.participant_email NOT LIKE 'ghost_%'
     GROUP BY re.participant_email`,
    [start, end]
  );

  return {
    title: `Student Progress Report (${start} to ${end})`,
    data: {
      exam_performance: examResult.rows,
      attendance: attendanceResult.rows,
    },
  };
}

async function generateBatchSummaryReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       r.room_name AS batch_name,
       r.subject,
       r.grade,
       r.status,
       r.scheduled_start,
       r.duration_minutes,
       r.teacher_email,
       pu.full_name AS teacher_name,
       COUNT(DISTINCT ra.participant_email) FILTER (WHERE ra.participant_type = 'student') AS student_count,
       COUNT(DISTINCT re.participant_email) FILTER (WHERE re.event_type = 'joined') AS active_students
     FROM rooms r
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id
     LEFT JOIN room_events re ON re.room_id = r.room_id AND re.event_type = 'joined'
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
     GROUP BY r.room_id, r.room_name, r.subject, r.grade, r.status, r.scheduled_start,
              r.duration_minutes, r.teacher_email, pu.full_name
     ORDER BY r.scheduled_start DESC`,
    [start, end]
  );

  return {
    title: `Batch Summary Report (${start} to ${end})`,
    data: { batches: result.rows },
  };
}

async function generateExamAnalyticsReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       e.id, e.title, e.subject, e.grade,
       e.total_marks, e.passing_marks,
       COUNT(ea.id) AS total_attempts,
       AVG(ea.percentage) AS avg_percentage,
       MAX(ea.percentage) AS highest_percentage,
       MIN(ea.percentage) AS lowest_percentage,
       COUNT(*) FILTER (WHERE ea.percentage >= e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS passed,
       COUNT(*) FILTER (WHERE ea.percentage < e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS failed
     FROM exams e
     LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.status = 'graded'
     WHERE e.created_at >= $1 AND e.created_at <= $2
     GROUP BY e.id, e.title, e.subject, e.grade, e.total_marks, e.passing_marks
     ORDER BY e.created_at DESC`,
    [start, end]
  );

  return {
    title: `Exam Analytics Report (${start} to ${end})`,
    data: { exams: result.rows },
  };
}

async function generatePayrollSummaryReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       pp.period_label,
       pp.status AS period_status,
       COUNT(ps.id) AS teacher_count,
       COALESCE(SUM(ps.base_pay_paise), 0) AS total_base_pay,
       COALESCE(SUM(ps.incentive_paise), 0) AS total_incentives,
       COALESCE(SUM(ps.lop_paise), 0) AS total_lop,
       COALESCE(SUM(ps.total_paise), 0) AS total_payroll,
       COALESCE(SUM(ps.classes_conducted), 0) AS total_classes_conducted,
       COALESCE(SUM(ps.classes_missed), 0) AS total_classes_missed
     FROM payroll_periods pp
     LEFT JOIN payslips ps ON ps.payroll_period_id = pp.id
     WHERE pp.start_date >= $1 AND pp.end_date <= $2
     GROUP BY pp.id, pp.period_label, pp.status
     ORDER BY pp.start_date DESC`,
    [start, end]
  );

  return {
    title: `Payroll Summary Report (${start} to ${end})`,
    data: { periods: result.rows },
  };
}
