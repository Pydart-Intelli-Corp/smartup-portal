// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Monitoring Reports Library
// ═══════════════════════════════════════════════════════════════
// Generates daily, weekly, monthly reports for students + teachers.
// Parent monthly report includes MediaPipe AI attention summary.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type ReportType =
  | 'student_daily'
  | 'student_weekly'
  | 'student_monthly'
  | 'teacher_daily'
  | 'teacher_weekly'
  | 'teacher_monthly';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface StudentReportMetrics {
  attendance_rate: number;
  avg_attention_score: number;
  total_classes: number;
  classes_attended: number;
  time_in_class_minutes: number;
  looking_away_minutes: number;
  eyes_closed_minutes: number;
  not_in_frame_minutes: number;
  distracted_minutes: number;
  hand_raises: number;
  alerts_count: number;
  engagement_trend: number[];     // daily scores array
  top_subjects: string[];
  weak_subjects: string[];
  overall_summary: string;        // AI behavior summary for parent
}

export interface TeacherReportMetrics {
  sessions_conducted: number;
  sessions_cancelled: number;
  sessions_scheduled: number;
  avg_start_delay_minutes: number;
  on_time_rate: number;
  avg_class_duration_minutes: number;
  avg_student_engagement: number;
  camera_off_incidents: number;
  total_teaching_hours: number;
  late_starts: number;
  late_by_total_minutes: number;
  batches: string[];
  overall_summary: string;
}

