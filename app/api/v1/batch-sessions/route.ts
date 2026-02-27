// ═══════════════════════════════════════════════════════════════
// Batch Sessions API — GET + POST + DELETE (bulk)
// GET    /api/v1/batch-sessions?batch_id=X  — List sessions for a batch
// POST   /api/v1/batch-sessions             — Schedule a new class session
// DELETE /api/v1/batch-sessions              — Bulk cancel sessions
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

// ── GET — List sessions ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const batchId = url.searchParams.get('batch_id');
  const status = url.searchParams.get('status') || 'all';
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');

  let sql = `
    SELECT
      s.*,
      b.batch_name, b.batch_type, b.grade, b.section, b.subjects,
      b.coordinator_email, b.academic_operator_email,
      COALESCE(sc.student_count, 0) AS student_count
    FROM batch_sessions s
    JOIN batches b ON b.batch_id = s.batch_id
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
    ) sc ON sc.batch_id = s.batch_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (batchId) {
    params.push(batchId);
    sql += ` AND s.batch_id = $${params.length}`;
  }

  // For AO, only show sessions for their assigned batches
  if (caller.role === 'academic_operator') {
    params.push(caller.id);
    sql += ` AND b.academic_operator_email = $${params.length}`;
  }

  if (status !== 'all') {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  if (dateFrom) {
    params.push(dateFrom);
    sql += ` AND s.scheduled_date >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    sql += ` AND s.scheduled_date <= $${params.length}::date`;
  }

  sql += ` ORDER BY s.scheduled_date DESC, s.start_time DESC`;

  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: { sessions: result.rows } });
}

