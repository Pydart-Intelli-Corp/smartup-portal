// ═══════════════════════════════════════════════════════════════
// Batches People API — Fetch available people for batch assignment
// GET /api/v1/batches/people?role=student|teacher|batch_coordinator|parent
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

export async function GET(req: NextRequest) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const role = url.searchParams.get('role') || 'all';
  const search = url.searchParams.get('q') || '';

  const validRoles = ['student', 'teacher', 'batch_coordinator', 'parent', 'academic_operator'];

  let sql = `
    SELECT u.email, u.full_name, u.portal_role, u.is_active,
           p.phone, p.subjects, p.grade, p.board, p.parent_email,
           par.full_name AS parent_name
    FROM portal_users u
    LEFT JOIN user_profiles p ON p.email = u.email
    LEFT JOIN portal_users par ON par.email = p.parent_email
    WHERE u.is_active = TRUE
  `;
  const params: unknown[] = [];

  if (role !== 'all' && validRoles.includes(role)) {
    params.push(role);
    sql += ` AND u.portal_role = $${params.length}`;
  } else if (role === 'all') {
    sql += ` AND u.portal_role IN ('student', 'teacher', 'batch_coordinator', 'parent')`;
  }

  // Exclude students already assigned to an active batch
  if (role === 'student') {
    sql += ` AND u.email NOT IN (
      SELECT bs.student_email FROM batch_students bs
      JOIN batches b ON b.batch_id = bs.batch_id
      WHERE b.status = 'active'
    )`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  sql += ` ORDER BY u.full_name ASC LIMIT 200`;
  const result = await db.query(sql, params);

  return NextResponse.json({ success: true, data: { people: result.rows } });
}
