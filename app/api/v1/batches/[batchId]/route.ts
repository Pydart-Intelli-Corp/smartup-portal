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
    `SELECT b.*, t.full_name AS teacher_name, c.full_name AS coordinator_name
     FROM batches b
     LEFT JOIN portal_users t ON t.email = b.teacher_email
     LEFT JOIN portal_users c ON c.email = b.coordinator_email
     WHERE b.batch_id = $1`,
    [batchId]
  );
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const studentsRes = await db.query(
    `SELECT bs.student_email, bs.parent_email, bs.added_at,
            su.full_name AS student_name,
            pu.full_name AS parent_name
     FROM batch_students bs
     LEFT JOIN portal_users su ON su.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     WHERE bs.batch_id = $1
     ORDER BY bs.added_at`,
    [batchId]
  );

  return NextResponse.json({
    success: true,
    data: {
      batch: batchRes.rows[0],
      students: studentsRes.rows,
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

  const updateableFields = ['batch_name', 'subject', 'grade', 'board', 'teacher_email', 'coordinator_email', 'max_students', 'status', 'notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of updateableFields) {
    if (field in body) {
      values.push(body[field] ?? null);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  values.push(batchId);
  const sql = `UPDATE batches SET ${sets.join(', ')} WHERE batch_id = $${values.length} RETURNING batch_id`;
  const result = await db.query(sql, values);

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  // Handle student list update if provided
  if (Array.isArray(body.students)) {
    const studentList = body.students as { email: string; parent_email?: string }[];
    await db.withTransaction(async (client) => {
      await client.query('DELETE FROM batch_students WHERE batch_id = $1', [batchId]);
      for (const s of studentList) {
        await client.query(
          `INSERT INTO batch_students (batch_id, student_email, parent_email)
           VALUES ($1, $2, $3)`,
          [batchId, s.email.trim().toLowerCase(), s.parent_email || null]
        );
      }
    });
  }

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
