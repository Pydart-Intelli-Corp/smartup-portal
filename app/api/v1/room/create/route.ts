import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { ensureRoom } from '@/lib/livekit';

/**
 * POST /api/v1/room/create
 * Creates a new room in the database and ensures it exists on LiveKit.
 * Auth: requires coordinator, academic_operator, academic, or owner role.
 *
 * Body: { room_id, room_name, teacher_email?, subject?, grade?, scheduled_start?, duration_minutes?, open_at?, expires_at? }
 */
export async function POST(request: NextRequest) {
  try {
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

    // Only coordinators, academic staff, and owners can create rooms
    const allowedRoles = ['coordinator', 'academic_operator', 'academic', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Insufficient permissions — room creation requires coordinator or academic role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      room_id,
      room_name,
      teacher_email,
      subject,
      grade,
      scheduled_start,
      duration_minutes = 60,
      open_at,
      expires_at,
    } = body as {
      room_id: string;
      room_name: string;
      teacher_email?: string;
      subject?: string;
      grade?: string;
      scheduled_start?: string;
      duration_minutes?: number;
      open_at?: string;
      expires_at?: string;
    };

    if (!room_id || !room_name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: room_id, room_name' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await db.query('SELECT room_id FROM rooms WHERE room_id = $1', [room_id]);
    if (existing.rows.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room already exists with this ID' },
        { status: 409 }
      );
    }

    // Calculate open_at and expires_at defaults
    const scheduledDate = scheduled_start ? new Date(scheduled_start) : new Date();
    const defaultOpenAt = open_at || new Date(scheduledDate.getTime() - 15 * 60 * 1000).toISOString(); // 15 min before
    const defaultExpiresAt = expires_at || new Date(scheduledDate.getTime() + duration_minutes * 60 * 1000 + 30 * 60 * 1000).toISOString(); // duration + 30 min buffer

    // Insert room into database
    const result = await db.query(
      `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, status, scheduled_start, duration_minutes, open_at, expires_at, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [room_id, room_name, teacher_email || null, subject || null, grade || null, scheduledDate.toISOString(), duration_minutes, defaultOpenAt, defaultExpiresAt, user.id]
    );

    // Ensure the room exists on LiveKit server
    const livekitRoom = await ensureRoom(room_id, JSON.stringify({
      room_name,
      portal_room_id: room_id,
      created_by: user.id,
    }));

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_created', $2, $3)`,
      [room_id, user.id, JSON.stringify({ room_name, livekit_sid: livekitRoom.sid })]
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          room: result.rows[0],
          livekit_sid: livekitRoom.sid,
        },
        message: 'Room created successfully',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[room/create] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
