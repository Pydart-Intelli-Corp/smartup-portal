// ═══════════════════════════════════════════════════════════════
// Room Students API
// GET  /api/v1/coordinator/rooms/[room_id]/students — List
// POST /api/v1/coordinator/rooms/[room_id]/students — Add students
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getCoordinator(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['coordinator', 'academic_operator', 'owner'].includes(user.role)) return null;
  return user;
}

// List students assigned to a room
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT id, participant_email, participant_name, payment_status,
            notification_sent_at, joined_at, left_at, created_at
     FROM room_assignments
     WHERE room_id = $1 AND participant_type = 'student'
     ORDER BY participant_name`,
    [room_id]
  );

  return NextResponse.json({ success: true, data: { students: result.rows } });
}

// Add students to a room (bulk)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const students: Array<{ email: string; name: string; payment_status?: string }> =
    body.students || [];

  if (students.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Provide students array with email and name' },
      { status: 400 }
    );
  }

  // Verify room exists
  const roomCheck = await db.query('SELECT room_id FROM rooms WHERE room_id = $1', [room_id]);
  if (roomCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }

  let added = 0;
  const errors: string[] = [];

  for (const s of students) {
    if (!s.email || !s.name) {
      errors.push(`Missing email/name: ${JSON.stringify(s)}`);
      continue;
    }
    try {
      await db.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
         VALUES ($1, 'student', $2, $3, $4)
         ON CONFLICT (room_id, participant_email) DO UPDATE SET participant_name = $3`,
        [room_id, s.email, s.name, s.payment_status || 'unknown']
      );
      added++;
    } catch (err) {
      errors.push(`${s.email}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    success: true,
    data: { added, errors: errors.length, errorDetails: errors },
  });
}

// ── DELETE — Remove a student from a room ──────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json({ success: false, error: 'Missing email' }, { status: 400 });
  }

  const result = await db.query(
    `DELETE FROM room_assignments
     WHERE room_id = $1 AND participant_email = $2 AND participant_type = 'student'
     RETURNING id`,
    [room_id, email]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ success: false, error: 'Student not found in this room' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { message: 'Student removed' } });
}
