// ═══════════════════════════════════════════════════════════════
// Coordinator Rooms API — GET + POST
// GET  /api/v1/coordinator/rooms           — List rooms
// POST /api/v1/coordinator/rooms           — Create room
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

// ── Auth helper ─────────────────────────────────────────────
async function getCoordinator(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user) return null;
  if (!['coordinator', 'academic_operator', 'owner'].includes(user.role)) return null;
  return user;
}

function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = 'room_';
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── GET — List all rooms for this coordinator ───────────────
export async function GET(req: NextRequest) {
  const user = await getCoordinator(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  let sql = `
    SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
           r.coordinator_email, r.teacher_email, r.status,
           r.scheduled_start, r.duration_minutes, r.max_participants,
           r.fee_paise, r.notes_for_teacher AS notes, r.open_at, r.expires_at,
           r.livekit_room_id, r.created_at, r.updated_at,
           (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count,
           (SELECT ra.participant_name FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'teacher' LIMIT 1) AS teacher_name
    FROM rooms r
    WHERE 1=1
  `;
  const params: unknown[] = [];

  // Owner sees all rooms; coordinator sees only their own
  if (user.role === 'coordinator') {
    params.push(user.id);
    sql += ` AND r.coordinator_email = $${params.length}`;
  }

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }

  sql += ` ORDER BY r.scheduled_start DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(sql, params);

  return NextResponse.json({
    success: true,
    data: { rooms: result.rows, total: result.rows.length },
  });
}

// ── POST — Create a new room ────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCoordinator(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    room_name,
    subject,
    grade,
    section,
    scheduled_start,
    duration_minutes,
    max_participants = 50,
    fee_paise = 0,
    notes_for_teacher,
    teacher_email,
  } = body;

  // Validation
  if (!room_name || !subject || !grade || !scheduled_start || !duration_minutes) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: room_name, subject, grade, scheduled_start, duration_minutes' },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduled_start);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { success: false, error: 'Invalid scheduled_start date' },
      { status: 400 }
    );
  }

  // Derive open_at (15 min before) and expires_at (end + 15 min grace)
  const earlyJoinMs = 15 * 60 * 1000;
  const graceMs = 15 * 60 * 1000;
  const openAt = new Date(scheduledDate.getTime() - earlyJoinMs);
  const expiresAt = new Date(
    scheduledDate.getTime() + duration_minutes * 60 * 1000 + graceMs
  );

  const roomId = generateRoomId();

  const insertResult = await db.withTransaction(async (client) => {
    // Insert room
    const result = await client.query(
      `INSERT INTO rooms (
        room_id, room_name, subject, grade, section,
        coordinator_email, teacher_email, status,
        scheduled_start, duration_minutes, open_at, expires_at,
        max_participants, fee_paise, notes_for_teacher
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        roomId,
        room_name,
        subject,
        grade,
        section || null,
        user.id,
        teacher_email || null,
        scheduledDate.toISOString(),
        duration_minutes,
        openAt.toISOString(),
        expiresAt.toISOString(),
        max_participants,
        fee_paise,
        notes_for_teacher || null,
      ]
    );

    // Audit event
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
       VALUES ($1, 'room_created', $2, 'coordinator', $3)`,
      [roomId, user.id, JSON.stringify({ room_name, subject, grade, teacher_email })]
    );

    // If teacher assigned, create room_assignment for them
    if (teacher_email) {
      await client.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
         VALUES ($1, 'teacher', $2, $2, 'exempt')
         ON CONFLICT (room_id, participant_email) DO NOTHING`,
        [roomId, teacher_email]
      );
    }

    return result.rows[0];
  });

  return NextResponse.json({
    success: true,
    data: { room: insertResult },
  }, { status: 201 });
}
