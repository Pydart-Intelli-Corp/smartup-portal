import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, SmartUpUser, PortalRole } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { createLiveKitToken, ensureRoom, ghostIdentity, listParticipants } from '@/lib/livekit';
import { isGhostRole } from '@/lib/utils';
import { calculateSessionFee, checkSessionPayment } from '@/lib/payment';

/**
 * POST /api/v1/room/join
 * Called by browser to get a LiveKit access token for a room.
 *
 * Auth (one of):
 *   1. Session cookie — normal logged-in user
 *   2. email_token in body — email invite link (no login needed)
 *
 * Body: { room_id, role?, device?, email_token? }
 *   device: 'primary' (default) | 'screen' (tablet screen-share device)
 *   email_token: LiveKit JWT from email link — used when user is NOT logged in
 *
 * Returns: { livekit_token, livekit_url, room_id, role, participant_name, device }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Parse body ───────────────────────────────────────────
    const body = await request.json();
    const { room_id, role: roleOverride, device: deviceParam, email_token } = body as {
      room_id?: string;
      role?: PortalRole;
      device?: 'primary' | 'screen';
      email_token?: string;
    };

    if (!room_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required field: room_id' },
        { status: 400 }
      );
    }

    // ── Auth: session cookie OR email_token ───────────────────
    let user: SmartUpUser | null = null;

    // Try session cookie first
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (sessionToken) {
      user = await verifySession(sessionToken);
    }

    // Fallback: email_token — verify against room_assignments DB
    if (!user && email_token) {
      const assignResult = await db.query(
        `SELECT participant_email, participant_name, participant_type
         FROM room_assignments
         WHERE room_id = $1 AND join_token = $2
         LIMIT 1`,
        [room_id, email_token]
      );
      if (assignResult.rows.length > 0) {
        const row = assignResult.rows[0] as Record<string, string>;
        user = {
          id: row.participant_email,
          name: row.participant_name,
          role: row.participant_type as PortalRole,
        };
      }
    }

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Device defaults to 'primary'; only teachers can use 'screen'
    const device = (deviceParam === 'screen' && user.role === 'teacher') ? 'screen' : 'primary';

    // ── Verify room exists in DB ─────────────────────────────
    // Support both livekit_room_name (room_id) and batch session_id as room identifier
    const roomResult = await db.query(
      `SELECT room_id, status, room_name, scheduled_start, duration_minutes,
              open_at, expires_at
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];
    const actualRoomId = String(room.room_id);

    // Prevent joining cancelled rooms
    if (room.status === 'cancelled') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This room has been cancelled' },
        { status: 410 }
      );
    }

    // Prevent joining ended rooms
    if (room.status === 'ended') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This class has already ended' },
        { status: 410 }
      );
    }

    // ── Fee payment gating (students only) ───────────────────
    // If the student has a room_assignment with payment_status = 'overdue' or 'pending',
    // block access. Teachers and ghost roles skip this check.
    if (user.role === 'student' || user.role === 'parent') {
      try {
        const payResult = await db.query(
          `SELECT payment_status FROM room_assignments
           WHERE room_id = $1 AND participant_email = $2
           LIMIT 1`,
          [room_id, user.id]
        );
        if (payResult.rows.length > 0) {
          const paymentStatus = String(payResult.rows[0].payment_status || 'not_required');
          if (paymentStatus === 'overdue') {
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'FEE_OVERDUE', message: 'Your fee payment is overdue. Please contact the coordinator to resolve outstanding fees before joining.' },
              { status: 402 }
            );
          }
          if (paymentStatus === 'pending') {
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'FEE_PENDING', message: 'Fee payment is pending confirmation. Please complete payment or wait for verification.' },
              { status: 402 }
            );
          }
        }
      } catch {
        // payment_status column may not exist yet — skip check
      }
    }

    // ── Per-session fee enforcement (students only) ──────────
    // check if fee is configured for this session; if so, require payment
    if (user.role === 'student') {
      try {
        const fee = await calculateSessionFee(room_id);
        if (fee && fee.amountPaise > 0) {
          const paid = await checkSessionPayment(room_id, user.id);
          if (!paid.paid) {
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'PAYMENT_REQUIRED', message: 'Please complete the session fee payment before joining. Use the payment option on the join page.' },
              { status: 402 }
            );
          }
        }
      } catch {
        // fee tables may not exist — skip
      }
    }

    // ── Role-based status gating ─────────────────────────────
    // Teachers can join scheduled rooms (they need to set up before going live).
    // Students and others can only join LIVE rooms.
    const isTeacher = user.role === 'teacher';
    const isGhost = isGhostRole(user.role);

    if (room.status === 'scheduled' && !isTeacher && !isGhost) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'CLASS_NOT_LIVE',
          message: 'The teacher has not started the class yet. Please wait — the page will update automatically when the class goes live.',
        },
        { status: 403 }
      );
    }

    // ── Time window validation ───────────────────────────────
    const now = new Date();

    // Check if room has expired (expires_at in past)
    if (room.expires_at && new Date(String(room.expires_at)) < now) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This room link has expired' },
        { status: 410 }
      );
    }

    // Check if class time has ended (scheduled_start + duration_minutes)
    if (room.scheduled_start && room.duration_minutes) {
      const classEnd = new Date(String(room.scheduled_start)).getTime() + Number(room.duration_minutes) * 60 * 1000;
      if (!isNaN(classEnd) && now.getTime() >= classEnd) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'This class has ended. The scheduled time has passed.' },
          { status: 410 }
        );
      }
    }

    // Check if room hasn't opened yet (open_at in future)
    // Allow 15 minutes early for lobby
    if (room.open_at) {
      const openAt = new Date(String(room.open_at));
      const earlyAccessMs = 15 * 60 * 1000; // 15 min early access
      if (now < new Date(openAt.getTime() - earlyAccessMs)) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: `This room opens at ${openAt.toISOString()}. You can join 15 minutes before.`,
          },
          { status: 425 }
        );
      }
    }

    // ── Rejoin detection for students ─────────────────────────
    let is_rejoin = false;
    if (user.role === 'student') {
      try {
        const attRes = await db.query(
          `SELECT join_count FROM attendance_sessions
           WHERE room_id = $1 AND participant_email = $2
           LIMIT 1`,
          [room_id, user.id],
        );
        if (attRes.rows.length > 0 && Number(attRes.rows[0].join_count) > 0) {
          is_rejoin = true;
        }
      } catch {
        // attendance table may not exist yet — ignore
      }
    }

    // ── Determine role and identity ──────────────────────────
    // Only allow ghost role override if the user's NATIVE role is already a ghost-eligible role
    const effectiveRole = roleOverride && isGhostRole(roleOverride) && isGhostRole(user.role)
      ? roleOverride
      : user.role;

    // Auto-detect dual-device: if teacher joins without device=screen but
    // their primary identity is already in the room, promote to screen device
    let resolvedDevice: 'primary' | 'screen' = device;
    if (user.role === 'teacher' && resolvedDevice === 'primary') {
      try {
        const primaryIdentity = `${user.role}_${user.id}`;
        const participants = await listParticipants(actualRoomId);
        const alreadyConnected = participants.some(
          (p) => p.identity === primaryIdentity
        );
        if (alreadyConnected) {
          resolvedDevice = 'screen';
          console.log(`[room/join] Teacher ${user.id} already connected as primary, auto-promoting to screen device`);
        }
      } catch {
        // Room may not exist yet on LiveKit — ignore, keep primary
      }
    }

    let participantIdentity: string;
    if (isGhostRole(effectiveRole) && effectiveRole !== user.role) {
      // Ghost mode override — generate unique ghost identity
      participantIdentity = ghostIdentity(effectiveRole, user.name);
    } else if (isGhostRole(user.role)) {
      // Native ghost role
      participantIdentity = ghostIdentity(user.role, user.name);
    } else if (resolvedDevice === 'screen') {
      // Teacher's screen-share device (tablet) — distinct identity
      participantIdentity = `${user.role}_${user.id}_screen`;
    } else {
      participantIdentity = `${user.role}_${user.id}`;
    }

    // ── Metadata attached to participant ─────────────────────
    const metadata = JSON.stringify({
      portal_user_id: user.id,
      portal_role: user.role,
      effective_role: effectiveRole,
      room_name: room.room_name,
      device: resolvedDevice, // 'primary' or 'screen'
    });

    // ── Ensure LiveKit room exists ───────────────────────────
    await ensureRoom(actualRoomId, JSON.stringify({
      room_name: room.room_name,
      portal_room_id: room.room_id,
    }));

    // ── Determine token role: screen device gets restricted grants ──
    // Teacher 'screen' device: can only screen share, no camera/mic/admin
    const tokenRole = (resolvedDevice === 'screen') ? 'teacher_screen' as PortalRole : effectiveRole;

    // ── Generate LiveKit token ───────────────────────────────
    const livekit_token = await createLiveKitToken({
      roomName: actualRoomId,
      participantIdentity,
      participantName: resolvedDevice === 'screen' ? `${user.name} (Screen)` : user.name,
      role: tokenRole,
      metadata,
    });

    const livekit_url = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

    return NextResponse.json<ApiResponse<{
      livekit_token: string;
      livekit_url: string;
      room_id: string;
      room_name: string;
      role: PortalRole;
      participant_name: string;
      participant_identity: string;
      device: 'primary' | 'screen';
      scheduled_start: string;
      duration_minutes: number;
      room_status: string;
      is_rejoin: boolean;
    }>>(
      {
        success: true,
        data: {
          livekit_token,
          livekit_url,
          room_id: actualRoomId,
          room_name: String(room.room_name || actualRoomId),
          role: effectiveRole,
          participant_name: user.name,
          participant_identity: participantIdentity,
          device: resolvedDevice,
          scheduled_start: room.scheduled_start ? new Date(String(room.scheduled_start)).toISOString() : new Date().toISOString(),
          duration_minutes: Number(room.duration_minutes) || 60,
          room_status: String(room.status),
          is_rejoin,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/join] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
