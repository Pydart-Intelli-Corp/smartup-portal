// ═══════════════════════════════════════════════════════════════
// Parent Rooms API — GET /api/v1/parent/rooms
// Parents see rooms their children are assigned to.
// Uses user_profiles.parent_email + admission_requests for mapping.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['parent', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Find children linked via user_profiles.parent_email
  const childrenResult = await db.query(
    `SELECT up.user_email FROM user_profiles up WHERE up.parent_email = $1`,
    [user.id]
  );
  let childEmails: string[] = childrenResult.rows.map(
    (r: Record<string, unknown>) => String(r.user_email)
  );

  // Also check admission_requests for parent mapping
  if (childEmails.length === 0) {
    const admResult = await db.query(
      `SELECT DISTINCT student_email FROM admission_requests
       WHERE parent_email = $1 AND status = 'active'`,
      [user.id]
    );
    childEmails = admResult.rows.map((r: Record<string, unknown>) => String(r.student_email));
  }

  // If no children found, fall back to showing all rooms (for demo/unlinked parents)
  let result;
  if (childEmails.length > 0) {
    result = await db.query(
      `SELECT DISTINCT r.room_id, r.room_name, r.subject, r.grade, r.section,
              r.teacher_email, r.status, r.scheduled_start, r.duration_minutes,
              ra.participant_email AS student_email,
              pu.full_name AS student_name
       FROM rooms r
       JOIN room_assignments ra ON ra.room_id = r.room_id
       LEFT JOIN portal_users pu ON pu.email = ra.participant_email
       WHERE ra.participant_email = ANY($1)
         AND ra.participant_type = 'student'
         AND r.status IN ('scheduled', 'live', 'ended')
       ORDER BY r.scheduled_start DESC
       LIMIT 100`,
      [childEmails]
    );
  } else {
    result = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
              r.teacher_email, r.status, r.scheduled_start, r.duration_minutes
       FROM rooms r
       WHERE r.status IN ('scheduled', 'live', 'ended')
       ORDER BY r.scheduled_start DESC
       LIMIT 50`
    );
  }

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
