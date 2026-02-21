// ═══════════════════════════════════════════════════════════════
// Parent Rooms API — GET /api/v1/parent/rooms
// Parents see rooms their children are assigned to.
// TODO: Add parent-child mapping and filter by it.
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

  // Parents see rooms their children attend.
  // Since parent-child email mapping isn't in DB yet, we show all scheduled/live rooms.
  // TODO: Add parent_email → child_email mapping table and filter by it.
  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
            r.teacher_email, r.status, r.scheduled_start, r.duration_minutes
     FROM rooms r
     WHERE r.status IN ('scheduled', 'live', 'ended')
     ORDER BY r.scheduled_start DESC
     LIMIT 50`
  );

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