// ── POST — Schedule a new session ───────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    batch_id, subject, teacher_email, teacher_name,
    scheduled_date, start_time,
    duration_minutes = 90, teaching_minutes = 75, prep_buffer_minutes = 15,
    topic, notes,
  } = body;

  if (!batch_id || !subject || !scheduled_date || !start_time) {
    return NextResponse.json({
      success: false,
      error: 'batch_id, subject, scheduled_date, and start_time are required',
    }, { status: 400 });
  }

  // ── Reject sessions scheduled in the past (IST) ──────────
  const sessionDateTimeIST = new Date(`${scheduled_date}T${(start_time as string).slice(0, 5)}+05:30`);
  if (sessionDateTimeIST < new Date()) {
    return NextResponse.json({
      success: false,
      error: 'Cannot schedule a session in the past. Please select a future date and time (IST).',
    }, { status: 400 });
  }

  // Verify batch exists and caller has access
  const batchRes = await db.query('SELECT * FROM batches WHERE batch_id = $1', [batch_id]);
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const batch = batchRes.rows[0] as Record<string, unknown>;
  if (caller.role === 'academic_operator' && batch.academic_operator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }

  // Check teacher's daily session limit (max 4 per day per workflow.json)
  if (teacher_email) {
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM batch_sessions
       WHERE teacher_email = $1
       AND scheduled_date = $2::date
       AND status IN ('scheduled', 'live')`,
      [teacher_email, scheduled_date]
    );
    const cnt = parseInt((countRes.rows[0] as { cnt: string }).cnt, 10);
    if (cnt >= 4) {
      return NextResponse.json({
        success: false,
        error: `Teacher already has ${cnt} sessions on this date (max 4 per day)`,
      }, { status: 400 });
    }

    // Check for time conflicts (same teacher, overlapping time)
    const conflictRes = await db.query(
      `SELECT session_id, start_time, duration_minutes FROM batch_sessions
       WHERE teacher_email = $1
       AND scheduled_date = $2::date
       AND status IN ('scheduled', 'live')
       AND (
         ($3::time >= start_time AND $3::time < start_time + (duration_minutes || ' minutes')::interval)
         OR (start_time >= $3::time AND start_time < $3::time + ($4 || ' minutes')::interval)
       )`,
      [teacher_email, scheduled_date, start_time, duration_minutes]
    );
    if (conflictRes.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Teacher has a conflicting session at this time',
      }, { status: 400 });
    }
  }

  // Generate LiveKit room name: smartup_{date}_{time}_{short_unique}
  const shortId = Math.random().toString(36).substring(2, 8);
  const livekitRoomName = `smartup_${(scheduled_date as string).replace(/-/g, '')}_${(start_time as string).replace(/:/g, '').substring(0, 4)}_${shortId}`;

  const insertRes = await db.query(
    `INSERT INTO batch_sessions (
      batch_id, subject, teacher_email, teacher_name,
      scheduled_date, start_time,
      duration_minutes, teaching_minutes, prep_buffer_minutes,
      livekit_room_name, topic, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6::time, $7, $8, $9, $10, $11, $12, $13)
    RETURNING session_id`,
    [
      batch_id, subject, teacher_email || null, teacher_name || null,
      scheduled_date, start_time,
      duration_minutes, teaching_minutes, prep_buffer_minutes,
      livekitRoomName, topic || null, notes || null, caller.id,
    ]
  );

  // Trigger auto timetable update email (debounced, non-blocking)
  scheduleTimetableUpdate(batch_id as string);

  return NextResponse.json({
    success: true,
    data: { session_id: insertRes.rows[0].session_id, livekit_room_name: livekitRoomName },
    message: 'Session scheduled successfully',
  }, { status: 201 });
}

// ── DELETE — Bulk cancel or permanently delete sessions ─────
// body.permanent = true  → hard-delete from DB
// default                → soft-cancel (set status='cancelled')
export async function DELETE(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const sessionIds = Array.isArray(body.session_ids) ? body.session_ids as string[] : [];
  if (sessionIds.length === 0) {
    return NextResponse.json({ success: false, error: 'session_ids array required' }, { status: 400 });
  }

  const permanent = body.permanent === true;

  if (permanent) {
    // ── Permanent delete — remove rows entirely ──
    // Gather batch_ids first for timetable update, exclude live sessions
    const batchesRes = await db.query(
      `SELECT DISTINCT batch_id FROM batch_sessions WHERE session_id = ANY($1::text[]) AND status != 'live'`,
      [sessionIds],
    );
    const result = await db.query(
      `DELETE FROM batch_sessions WHERE session_id = ANY($1::text[]) AND status != 'live' RETURNING session_id`,
      [sessionIds]
    );
    const deleted = result.rows.length;
    const skipped = sessionIds.length - deleted;
    for (const row of batchesRes.rows) {
      scheduleTimetableUpdate((row as { batch_id: string }).batch_id);
    }
    return NextResponse.json({
      success: true,
      data: { deleted, skipped },
      message: `${deleted} session${deleted !== 1 ? 's' : ''} permanently deleted${skipped > 0 ? ` (${skipped} skipped — live sessions cannot be deleted)` : ''}`,
    });
  }

  // ── Soft cancel — keep in DB as cancelled ──
  const reason = (body.reason as string) || 'Bulk cancelled by operator';

  // Only cancel sessions that are still 'scheduled'
  const result = await db.query(
    `UPDATE batch_sessions
     SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = $2
     WHERE session_id = ANY($1::text[]) AND status = 'scheduled'
     RETURNING session_id`,
    [sessionIds, reason]
  );

  const cancelled = result.rows.length;
  const skipped = sessionIds.length - cancelled;

  // Trigger auto timetable update for affected batches
  if (cancelled > 0) {
    const batchesRes = await db.query(
      `SELECT DISTINCT batch_id FROM batch_sessions WHERE session_id = ANY($1::text[])`,
      [sessionIds],
    );
    for (const row of batchesRes.rows) {
      scheduleTimetableUpdate((row as { batch_id: string }).batch_id);
    }
  }

  return NextResponse.json({
    success: true,
    data: { cancelled, skipped },
    message: `${cancelled} session${cancelled !== 1 ? 's' : ''} cancelled${skipped > 0 ? ` (${skipped} skipped — already started/ended/cancelled)` : ''}`,
  });
}