export interface MonitoringReport {
  [key: string]: unknown;
  id: string;
  report_type: ReportType;
  report_period: ReportPeriod;
  period_start: string;
  period_end: string;
  target_email: string;
  target_role: string;
  target_name: string | null;
  batch_id: string | null;
  batch_name: string | null;
  grade: string | null;
  section: string | null;
  metrics: StudentReportMetrics | TeacherReportMetrics;
  sent_to_parent: boolean;
  parent_email: string | null;
  sent_at: string | null;
  generated_by: string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════
   STUDENT REPORT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a student report for a given period.
 * Aggregates monitoring events, attendance, and alerts.
 */
export async function generateStudentReport(params: {
  student_email: string;
  period: ReportPeriod;
  period_start: string;   // YYYY-MM-DD
  period_end: string;      // YYYY-MM-DD
  batch_id?: string;
}): Promise<string> {
  const { student_email, period, period_start, period_end, batch_id } = params;

  // Get student info
  const userResult = await db.query<{ name: string; email: string }>(
    `SELECT name, email FROM portal_users WHERE email = $1`,
    [student_email]
  );
  const studentName = userResult.rows[0]?.name || student_email.split('@')[0];

  // Get batch info if available
  let batchName: string | null = null;
  let grade: string | null = null;
  let section: string | null = null;
  if (batch_id) {
    const batchResult = await db.query<{ name: string; grade: string; section: string }>(
      `SELECT name, grade, section FROM batches WHERE id = $1`,
      [batch_id]
    );
    if (batchResult.rows[0]) {
      batchName = batchResult.rows[0].name;
      grade = batchResult.rows[0].grade;
      section = batchResult.rows[0].section;
    }
  }

  // Monitoring events aggregation
  const eventsAgg = await db.query<{
    total_events: string;
    attentive_sec: string;
    looking_away_sec: string;
    eyes_closed_sec: string;
    not_in_frame_sec: string;
    distracted_sec: string;
    hand_raises: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_events,
       COALESCE(SUM(CASE WHEN event_type = 'attentive' THEN duration_seconds ELSE 0 END), 0)::TEXT AS attentive_sec,
       COALESCE(SUM(CASE WHEN event_type = 'looking_away' THEN duration_seconds ELSE 0 END), 0)::TEXT AS looking_away_sec,
       COALESCE(SUM(CASE WHEN event_type = 'eyes_closed' THEN duration_seconds ELSE 0 END), 0)::TEXT AS eyes_closed_sec,
       COALESCE(SUM(CASE WHEN event_type = 'not_in_frame' THEN duration_seconds ELSE 0 END), 0)::TEXT AS not_in_frame_sec,
       COALESCE(SUM(CASE WHEN event_type = 'distracted' THEN duration_seconds ELSE 0 END), 0)::TEXT AS distracted_sec,
       COALESCE(SUM(CASE WHEN event_type = 'hand_raised' THEN 1 ELSE 0 END), 0)::TEXT AS hand_raises
     FROM class_monitoring_events
     WHERE student_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  const agg = eventsAgg.rows[0];
  const attentiveSec = parseInt(agg?.attentive_sec || '0', 10);
  const lookingAwaySec = parseInt(agg?.looking_away_sec || '0', 10);
  const eyesClosedSec = parseInt(agg?.eyes_closed_sec || '0', 10);
  const notInFrameSec = parseInt(agg?.not_in_frame_sec || '0', 10);
  const distractedSec = parseInt(agg?.distracted_sec || '0', 10);
  const totalMonitoredSec = attentiveSec + lookingAwaySec + eyesClosedSec + notInFrameSec + distractedSec;
  const avgAttention = totalMonitoredSec > 0 ? Math.round((attentiveSec / totalMonitoredSec) * 100) : 0;

  // Attendance from attendance_sessions
  const attendance = await db.query<{
    total_sessions: string;
    sessions_present: string;
    total_time_min: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_sessions,
       COUNT(CASE WHEN status IN ('present','late') THEN 1 END)::TEXT AS sessions_present,
       COALESCE(SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 60), 0)::TEXT AS total_time_min
     FROM attendance_sessions
     WHERE student_email = $1
       AND session_date >= $2::DATE
       AND session_date <= $3::DATE`,
    [student_email, period_start, period_end]
  );

  const totalSessions = parseInt(attendance.rows[0]?.total_sessions || '0', 10);
  const sessionsPresent = parseInt(attendance.rows[0]?.sessions_present || '0', 10);
  const attendanceRate = totalSessions > 0 ? Math.round((sessionsPresent / totalSessions) * 100) : 0;
  const timeInClass = Math.round(parseFloat(attendance.rows[0]?.total_time_min || '0'));

  // Alerts count
  const alertsCount = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_alerts
     WHERE target_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  // Daily engagement trend (for weekly/monthly reports)
  const trendResult = await db.query<{ day: string; score: string }>(
    `SELECT
       DATE(created_at) AS day,
       CASE
         WHEN SUM(duration_seconds) > 0
         THEN ROUND((SUM(CASE WHEN event_type = 'attentive' THEN duration_seconds ELSE 0 END)::NUMERIC
                      / NULLIF(SUM(duration_seconds), 0)) * 100)
         ELSE 0
       END::TEXT AS score
     FROM class_monitoring_events
     WHERE student_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')
     GROUP BY DATE(created_at)
     ORDER BY day`,
    [student_email, period_start, period_end]
  );
  const engagementTrend = trendResult.rows.map((r) => parseInt(r.score, 10));

  // Generate overall summary for parent
  const overallSummary = generateStudentSummaryText({
    name: studentName,
    attendanceRate,
    avgAttention,
    eyesClosedMin: Math.round(eyesClosedSec / 60),
    lookingAwayMin: Math.round(lookingAwaySec / 60),
    distractedMin: Math.round(distractedSec / 60),
    handRaises: parseInt(agg?.hand_raises || '0', 10),
    totalSessions,
    sessionsPresent,
  });

  const metrics: StudentReportMetrics = {
    attendance_rate: attendanceRate,
    avg_attention_score: avgAttention,
    total_classes: totalSessions,
    classes_attended: sessionsPresent,
    time_in_class_minutes: timeInClass,
    looking_away_minutes: Math.round(lookingAwaySec / 60),
    eyes_closed_minutes: Math.round(eyesClosedSec / 60),
    not_in_frame_minutes: Math.round(notInFrameSec / 60),
    distracted_minutes: Math.round(distractedSec / 60),
    hand_raises: parseInt(agg?.hand_raises || '0', 10),
    alerts_count: parseInt(alertsCount.rows[0]?.cnt || '0', 10),
    engagement_trend: engagementTrend,
    top_subjects: [],
    weak_subjects: [],
    overall_summary: overallSummary,
  };

  const reportType: ReportType = `student_${period}` as ReportType;

  // Upsert — replace existing report for same period
  const result = await db.query<{ id: string }>(
    `INSERT INTO monitoring_reports
      (report_type, report_period, period_start, period_end,
       target_email, target_role, target_name,
       batch_id, batch_name, grade, section, metrics, generated_by)
     VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'student', $6, $7, $8, $9, $10, $11, 'system')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      reportType, period, period_start, period_end,
      student_email, studentName,
      batch_id || null, batchName, grade, section,
      JSON.stringify(metrics),
    ]
  );

  // Fallback if ON CONFLICT skips: just insert with new ID
  if (result.rows.length === 0) {
    const insertResult = await db.query<{ id: string }>(
      `INSERT INTO monitoring_reports
        (report_type, report_period, period_start, period_end,
         target_email, target_role, target_name,
         batch_id, batch_name, grade, section, metrics, generated_by)
       VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'student', $6, $7, $8, $9, $10, $11, 'system')
       RETURNING id`,
      [
        reportType, period, period_start, period_end,
        student_email, studentName,
        batch_id || null, batchName, grade, section,
        JSON.stringify(metrics),
      ]
    );
    return insertResult.rows[0]?.id || 'unknown';
  }

  return result.rows[0]?.id || 'unknown';
}

