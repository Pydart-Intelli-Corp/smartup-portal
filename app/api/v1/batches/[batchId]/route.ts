// ═══════════════════════════════════════════════════════════════
// Batches API — Single batch operations
// GET    /api/v1/batches/[batchId]  — Batch detail with students
// PATCH  /api/v1/batches/[batchId]  — Update batch
// DELETE /api/v1/batches/[batchId]  — Archive or delete batch
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator'].includes(user.role)) return null;
  return user;
}

// ── GET — Batch detail ──────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;

  const batchRes = await db.query(
    `SELECT b.*, c.full_name AS coordinator_name, ao.full_name AS academic_operator_name
     FROM batches b
     LEFT JOIN portal_users c ON c.email = b.coordinator_email
     LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
     WHERE b.batch_id = $1`,
    [batchId]
  );
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const studentsRes = await db.query(
    `SELECT
       bs.student_email,
       bs.parent_email,
       bs.added_at,
       su.full_name AS student_name,
       pu.full_name AS parent_name,
       pp.phone     AS parent_phone,
       -- Per-student attendance stats for this batch
       COUNT(ra.room_id) FILTER (
         WHERE r.status = 'ended'
       ) AS total_classes,
       COUNT(a.*) FILTER (
         WHERE a.status = 'present'
       ) AS present,
       CASE
         WHEN COUNT(ra.room_id) FILTER (WHERE r.status = 'ended') > 0
         THEN ROUND(
           (COUNT(a.*) FILTER (WHERE a.status = 'present')::numeric /
            COUNT(ra.room_id) FILTER (WHERE r.status = 'ended')) * 100, 1
         )
         ELSE 0
       END AS attendance_rate
     FROM batch_students bs
     LEFT JOIN portal_users su ON su.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     LEFT JOIN user_profiles pp ON pp.email = bs.parent_email
     -- Join rooms only for this batch's sessions
     LEFT JOIN batch_sessions bss ON bss.batch_id = bs.batch_id
     LEFT JOIN rooms r ON r.room_id = bss.livekit_room_name
     LEFT JOIN room_assignments ra
       ON ra.room_id = r.room_id
       AND ra.participant_email = bs.student_email
       AND ra.participant_type = 'student'
     LEFT JOIN attendance_sessions a
       ON a.room_id = r.room_id
       AND a.participant_email = bs.student_email
       AND a.participant_type = 'student'
     WHERE bs.batch_id = $1
     GROUP BY
       bs.student_email, bs.parent_email, bs.added_at,
       su.full_name, pu.full_name, pp.phone
     ORDER BY bs.added_at`,
    [batchId]
  );

  const teachersRes = await db.query(
    `SELECT bt.teacher_email, bt.subject, bt.added_at,
            u.full_name AS teacher_name
     FROM batch_teachers bt
     LEFT JOIN portal_users u ON u.email = bt.teacher_email
     WHERE bt.batch_id = $1
     ORDER BY bt.subject`,
    [batchId]
  );

  return NextResponse.json({
    success: true,
    data: {
      batch: batchRes.rows[0],
      students: studentsRes.rows,
      teachers: teachersRes.rows,
    },
  });
}

// ── PATCH — Update batch ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const updateableFields = ['batch_name', 'subjects', 'grade', 'section', 'board', 'coordinator_email', 'academic_operator_email', 'max_students', 'status', 'notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of updateableFields) {
    if (field in body) {
      values.push(body[field] ?? null);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0 && !Array.isArray(body.students) && !Array.isArray(body.teachers)) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  await db.withTransaction(async (client) => {
    if (sets.length > 0) {
      values.push(batchId);
      const sql = `UPDATE batches SET ${sets.join(', ')} WHERE batch_id = $${values.length} RETURNING batch_id`;
      const result = await client.query(sql, values);
      if (result.rows.length === 0) {
        throw new Error('Batch not found');
      }
    }

    // Handle teacher-subject assignments update
    if (Array.isArray(body.teachers)) {
      const teacherList = body.teachers as { email: string; subject: string }[];
      await client.query('DELETE FROM batch_teachers WHERE batch_id = $1', [batchId]);
      for (const t of teacherList) {
        if (t.email && t.subject) {
          await client.query(
            `INSERT INTO batch_teachers (batch_id, teacher_email, subject)
             VALUES ($1, $2, $3)
             ON CONFLICT (batch_id, subject) DO UPDATE SET teacher_email = EXCLUDED.teacher_email`,
            [batchId, t.email.trim().toLowerCase(), t.subject.trim()]
          );
        }
      }
    }

    // Handle student list update
    if (Array.isArray(body.students)) {
      const studentList = body.students as { email: string; parent_email?: string }[];
      await client.query('DELETE FROM batch_students WHERE batch_id = $1', [batchId]);
      for (const s of studentList) {
        await client.query(
          `INSERT INTO batch_students (batch_id, student_email, parent_email)
           VALUES ($1, $2, $3)`,
          [batchId, s.email.trim().toLowerCase(), s.parent_email || null]
        );
      }
    }
  });

  return NextResponse.json({ success: true, message: 'Batch updated' });
}

// ── DELETE — Archive batch ──────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;
  const url = new URL(req.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  if (permanent) {
    // Permanently delete (cascade removes batch_students)
    const result = await db.query('DELETE FROM batches WHERE batch_id = $1 RETURNING batch_id', [batchId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Batch permanently deleted' });
  } else {
    // Archive
    const result = await db.query(
      `UPDATE batches SET status = 'archived' WHERE batch_id = $1 RETURNING batch_id`,
      [batchId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Batch archived' });
  }
}
