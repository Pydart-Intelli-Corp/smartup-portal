import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

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
    const roomResult = await db.query(
      'SELECT room_id, status, room_name, teacher_email FROM rooms WHERE room_id = $1',
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Authorization: teacher of this room, or admin roles
    const adminRoles = ['coordinator', 'academic_operator', 'academic', 'owner'];
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

    // Update DB: scheduled → live
    await db.query(
      `UPDATE rooms SET status = 'live', updated_at = NOW()
       WHERE room_id = $1 AND status = 'scheduled'`,
      [room_id]
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_go_live', $2, $3)`,
      [room_id, user.id, JSON.stringify({ started_by: user.name, role: user.role })]
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Class "${room.room_name}" is now live!`,
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
