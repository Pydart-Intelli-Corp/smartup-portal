// ═══════════════════════════════════════════════════════════════
// Room Detail + Update + Delete
// GET    /api/v1/coordinator/rooms/[room_id] — Room details
// PATCH  /api/v1/coordinator/rooms/[room_id] — Update room
// DELETE /api/v1/coordinator/rooms/[room_id] — Cancel room
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

// ── GET — Room detail with assignments ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const roomResult = await db.query('SELECT * FROM rooms WHERE room_id = $1', [room_id]);
  if (roomResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }

  const assignResult = await db.query(
    `SELECT id, participant_type, participant_email, participant_name,
            join_token, device_preference, notification_sent_at,
            joined_at, left_at, payment_status, created_at
     FROM room_assignments WHERE room_id = $1
     ORDER BY participant_type, participant_email`,
    [room_id]
  );

  const eventsResult = await db.query(
    `SELECT event_type, participant_email, participant_role, payload, created_at
     FROM room_events WHERE room_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [room_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      room: roomResult.rows[0],
      assignments: assignResult.rows,
      events: eventsResult.rows,
    },
  });
}

// ── PATCH — Update room fields ──────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = [
    'room_name', 'subject', 'grade', 'section', 'teacher_email',
    'scheduled_start', 'duration_minutes', 'max_participants',
    'fee_paise', 'notes_for_teacher',
  ];

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${i}`);
      vals.push(body[key]);
      i++;
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  // Recalculate open_at / expires_at if schedule changed
  if (body.scheduled_start || body.duration_minutes) {
    const roomResult = await db.query('SELECT scheduled_start, duration_minutes FROM rooms WHERE room_id = $1', [room_id]);
    if (roomResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }
    const cur = roomResult.rows[0] as Record<string, unknown>;
    const startStr = body.scheduled_start || cur.scheduled_start;
    const dur = body.duration_minutes || cur.duration_minutes;
    const start = new Date(startStr as string);
    const earlyMs = 15 * 60 * 1000;
    const graceMs = 15 * 60 * 1000;

    sets.push(`open_at = $${i}`);
    vals.push(new Date(start.getTime() - earlyMs).toISOString());
    i++;
    sets.push(`expires_at = $${i}`);
    vals.push(new Date(start.getTime() + (dur as number) * 60 * 1000 + graceMs).toISOString());
    i++;
  }

  vals.push(room_id);
  const sql = `UPDATE rooms SET ${sets.join(', ')} WHERE room_id = $${i} RETURNING *`;
  const result = await db.query(sql, vals);

  return NextResponse.json({ success: true, data: { room: result.rows[0] } });
}

// ── DELETE — Cancel room ────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE rooms SET status = 'cancelled' WHERE room_id = $1`,
      [room_id]
    );
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
       VALUES ($1, 'room_cancelled', $2, 'coordinator', '{}')`,
      [room_id, user.id]
    );
  });

  return NextResponse.json({ success: true, data: { message: 'Room cancelled' } });
}
