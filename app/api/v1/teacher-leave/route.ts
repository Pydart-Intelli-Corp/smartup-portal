// ═══════════════════════════════════════════════════════════════
// Teacher Leave Requests API — /api/v1/teacher-leave
// Teachers: submit leave requests
// AO/HR/Owner: approve/reject with multi-level chain
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import {
  leaveRequestSubmittedTemplate,
  leaveRequestApprovedTemplate,
  leaveRequestRejectedTemplate,
  leaveSessionsAffectedTemplate,
} from '@/lib/email-templates';

interface LeaveRequest {
  id: string;
  teacher_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  ao_reviewed_by: string | null;
  ao_reviewed_at: string | null;
  ao_notes: string | null;
  hr_status: string;
  hr_reviewed_by: string | null;
  hr_reviewed_at: string | null;
  hr_notes: string | null;
  owner_status: string;
  owner_reviewed_by: string | null;
  owner_reviewed_at: string | null;
  owner_notes: string | null;
  affected_sessions: string[];
  substitute_teacher: string | null;
  created_at: string;
  updated_at: string;
  teacher_name?: string;
  [key: string]: unknown;
}

const ok = (data: unknown) => NextResponse.json({ success: true, data });
const err = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

/* ─── GET: List leave requests ────────────────────────── */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);

  let query: string;
  let params: unknown[];

  if (role === 'teacher') {
    query = `SELECT * FROM teacher_leave_requests WHERE teacher_email = $1 ORDER BY created_at DESC`;
    params = [email];
  } else if (role === 'academic_operator') {
    // AO sees leave for teachers in their batches
    query = `SELECT lr.*, pu.full_name AS teacher_name
             FROM teacher_leave_requests lr
             LEFT JOIN portal_users pu ON pu.email = lr.teacher_email
             WHERE lr.teacher_email IN (
               SELECT DISTINCT bt.teacher_email FROM batch_teachers bt
               JOIN batches b ON b.batch_id = bt.batch_id
               WHERE b.academic_operator_email = $1
             )
             ORDER BY lr.created_at DESC`;
    params = [email];
  } else if (['hr', 'owner'].includes(role)) {
    query = `SELECT lr.*, pu.full_name AS teacher_name
             FROM teacher_leave_requests lr
             LEFT JOIN portal_users pu ON pu.email = lr.teacher_email
             ORDER BY lr.created_at DESC
             LIMIT 200`;
    params = [];
  } else {
    return err('Access denied', 403);
  }

  const { rows } = await db.query<LeaveRequest>(query, params);

  const counts = { pending: 0, approved: 0, rejected: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === 'pending') counts.pending++;
    else if (r.status === 'approved') counts.approved++;
    else if (r.status === 'rejected') counts.rejected++;
  }

  return ok({ requests: rows, counts });
}