/* ═══════════════════════════════════════════════════════════════
   TEACHER REPORT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a teacher report for the given period.
 * Tracks: sessions conducted, cancelled, late starts, camera off, student engagement.
 */
export async function generateTeacherReport(params: {
  teacher_email: string;
  period: ReportPeriod;
  period_start: string;
  period_end: string;
}): Promise<string> {
  const { teacher_email, period, period_start, period_end } = params;

  // Get teacher info
  const userResult = await db.query<{ name: string }>(
    `SELECT name FROM portal_users WHERE email = $1`,
    [teacher_email]
  );
  const teacherName = userResult.rows[0]?.name || teacher_email.split('@')[0];

  // Sessions from rooms table (teacher is assigned)
  const sessionsResult = await db.query<{
    total_scheduled: string;
    total_live_or_ended: string;
    total_cancelled: string;
    total_duration_min: string;
    late_starts: string;
    late_by_total_sec: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_scheduled,
       COUNT(CASE WHEN r.status IN ('live','ended') THEN 1 END)::TEXT AS total_live_or_ended,
       COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END)::TEXT AS total_cancelled,
       COALESCE(SUM(CASE WHEN r.status IN ('live','ended') THEN r.duration_minutes ELSE 0 END), 0)::TEXT AS total_duration_min,
       COUNT(CASE WHEN re_late.id IS NOT NULL THEN 1 END)::TEXT AS late_starts,
       COALESCE(SUM(EXTRACT(EPOCH FROM (re_join.created_at - r.scheduled_start))), 0)::TEXT AS late_by_total_sec
     FROM rooms r
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher'
     LEFT JOIN room_events re_late ON re_late.room_id = r.room_id AND re_late.event_type = 'monitoring_alert'
       AND re_late.details->>'alert_type' = 'class_started_late'
     LEFT JOIN room_events re_join ON re_join.room_id = r.room_id AND re_join.event_type = 'participant_joined'
       AND re_join.actor_email = $1
     WHERE ra.participant_email = $1
       AND r.scheduled_start >= $2::DATE
       AND r.scheduled_start < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  const sr = sessionsResult.rows[0];
  const totalScheduled = parseInt(sr?.total_scheduled || '0', 10);
  const sessionsConducted = parseInt(sr?.total_live_or_ended || '0', 10);
  const sessionsCancelled = parseInt(sr?.total_cancelled || '0', 10);
  const totalDurationMin = parseInt(sr?.total_duration_min || '0', 10);
  const lateStarts = parseInt(sr?.late_starts || '0', 10);
  const lateTotalSec = parseInt(sr?.late_by_total_sec || '0', 10);
  const onTimeRate = totalScheduled > 0 ? Math.round(((totalScheduled - lateStarts) / totalScheduled) * 100) : 100;

  // Camera off incidents
  const cameraOffResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_alerts
     WHERE target_email = $1
       AND alert_type = 'teacher_camera_off'
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  // Average student engagement in this teacher's rooms
  const engagementResult = await db.query<{ avg_engagement: string }>(
    `SELECT
       CASE
         WHEN SUM(cme.duration_seconds) > 0
         THEN ROUND((SUM(CASE WHEN cme.event_type = 'attentive' THEN cme.duration_seconds ELSE 0 END)::NUMERIC
                      / NULLIF(SUM(cme.duration_seconds), 0)) * 100)
         ELSE 0
       END::TEXT AS avg_engagement
     FROM class_monitoring_events cme
     JOIN rooms r ON cme.room_id = r.room_id
     JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher' AND ra.participant_email = $1
     WHERE cme.created_at >= $2::DATE
       AND cme.created_at < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  // Batches taught
  const batchesResult = await db.query<{ batch_name: string }>(
    `SELECT DISTINCT b.name AS batch_name
     FROM batches b
     JOIN rooms r ON r.batch_id = b.id::TEXT
     JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher' AND ra.participant_email = $1
     WHERE r.scheduled_start >= $2::DATE
       AND r.scheduled_start < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  const overallSummary = generateTeacherSummaryText({
    name: teacherName,
    sessionsConducted,
    sessionsCancelled,
    lateStarts,
    onTimeRate,
    totalHours: Math.round(totalDurationMin / 60 * 10) / 10,
    avgEngagement: parseInt(engagementResult.rows[0]?.avg_engagement || '0', 10),
  });

  const metrics: TeacherReportMetrics = {
    sessions_conducted: sessionsConducted,
    sessions_cancelled: sessionsCancelled,
    sessions_scheduled: totalScheduled,
    avg_start_delay_minutes: sessionsConducted > 0 ? Math.round(lateTotalSec / sessionsConducted / 60) : 0,
    on_time_rate: onTimeRate,
    avg_class_duration_minutes: sessionsConducted > 0 ? Math.round(totalDurationMin / sessionsConducted) : 0,
    avg_student_engagement: parseInt(engagementResult.rows[0]?.avg_engagement || '0', 10),
    camera_off_incidents: parseInt(cameraOffResult.rows[0]?.cnt || '0', 10),
    total_teaching_hours: Math.round(totalDurationMin / 60 * 10) / 10,
    late_starts: lateStarts,
    late_by_total_minutes: Math.round(lateTotalSec / 60),
    batches: batchesResult.rows.map((r) => r.batch_name),
    overall_summary: overallSummary,
  };

  const reportType: ReportType = `teacher_${period}` as ReportType;

  const result = await db.query<{ id: string }>(
    `INSERT INTO monitoring_reports
      (report_type, report_period, period_start, period_end,
       target_email, target_role, target_name, metrics, generated_by)
     VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'teacher', $6, $7, 'system')
     RETURNING id`,
    [
      reportType, period, period_start, period_end,
      teacher_email, teacherName, JSON.stringify(metrics),
    ]
  );

  return result.rows[0]?.id || 'unknown';
}

/* ═══════════════════════════════════════════════════════════════
   REPORT QUERIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * List monitoring reports with filtering.
 */
export async function listMonitoringReports(opts: {
  report_type?: ReportType;
  report_period?: ReportPeriod;
  target_email?: string;
  target_role?: 'student' | 'teacher';
  batch_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ reports: MonitoringReport[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.report_type) {
    conditions.push(`report_type = $${idx++}`);
    params.push(opts.report_type);
  }
  if (opts.report_period) {
    conditions.push(`report_period = $${idx++}`);
    params.push(opts.report_period);
  }
  if (opts.target_email) {
    conditions.push(`target_email = $${idx++}`);
    params.push(opts.target_email);
  }
  if (opts.target_role) {
    conditions.push(`target_role = $${idx++}`);
    params.push(opts.target_role);
  }
  if (opts.batch_id) {
    conditions.push(`batch_id = $${idx++}`);
    params.push(opts.batch_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const [dataResult, countResult] = await Promise.all([
    db.query<MonitoringReport>(
      `SELECT * FROM monitoring_reports ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    db.query<{ cnt: string }>(
      `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_reports ${where}`,
      params
    ),
  ]);

  return {
    reports: dataResult.rows,
    total: parseInt(countResult.rows[0]?.cnt || '0', 10),
  };
}

/**
 * Get a single report by ID.
 */
export async function getMonitoringReport(reportId: string): Promise<MonitoringReport | null> {
  const result = await db.query<MonitoringReport>(
    `SELECT * FROM monitoring_reports WHERE id = $1`,
    [reportId]
  );
  return result.rows[0] || null;
}

/**
 * Mark a report as sent to parent.
 */
export async function markReportSentToParent(reportId: string, parentEmail: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE monitoring_reports
     SET sent_to_parent = true, parent_email = $2, sent_at = NOW()
     WHERE id = $1`,
    [reportId, parentEmail]
  );
  return (result.rowCount ?? 0) > 0;
}

/* ═══════════════════════════════════════════════════════════════
   SUMMARY TEXT GENERATORS
   ═══════════════════════════════════════════════════════════════ */

function generateStudentSummaryText(data: {
  name: string;
  attendanceRate: number;
  avgAttention: number;
  eyesClosedMin: number;
  lookingAwayMin: number;
  distractedMin: number;
  handRaises: number;
  totalSessions: number;
  sessionsPresent: number;
}): string {
  const parts: string[] = [];

  parts.push(`${data.name} attended ${data.sessionsPresent} of ${data.totalSessions} classes (${data.attendanceRate}% attendance).`);

  if (data.avgAttention >= 80) {
    parts.push(`Overall attention level is excellent (${data.avgAttention}%).`);
  } else if (data.avgAttention >= 60) {
    parts.push(`Overall attention level is good (${data.avgAttention}%) with room for improvement.`);
  } else if (data.avgAttention >= 40) {
    parts.push(`Attention level needs improvement (${data.avgAttention}%). Student shows signs of disengagement during class.`);
  } else {
    parts.push(`Attention level is concerning (${data.avgAttention}%). Student frequently appears disengaged or distracted.`);
  }

  if (data.eyesClosedMin > 5) {
    parts.push(`Student appeared drowsy/sleeping for approximately ${data.eyesClosedMin} minutes total.`);
  }
  if (data.lookingAwayMin > 10) {
    parts.push(`Student was looking away from the screen for approximately ${data.lookingAwayMin} minutes.`);
  }
  if (data.distractedMin > 10) {
    parts.push(`Student showed signs of distraction for approximately ${data.distractedMin} minutes.`);
  }
  if (data.handRaises > 0) {
    parts.push(`Student raised hand ${data.handRaises} time${data.handRaises > 1 ? 's' : ''}, showing active participation.`);
  }

  return parts.join(' ');
}

function generateTeacherSummaryText(data: {
  name: string;
  sessionsConducted: number;
  sessionsCancelled: number;
  lateStarts: number;
  onTimeRate: number;
  totalHours: number;
  avgEngagement: number;
}): string {
  const parts: string[] = [];

  parts.push(`${data.name} conducted ${data.sessionsConducted} session${data.sessionsConducted !== 1 ? 's' : ''} totaling ${data.totalHours} teaching hours.`);

  if (data.sessionsCancelled > 0) {
    parts.push(`${data.sessionsCancelled} session${data.sessionsCancelled > 1 ? 's were' : ' was'} cancelled.`);
  }

  if (data.lateStarts > 0) {
    parts.push(`${data.lateStarts} session${data.lateStarts > 1 ? 's' : ''} started late. On-time rate: ${data.onTimeRate}%.`);
  } else {
    parts.push(`All sessions started on time (${data.onTimeRate}% punctuality).`);
  }

  if (data.avgEngagement >= 75) {
    parts.push(`Average student engagement was excellent at ${data.avgEngagement}%.`);
  } else if (data.avgEngagement >= 50) {
    parts.push(`Average student engagement was ${data.avgEngagement}%, moderate level.`);
  } else if (data.avgEngagement > 0) {
    parts.push(`Average student engagement was low at ${data.avgEngagement}%.`);
  }

  return parts.join(' ');
}
