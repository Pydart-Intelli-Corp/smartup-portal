// ═══════════════════════════════════════════════════════════════
// Batch Session Detail API
// GET    /api/v1/batch-sessions/[sessionId]        — Session detail
// PATCH  /api/v1/batch-sessions/[sessionId]        — Update session
// DELETE /api/v1/batch-sessions/[sessionId]        — Cancel session
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { scheduleTimetableUpdate } from '@/lib/timetable-auto';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

// ── GET — Session detail with participants ──────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  const sessionRes = await db.query(
    `SELECT s.*,
            b.batch_name, b.batch_type, b.grade, b.section, b.subjects,
            b.coordinator_email, b.academic_operator_email, b.max_students,
            c.full_name AS coordinator_name,
            ao.full_name AS academic_operator_name
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     LEFT JOIN portal_users c ON c.email = b.coordinator_email
     LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
     WHERE s.session_id = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  const session = sessionRes.rows[0] as Record<string, unknown>;

  // Fetch batch students
  const studentsRes = await db.query(
    `SELECT bs.student_email, bs.parent_email,
            su.full_name AS student_name,
            pu.full_name AS parent_name
     FROM batch_students bs
     LEFT JOIN portal_users su ON su.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     WHERE bs.batch_id = $1
     ORDER BY su.full_name`,
    [session.batch_id]
  );

  // Fetch batch teachers
  const teachersRes = await db.query(
    `SELECT bt.teacher_email, bt.subject,
            u.full_name AS teacher_name
     FROM batch_teachers bt
     LEFT JOIN portal_users u ON u.email = bt.teacher_email
     WHERE bt.batch_id = $1
     ORDER BY bt.subject`,
    [session.batch_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      session,
      students: studentsRes.rows,
      teachers: teachersRes.rows,
    },
  });
}

// ── PATCH — Update session ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  // Check session exists and is still schedulable
  const existing = await db.query('SELECT * FROM batch_sessions WHERE session_id = $1', [sessionId]);
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  const session = existing.rows[0] as Record<string, string>;

  // Special status updates
  if (body.status === 'live' && session.status === 'scheduled') {
    // Start the session
    await db.query(
      `UPDATE batch_sessions SET status = 'live', started_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );
    return NextResponse.json({ success: true, message: 'Session started' });
  }

  if (body.status === 'ended' && session.status === 'live') {
    // End the session
    await db.query(
      `UPDATE batch_sessions SET status = 'ended', ended_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );
    return NextResponse.json({ success: true, message: 'Session ended' });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({
      success: false,
      error: `Cannot edit session in '${session.status}' status`,
    }, { status: 400 });
  }

  const updatable = ['subject', 'teacher_email', 'teacher_name', 'scheduled_date', 'start_time',
                     'duration_minutes', 'teaching_minutes', 'prep_buffer_minutes', 'topic', 'notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of updatable) {
    if (field in body) {
      values.push(body[field] ?? null);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(sessionId);
  await db.query(
    `UPDATE batch_sessions SET ${sets.join(', ')} WHERE session_id = $${values.length}`,
    values
  );

  // Trigger auto timetable update (schedule/time changed)
  scheduleTimetableUpdate(session.batch_id);

  return NextResponse.json({ success: true, message: 'Session updated' });
}

// ── DELETE — Cancel or permanently delete session ───────────
// ?permanent=true  → hard-delete from DB
// default          → soft-cancel (set status='cancelled')
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;
  const url = new URL(req.url);
  const permanent = url.searchParams.get('permanent') === 'true';
  const reason = url.searchParams.get('reason') || 'Cancelled by operator';

  if (permanent) {
    // ── Permanent delete — remove row entirely ──
    // Fetch batch_id before deleting so we can update timetable
    const existing = await db.query('SELECT batch_id, status FROM batch_sessions WHERE session_id = $1', [sessionId]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }
    const { batch_id, status } = existing.rows[0] as { batch_id: string; status: string };
    // Prevent deleting live sessions
    if (status === 'live') {
      return NextResponse.json({ success: false, error: 'Cannot delete a live session. End it first.' }, { status: 400 });
    }
    await db.query('DELETE FROM batch_sessions WHERE session_id = $1', [sessionId]);
    scheduleTimetableUpdate(batch_id);
    return NextResponse.json({ success: true, message: 'Session permanently deleted' });
  }

  // ── Soft cancel — keep in DB as cancelled ──
  const result = await db.query(
    `UPDATE batch_sessions
     SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $2
     WHERE session_id = $1 AND status IN ('scheduled')
     RETURNING session_id`,
    [sessionId, reason]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found or already started' }, { status: 404 });
  }

  // Trigger auto timetable update
  const cancelledSession = await db.query('SELECT batch_id FROM batch_sessions WHERE session_id = $1', [sessionId]);
  if (cancelledSession.rows.length > 0) {
    scheduleTimetableUpdate((cancelledSession.rows[0] as { batch_id: string }).batch_id);
  }

  return NextResponse.json({ success: true, message: 'Session cancelled' });
}