/* ─── POST: Submit / review leave requests ────────────── */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);
  const body = await req.json();

  // ─── Review action (approve/reject) ─────────────────
  if (body.action === 'approve' || body.action === 'reject') {
    const reviewerRoles = ['academic_operator', 'hr', 'owner'];
    if (!reviewerRoles.includes(role)) return err('Not authorized to review', 403);

    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email
       WHERE lr.id = $1`, [reqId]
    );
    if (rows.length === 0) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'pending') return err('Already processed');

    // Determine which level this reviewer is
    const levelField = role === 'academic_operator' ? 'ao' : role === 'hr' ? 'hr' : 'owner';
    const statusCol = `${levelField}_status`;
    const reviewerCol = `${levelField}_reviewed_by`;
    const reviewedAtCol = `${levelField}_reviewed_at`;
    const notesCol = `${levelField}_notes`;
    const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

    // Update the level-specific fields
    await db.query(
      `UPDATE teacher_leave_requests SET
       ${statusCol} = $2, ${reviewerCol} = $3, ${reviewedAtCol} = NOW(), ${notesCol} = $4
       WHERE id = $1`,
      [reqId, newStatus, email, body.notes || null]
    );

    if (body.action === 'reject') {
      // Any rejection → overall rejected
      await db.query(
        `UPDATE teacher_leave_requests SET status = 'rejected' WHERE id = $1`, [reqId]
      );

      try {
        const tmpl = leaveRequestRejectedTemplate({
          teacherName: leave.teacher_name || leave.teacher_email,
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
          rejectedBy: user.name || email,
          rejectedByRole: role,
          reason: body.notes || 'No reason provided',
        });
        await sendEmail({ to: leave.teacher_email, ...tmpl });
      } catch (e) { console.error('Email failed:', e); }

      return ok({ status: 'rejected' });
    }

    // Check if enough approvals: AO + HR both approved → overall approved
    // Or Owner approved → overall approved (override)
    const { rows: updated } = await db.query<LeaveRequest>(
      `SELECT * FROM teacher_leave_requests WHERE id = $1`, [reqId]
    );
    const u = updated[0];

    const isFullyApproved =
      u.owner_status === 'approved' ||
      (u.ao_status === 'approved' && u.hr_status === 'approved');

    if (isFullyApproved) {
      // Find affected sessions
      const { rows: sessions } = await db.query<{ session_id: string; subject: string; scheduled_date: string; [key: string]: unknown }>(
        `SELECT session_id, subject, scheduled_date FROM batch_sessions
         WHERE teacher_email = $1
           AND scheduled_date BETWEEN $2 AND $3
           AND status IN ('scheduled', 'prep')`,
        [leave.teacher_email, leave.start_date, leave.end_date]
      );

      const sessionIds = sessions.map(s => s.session_id);

      // Cancel affected sessions (or mark as needing substitute)
      if (sessionIds.length > 0) {
        await db.query(
          `UPDATE batch_sessions SET status = 'cancelled'
           WHERE session_id = ANY($1::text[])`,
          [sessionIds]
        );
      }

      await db.query(
        `UPDATE teacher_leave_requests SET status = 'approved',
         affected_sessions = $2, substitute_teacher = $3
         WHERE id = $1`,
        [reqId, sessionIds, body.substitute_teacher || null]
      );

      // Notify teacher
      try {
        const tmpl = leaveRequestApprovedTemplate({
          teacherName: leave.teacher_name || leave.teacher_email,
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
          affectedSessions: sessions.length,
        });
        await sendEmail({ to: leave.teacher_email, ...tmpl });
      } catch (e) { console.error('Email failed:', e); }

      // Notify stakeholders about affected sessions
      if (sessions.length > 0) {
        await notifyAffectedStakeholders(leave, sessions);
      }

      return ok({ status: 'approved', affectedSessions: sessionIds.length });
    }

    return ok({ status: 'level_approved', level: levelField });
  }

  // ─── Withdraw ────────────────────────────────────────
  if (body.action === 'withdraw') {
    await db.query(
      `UPDATE teacher_leave_requests SET status = 'withdrawn'
       WHERE id = $1 AND teacher_email = $2 AND status = 'pending'`,
      [body.request_id, email]
    );
    return ok({ status: 'withdrawn' });
  }

  // ─── Submit new leave request ────────────────────────
  if (role !== 'teacher') return err('Only teachers can submit leave', 403);

  const { leave_type, start_date, end_date, reason } = body;
  if (!leave_type || !start_date || !end_date || !reason) {
    return err('leave_type, start_date, end_date, reason required');
  }

  // Check for overlapping leave
  const { rows: overlaps } = await db.query(
    `SELECT id FROM teacher_leave_requests
     WHERE teacher_email = $1 AND status IN ('pending', 'approved')
       AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
    [email, start_date, end_date]
  );
  if (overlaps.length > 0) return err('Overlapping leave request exists');

  // Count affected sessions
  const { rows: affected } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM batch_sessions
     WHERE teacher_email = $1
       AND scheduled_date BETWEEN $2 AND $3
       AND status IN ('scheduled', 'prep')`,
    [email, start_date, end_date]
  );

  const { rows: inserted } = await db.query<LeaveRequest>(
    `INSERT INTO teacher_leave_requests (teacher_email, leave_type, start_date, end_date, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email, leave_type, start_date, end_date, reason]
  );

  // Notify AO (teachers' batches' AO emails)
  const { rows: aoEmails } = await db.query<{ email: string; full_name: string; [key: string]: unknown }>(
    `SELECT DISTINCT b.academic_operator_email AS email, pu.full_name
     FROM batch_teachers bt
     JOIN batches b ON b.batch_id = bt.batch_id
     LEFT JOIN portal_users pu ON pu.email = b.academic_operator_email
     WHERE bt.teacher_email = $1 AND b.academic_operator_email IS NOT NULL`,
    [email]
  );

  for (const ao of aoEmails) {
    try {
      const tmpl = leaveRequestSubmittedTemplate({
        reviewerName: ao.full_name || 'Academic Operator',
        teacherName: user.name || email,
        leaveType: leave_type,
        startDate: start_date,
        endDate: end_date,
        reason,
        affectedSessions: affected[0]?.count || 0,
      });
      await sendEmail({ to: ao.email, ...tmpl });
    } catch (e) { console.error('AO email failed:', e); }
  }

  // Also notify HR
  const { rows: hrUsers } = await db.query<{ email: string; full_name: string; [key: string]: unknown }>(
    `SELECT email, full_name FROM portal_users WHERE portal_role = 'hr' AND is_active = TRUE LIMIT 5`
  );
  for (const hr of hrUsers) {
    try {
      const tmpl = leaveRequestSubmittedTemplate({
        reviewerName: hr.full_name || 'HR',
        teacherName: user.name || email,
        leaveType: leave_type,
        startDate: start_date,
        endDate: end_date,
        reason,
        affectedSessions: affected[0]?.count || 0,
      });
      await sendEmail({ to: hr.email, ...tmpl });
    } catch (e) { console.error('HR email failed:', e); }
  }

  return ok({ request: inserted[0], affectedSessions: affected[0]?.count || 0 });
}

