import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendGoLiveNotifications } from '@/lib/room-notifications';

/**
 * POST /api/v1/room/[room_id]/go-live
 *
 * Teacher clicks "Go Live" in the classroom UI.
 * Changes room status from 'scheduled' → 'live'.
 * Only the assigned teacher or admin roles can trigger this.
 *
 * After this, students can join the room.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    // Auth: session cookie required
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Verify room exists
    // Support both livekit_room_name (room_id) and batch session_id as identifiers
    const roomResult = await db.query(
      `SELECT room_id, status, room_name, teacher_email, subject, grade, scheduled_start, duration_minutes,
              batch_session_id
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found. Session may not have started yet — please wait for the prep window to open.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0] as Record<string, unknown>;
    const actualRoomId = room.room_id as string;
    const batchSessionId = room.batch_session_id as string | null;

    // Authorization: teacher of this room, or admin roles
    const adminRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    const isTeacherOfRoom = user.role === 'teacher' && room.teacher_email === user.id;
    const isAdmin = adminRoles.includes(user.role);

    if (!isTeacherOfRoom && !isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the assigned teacher can start the class' },
        { status: 403 }
      );
    }

    // Only scheduled rooms can go live
    if (room.status === 'live') {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Room is already live' },
        { status: 200 }
      );
    }

    if (room.status !== 'scheduled') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot go live — room status is "${room.status}"` },
        { status: 400 }
      );
    }

    // Update DB: scheduled → live using resolved room_id
    // Store actual go-live timestamp
    const goLiveAt = new Date().toISOString();
    const updateResult = await db.query(
      `UPDATE rooms SET status = 'live', updated_at = NOW(), go_live_at = NOW()
       WHERE room_id = $1 AND status = 'scheduled'`,
      [actualRoomId]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Room is already live' },
        { status: 200 }
      );
    }

    // Sync batch_session status to 'live' when teacher goes live
    if (batchSessionId) {
      await db.query(
        `UPDATE batch_sessions SET status = 'live', started_at = COALESCE(started_at, NOW())
         WHERE session_id = $1 AND status = 'scheduled'`,
        [batchSessionId]
      ).catch(e => console.warn('[go-live] batch_session sync warning:', e));
    }

    // Log event with go_live_at for coordinator reporting
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_started', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({ started_by: user.name, role: user.role, go_live_at: goLiveAt })]
    );

    // Fire-and-forget: notify students that class has started
    sendGoLiveNotifications({
      room_id: actualRoomId,
      room_name: room.room_name as string,
      subject: room.subject as string || '',
      grade: room.grade as string || '',
      scheduled_start: room.scheduled_start as string || new Date().toISOString(),
      duration_minutes: (room.duration_minutes as number) || 60,
    }).catch(err => console.error('[go-live] Notification error:', err));

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Class "${room.room_name}" is now live!`,
        data: { go_live_at: goLiveAt },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/go-live] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
