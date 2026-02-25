// ═══════════════════════════════════════════════════════════════
// Batches API — GET + POST
// GET  /api/v1/batches           — List all batches with student counts
// POST /api/v1/batches           — Create batch with template + students
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
      b.batch_id, b.batch_name, b.batch_type, b.subject, b.grade, b.board,
      b.teacher_email, b.coordinator_email, b.max_students, b.status,
      b.notes, b.created_by, b.created_at, b.updated_at,
      t.full_name  AS teacher_name,
      c.full_name  AS coordinator_name,
      COALESCE(sc.student_count, 0) AS student_count
    FROM batches b
    LEFT JOIN portal_users t  ON t.email = b.teacher_email
    LEFT JOIN portal_users c  ON c.email = b.coordinator_email
    LEFT JOIN (
      SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
    ) sc ON sc.batch_id = b.batch_id
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
    sql += ` AND (b.batch_name ILIKE $${params.length} OR b.batch_id ILIKE $${params.length} OR b.subject ILIKE $${params.length})`;
  }

  sql += ` ORDER BY b.created_at DESC`;
  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: { batches: result.rows } });
}

// ── POST — Create a new batch ───────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    batch_name, batch_type, subject, grade, board,
    teacher_email, coordinator_email, max_students, notes,
    students, // Array of { email, parent_email? }
  } = body as Record<string, unknown>;

  if (!batch_name || !batch_type) {
    return NextResponse.json({ success: false, error: 'batch_name and batch_type are required' }, { status: 400 });
  }

  const validTypes = ['one_to_one', 'one_to_three', 'one_to_many', 'custom'];
  if (!validTypes.includes(batch_type as string)) {
    return NextResponse.json({ success: false, error: 'Invalid batch_type' }, { status: 400 });
  }

  // Enforce student limits per template
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

  const batchId = await db.withTransaction(async (client) => {
    // 1. Create batch
    const insertRes = await client.query(
      `INSERT INTO batches (batch_name, batch_type, subject, grade, board, teacher_email, coordinator_email, max_students, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING batch_id`,
      [
        (batch_name as string).trim(),
        batch_type,
        subject || null,
        grade || null,
        board || null,
        teacher_email || null,
        coordinator_email || null,
        effectiveMax,
        notes || null,
        caller.id,
      ]
    );
    const newBatchId = insertRes.rows[0].batch_id;

    // 2. Add students
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
