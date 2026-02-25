// ═══════════════════════════════════════════════════════════════
// Batches API — GET + POST
// GET  /api/v1/batches           — List all batches with student/teacher counts
// POST /api/v1/batches           — Create batch with subjects + teachers
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

// ── GET — List all batches ──────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'all';
  const batchType = url.searchParams.get('type') || 'all';
  const search = url.searchParams.get('q') || '';

  let sql = `
    SELECT
      b.batch_id, b.batch_name, b.batch_type, b.subjects,
      b.grade, b.section, b.board,
      b.coordinator_email, b.academic_operator_email, b.max_students, b.status,
      b.notes, b.created_by, b.created_at, b.updated_at,
      c.full_name  AS coordinator_name,
      ao.full_name AS academic_operator_name,
      COALESCE(sc.student_count, 0) AS student_count,
      COALESCE(tc.teacher_count, 0) AS teacher_count
    FROM batches b
    LEFT JOIN portal_users c  ON c.email = b.coordinator_email
    LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
    ) sc ON sc.batch_id = b.batch_id
    LEFT JOIN (
      SELECT batch_id, COUNT(DISTINCT teacher_email) AS teacher_count FROM batch_teachers GROUP BY batch_id
    ) tc ON tc.batch_id = b.batch_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status !== 'all') {
    params.push(status);
    sql += ` AND b.status = $${params.length}`;
  }
  if (batchType !== 'all') {
    params.push(batchType);
    sql += ` AND b.batch_type = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (b.batch_name ILIKE $${params.length} OR b.batch_id ILIKE $${params.length} OR b.grade ILIKE $${params.length} OR b.section ILIKE $${params.length})`;
  }

  sql += ` ORDER BY b.created_at DESC`;
  const result = await db.query(sql, params);

  // Fetch teacher-subject assignments for each batch
  const batchIds = result.rows.map((r: Record<string, unknown>) => r.batch_id as string);
  let teacherMap: Record<string, { teacher_email: string; teacher_name: string; subject: string }[]> = {};
  if (batchIds.length > 0) {
    const teacherRes = await db.query(
      `SELECT bt.batch_id, bt.teacher_email, bt.subject, u.full_name AS teacher_name
       FROM batch_teachers bt
       LEFT JOIN portal_users u ON u.email = bt.teacher_email
       WHERE bt.batch_id = ANY($1)
       ORDER BY bt.subject`,
      [batchIds]
    );
    for (const row of teacherRes.rows) {
      const r = row as { batch_id: string; teacher_email: string; teacher_name: string; subject: string };
      if (!teacherMap[r.batch_id]) teacherMap[r.batch_id] = [];
      teacherMap[r.batch_id].push({ teacher_email: r.teacher_email, teacher_name: r.teacher_name, subject: r.subject });
    }
  }

  const batches = result.rows.map((b: Record<string, unknown>) => ({
    ...b,
    teachers: teacherMap[b.batch_id as string] || [],
  }));

  return NextResponse.json({ success: true, data: { batches } });
}

// ── POST — Create a new batch ───────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    batch_name, batch_type, subjects, grade, section, board,
    coordinator_email, academic_operator_email, max_students, notes,
    students,  // Array of { email, parent_email? }
    teachers,  // Array of { email, subject }
  } = body as Record<string, unknown>;

  if (!batch_name || !batch_type) {
    return NextResponse.json({ success: false, error: 'batch_name and batch_type are required' }, { status: 400 });
  }

  const validTypes = ['one_to_one', 'one_to_three', 'one_to_many', 'custom'];
  if (!validTypes.includes(batch_type as string)) {
    return NextResponse.json({ success: false, error: 'Invalid batch_type' }, { status: 400 });
  }

  const studentList = Array.isArray(students) ? students as { email: string; parent_email?: string }[] : [];
  const typeMaxMap: Record<string, number> = { one_to_one: 1, one_to_three: 3, one_to_many: 999, custom: 999 };
  const typeMax = typeMaxMap[batch_type as string] ?? 999;
  const effectiveMax = (max_students && Number(max_students) > 0) ? Math.min(Number(max_students), batch_type === 'custom' ? 999 : typeMax) : typeMax;

  if (studentList.length > effectiveMax) {
    return NextResponse.json({
      success: false,
      error: `This batch type allows max ${effectiveMax} students. Got ${studentList.length}.`,
    }, { status: 400 });
  }

  const teacherList = Array.isArray(teachers) ? teachers as { email: string; subject: string }[] : [];
  const subjectsList = Array.isArray(subjects) ? subjects as string[] : [];

  const batchId = await db.withTransaction(async (client) => {
    // 1. Create batch
    const insertRes = await client.query(
      `INSERT INTO batches (batch_name, batch_type, subjects, grade, section, board, coordinator_email, academic_operator_email, max_students, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING batch_id`,
      [
        (batch_name as string).trim(),
        batch_type,
        subjectsList.length > 0 ? subjectsList : null,
        grade || null,
        section || null,
        board || null,
        coordinator_email || null,
        (body as Record<string, unknown>).academic_operator_email || null,
        effectiveMax,
        notes || null,
        caller.id,
      ]
    );
    const newBatchId = insertRes.rows[0].batch_id;

    // 2. Add teacher-subject assignments
    for (const t of teacherList) {
      if (t.email && t.subject) {
        await client.query(
          `INSERT INTO batch_teachers (batch_id, teacher_email, subject)
           VALUES ($1, $2, $3)
           ON CONFLICT (batch_id, subject) DO UPDATE SET teacher_email = EXCLUDED.teacher_email`,
          [newBatchId, t.email.trim().toLowerCase(), t.subject.trim()]
        );
      }
    }

    // 3. Add students
    for (const s of studentList) {
      await client.query(
        `INSERT INTO batch_students (batch_id, student_email, parent_email)
         VALUES ($1, $2, $3)
         ON CONFLICT (batch_id, student_email) DO NOTHING`,
        [newBatchId, s.email.trim().toLowerCase(), s.parent_email || null]
      );
    }

    return newBatchId;
  });

  return NextResponse.json({
    success: true,
    data: { batch_id: batchId },
    message: 'Batch created successfully',
  }, { status: 201 });
}
