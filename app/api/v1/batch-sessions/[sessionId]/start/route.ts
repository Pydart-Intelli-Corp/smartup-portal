// ═══════════════════════════════════════════════════════════════
// Batch Session Start API — Creates LiveKit room & generates tokens
// POST /api/v1/batch-sessions/[sessionId]/start
//
// Creates the LiveKit room and returns join tokens for all
// participants: teacher, students, parents, coordinator, AO
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';
import type { PortalRole } from '@/types';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator', 'teacher'].includes(user.role)) return null;
  return user;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  // Fetch session + batch details
  const sessionRes = await db.query(
    `SELECT s.*, b.batch_name, b.coordinator_email, b.academic_operator_email
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     WHERE s.session_id = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  }

  const session = sessionRes.rows[0] as Record<string, unknown>;

  if (session.status !== 'scheduled' && session.status !== 'live') {
    return NextResponse.json({
      success: false,
      error: `Cannot start session in '${session.status}' status`,
    }, { status: 400 });
  }

  const roomName = session.livekit_room_name as string;

  // 1. Create LiveKit room
  try {
    await ensureRoom(roomName, JSON.stringify({
      session_id: sessionId,
      batch_id: session.batch_id,
      subject: session.subject,
      batch_name: session.batch_name,
    }));
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: `Failed to create LiveKit room: ${String(err)}`,
    }, { status: 500 });
  }

  // 2. Upsert into rooms table so go-live / end-session routes can find the room.
  //    Status stays 'scheduled' — teacher must click Go Live inside the classroom
  //    to promote to 'live'. (batch_sessions status is NOT changed here.)
  try {
    const rawDate = typeof session.scheduled_date === 'object'
      ? (session.scheduled_date as Date).toISOString().slice(0, 10)
      : (session.scheduled_date as string).slice(0, 10);
    const rawTime = (session.start_time as string).slice(0, 5);
    const scheduledStart = new Date(`${rawDate}T${rawTime}+05:30`);
    const durationMins = Number(session.duration_minutes) || 90;
    await db.query(
      `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, section, batch_type, status,
                          scheduled_start, duration_minutes, batch_id, batch_session_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, $11, 'teacher', NOW(), NOW())
       ON CONFLICT (room_id) DO UPDATE SET
         batch_id = EXCLUDED.batch_id, batch_session_id = EXCLUDED.batch_session_id, updated_at = NOW()`,
      [roomName, `${session.batch_name} — ${session.subject}`, session.teacher_email || null,
       session.subject || null, session.grade || null, session.section || null,
       session.batch_type || 'one_to_many', scheduledStart.toISOString(), durationMins,
       session.batch_id, sessionId]
    );
  } catch (err) {
    // Non-fatal — room may already exist from auto-start
    console.warn('[session/start] rooms upsert warning:', err);
  }

  // 3. Generate tokens for ALL participants
  // IMPORTANT: identity format MUST be "{role}_{email}" to match /room/join route.
  // metadata MUST include portal_role, effective_role, device for ParticipantList role badges.
  const roomDisplayName = `${session.batch_name} — ${session.subject || 'General'}`;
  const tokens: { email: string; name: string; role: string; token: string }[] = [];

  // Teacher token
  if (session.teacher_email) {
    const teacherToken = await createLiveKitToken({
      roomName,
      participantIdentity: `teacher_${session.teacher_email}`,
      participantName: (session.teacher_name as string) || 'Teacher',
      role: 'teacher' as PortalRole,
      metadata: JSON.stringify({
        portal_user_id: session.teacher_email,
        portal_role: 'teacher',
        effective_role: 'teacher',
        room_name: roomDisplayName,
        device: 'primary',
      }),
    });
    tokens.push({
      email: session.teacher_email as string,
      name: (session.teacher_name as string) || 'Teacher',
      role: 'teacher',
      token: teacherToken,
    });
  }

  // Student tokens
  const students = await db.query(
    `SELECT bs.student_email, bs.parent_email, u.full_name AS student_name,
            pu.full_name AS parent_name
     FROM batch_students bs
     LEFT JOIN portal_users u ON u.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     WHERE bs.batch_id = $1`,
    [session.batch_id]
  );

  for (const s of students.rows) {
    const student = s as { student_email: string; student_name: string; parent_email: string | null; parent_name: string | null };

    // Student token
    const studentToken = await createLiveKitToken({
      roomName,
      participantIdentity: `student_${student.student_email}`,
      participantName: student.student_name || student.student_email,
      role: 'student' as PortalRole,
      metadata: JSON.stringify({
        portal_user_id: student.student_email,
        portal_role: 'student',
        effective_role: 'student',
        room_name: roomDisplayName,
        device: 'primary',
      }),
    });
    tokens.push({
      email: student.student_email,
      name: student.student_name || student.student_email,
      role: 'student',
      token: studentToken,
    });

    // Parent token (hidden observer)
    if (student.parent_email) {
      const parentToken = await createLiveKitToken({
        roomName,
        participantIdentity: `parent_${student.parent_email}`,
        participantName: student.parent_name || student.parent_email,
        role: 'parent' as PortalRole,
        metadata: JSON.stringify({
          portal_user_id: student.parent_email,
          portal_role: 'parent',
          effective_role: 'parent',
          room_name: roomDisplayName,
          device: 'primary',
        }),
      });
      tokens.push({
        email: student.parent_email,
        name: student.parent_name || student.parent_email,
        role: 'parent',
        token: parentToken,
      });
    }
  }

  // Coordinator token (hidden observer)
  if (session.coordinator_email) {
    const coordRes = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`,
      [session.coordinator_email]
    );
    const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
    const coordToken = await createLiveKitToken({
      roomName,
      participantIdentity: `batch_coordinator_${session.coordinator_email}`,
      participantName: coordName,
      role: 'batch_coordinator' as PortalRole,
      metadata: JSON.stringify({
        portal_user_id: session.coordinator_email,
        portal_role: 'batch_coordinator',
        effective_role: 'batch_coordinator',
        room_name: roomDisplayName,
        device: 'primary',
      }),
    });
    tokens.push({
      email: session.coordinator_email as string,
      name: coordName,
      role: 'batch_coordinator',
      token: coordToken,
    });
  }

  // Academic Operator token (hidden observer)
  if (session.academic_operator_email) {
    const aoRes = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`,
      [session.academic_operator_email]
    );
    const aoName = aoRes.rows.length > 0 ? (aoRes.rows[0] as { full_name: string }).full_name : 'Academic Operator';
    const aoToken = await createLiveKitToken({
      roomName,
      participantIdentity: `academic_operator_${session.academic_operator_email}`,
      participantName: aoName,
      role: 'academic_operator' as PortalRole,
      metadata: JSON.stringify({
        portal_user_id: session.academic_operator_email,
        portal_role: 'academic_operator',
        effective_role: 'academic_operator',
        room_name: roomDisplayName,
        device: 'primary',
      }),
    });
    tokens.push({
      email: session.academic_operator_email as string,
      name: aoName,
      role: 'academic_operator',
      token: aoToken,
    });
  }

  // Build join URLs
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://smartuplearning.online';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.smartuplearning.online';

  const joinLinks = tokens.map((t) => ({
    ...t,
    join_url: `${baseUrl}/classroom/${sessionId}?token=${encodeURIComponent(t.token)}&ws=${encodeURIComponent(wsUrl)}`,
  }));

  return NextResponse.json({
    success: true,
    data: {
      session_id: sessionId,
      livekit_room_name: roomName,
      ws_url: wsUrl,
      participants: joinLinks,
    },
    message: 'Session started — LiveKit room created & tokens generated',
  });
}
