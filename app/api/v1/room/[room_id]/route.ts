import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { deleteRoom as deleteLiveKitRoom } from '@/lib/livekit';

/**
 * DELETE /api/v1/room/[room_id]
 * Ends a class: deletes the LiveKit room (disconnects all participants)
 * and marks the room as 'ended' in the DB.
 * Auth: teacher (who is assigned to the room), coordinator, academic_operator, owner.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

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
        { success: false, error: 'Only the assigned teacher or admin roles can end a class' },
        { status: 403 }
      );
    }

    // Delete the LiveKit room (disconnects all participants instantly)
    try {
      await deleteLiveKitRoom(room_id);
    } catch (e) {
      // Room may already be gone from LiveKit — that's okay
      console.warn(`[room/delete] LiveKit room delete warning for ${room_id}:`, e);
    }

    // Update DB status to ended
    await db.query(
      `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW()
       WHERE room_id = $1`,
      [room_id]
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_ended_by_teacher', $2, $3)`,
      [room_id, user.id, JSON.stringify({ ended_by: user.name, role: user.role })]
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Class "${room.room_name}" has been ended. All participants disconnected.`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/delete] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
