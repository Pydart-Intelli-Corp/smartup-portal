// ═══════════════════════════════════════════════════════════════
// Ghost Rooms API — GET /api/v1/ghost/rooms
// Ghost observers can see all live/scheduled rooms
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['ghost', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade,
            r.teacher_email, r.status, r.scheduled_start, r.duration_minutes
     FROM rooms r
     WHERE r.status IN ('scheduled', 'live')
     ORDER BY
       CASE WHEN r.status = 'live' THEN 0 ELSE 1 END,
       r.scheduled_start ASC
     LIMIT 50`
  );

  return NextResponse.json({ success: true, data: { rooms: result.rows } });
}
