// ═══════════════════════════════════════════════════════════════
// Teacher Rooms API — GET /api/v1/teacher/rooms
// Returns rooms assigned to the logged-in teacher
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['teacher', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
            r.status, r.scheduled_start, r.duration_minutes,
            r.notes_for_teacher, r.max_participants,
            (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
     FROM rooms r
     WHERE r.teacher_email = $1
     ORDER BY r.scheduled_start DESC
     LIMIT 50`,
    [user.id]
  );

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