/* ─── Notify stakeholders about cancelled sessions ────── */
async function notifyAffectedStakeholders(
  leave: LeaveRequest,
  sessions: Array<{ session_id: string; subject: string; scheduled_date: string; [key: string]: unknown }>
) {
  // Get unique batch_ids from affected sessions
  const { rows: batchSessions } = await db.query<{ batch_id: string; session_id: string; [key: string]: unknown }>(
    `SELECT batch_id, session_id FROM batch_sessions WHERE session_id = ANY($1::text[])`,
    [sessions.map(s => s.session_id)]
  );

  const batchIds = [...new Set(batchSessions.map(bs => bs.batch_id))];

  for (const batchId of batchIds) {
    // Get students, parents, coordinator
    const { rows: students } = await db.query<{ student_email: string; parent_email: string | null; [key: string]: unknown }>(
      `SELECT student_email, parent_email FROM batch_students WHERE batch_id = $1`, [batchId]
    );
    const { rows: batch } = await db.query<{ coordinator_email: string; batch_name: string; [key: string]: unknown }>(
      `SELECT coordinator_email, batch_name FROM batches WHERE batch_id = $1`, [batchId]
    );

    const batchName = batch[0]?.batch_name || batchId;
    const sessionDates = sessions.map(s => s.scheduled_date).join(', ');

    const allEmails = new Set<string>();
    students.forEach(s => {
      allEmails.add(s.student_email);
      if (s.parent_email) allEmails.add(s.parent_email);
    });
    if (batch[0]?.coordinator_email) allEmails.add(batch[0].coordinator_email);

    for (const recipientEmail of allEmails) {
      try {
        const { rows: u } = await db.query<{ full_name: string; [key: string]: unknown }>(
          `SELECT full_name FROM portal_users WHERE email = $1`, [recipientEmail]
        );
        const tmpl = leaveSessionsAffectedTemplate({
          recipientName: u[0]?.full_name || recipientEmail,
          teacherName: leave.teacher_name || leave.teacher_email,
          batchName,
          sessionDates,
          sessionsCount: sessions.length,
          leaveType: leave.leave_type,
          startDate: leave.start_date,
          endDate: leave.end_date,
        });
        await sendEmail({ to: recipientEmail, ...tmpl });
      } catch (e) { console.error('Stakeholder email failed:', e); }
    }
  }
}
