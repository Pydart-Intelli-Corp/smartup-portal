import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { webhookReceiver } from '@/lib/livekit';
import { db } from '@/lib/db';
import { recordJoin, recordLeave, finalizeAttendance } from '@/lib/attendance';
import { autoGenerateSessionReport } from '@/lib/reports';

/**
 * POST /api/v1/webhook/livekit
 * Receives LiveKit server webhook events.
 * Auth: verified using WebhookReceiver (checks Authorization header).
 *
 * Events handled:
 * - room_started  → mark room as Live in DB
 * - room_finished → mark room as Completed
 * - participant_joined → log join event
 * - participant_left   → log leave event
 */
export async function POST(request: NextRequest) {
  try {
    // ── Read raw body + auth header ──────────────────────────
    const body = await request.text();
    const authHeader = request.headers.get('authorization') || '';

    // ── Verify webhook signature ─────────────────────────────
    let event;
    try {
      event = await webhookReceiver.receive(body, authHeader);
    } catch (err) {
      console.error('[webhook/livekit] Signature verification failed:', err);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const eventType = event.event;
    const room = event.room;
    const participant = event.participant;

    console.log(`[webhook/livekit] Event: ${eventType}, Room: ${room?.name || 'N/A'}`);

    // ── Handle: room_started ─────────────────────────────────
    // Note: We no longer auto-set status to 'live' here.
    // The teacher explicitly triggers "Go Live" via /api/v1/room/[room_id]/go-live.
    // We only log the event.
    if (eventType === 'room_started' && room) {
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_started', $2)`,
        [room.name, JSON.stringify({ sid: room.sid })]
      );
    }

    // ── Handle: room_finished ────────────────────────────────
    if (eventType === 'room_finished' && room) {
      await db.query(
        `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW()
         WHERE room_id = $1 AND status IN ('live', 'scheduled')`,
        [room.name]
      );

      // Sync batch_sessions status → 'ended'
      await db.query(
        `UPDATE batch_sessions SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
         WHERE session_id = (
           SELECT batch_session_id FROM rooms WHERE room_id = $1 LIMIT 1
         ) AND status IN ('live', 'scheduled')`,
        [room.name]
      ).catch(e => console.warn('[webhook/livekit] batch_session sync warning:', e));

      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_ended_by_teacher', $2)`,
        [room.name, JSON.stringify({ sid: room.sid })]
      );

      // Finalize attendance — mark all unjoined students as absent
      try { await finalizeAttendance(room.name); } catch (e) {
        console.error('[webhook/livekit] Failed to finalize attendance:', e);
      }

      // Auto-generate session report
      try { await autoGenerateSessionReport(room.name); } catch (e) {
        console.error('[webhook/livekit] Failed to auto-generate session report:', e);
      }
    }

    // ── Handle: participant_joined ───────────────────────────
    if (eventType === 'participant_joined' && room && participant) {
      const metadata = safeParseJson(participant.metadata);
      const role = String(metadata?.effective_role || metadata?.portal_role || 'unknown');

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_joined', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          role,
          JSON.stringify({
            name: participant.name,
            sid: participant.sid,
            metadata: participant.metadata,
          }),
        ]
      );

      // Record attendance join (get scheduled_start for late detection)
      if (role === 'student' || role === 'teacher') {
        const email = extractEmail(participant.identity, metadata);
        try {
          const roomRow = await db.query(
            `SELECT scheduled_start FROM rooms WHERE room_id = $1`,
            [room.name],
          );
          const scheduledStart = roomRow.rows[0]?.scheduled_start
            ? new Date(String(roomRow.rows[0].scheduled_start)).toISOString()
            : null;
          await recordJoin(
            room.name,
            email,
            participant.name || email,
            role,
            scheduledStart,
          );
        } catch (e) {
          console.error('[webhook/livekit] Attendance recordJoin failed:', e);
        }
      }
    }

    // ── Handle: participant_left ─────────────────────────────
    if (eventType === 'participant_left' && room && participant) {
      const metadata = safeParseJson(participant.metadata);
      const role = String(metadata?.effective_role || metadata?.portal_role || 'unknown');

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_left', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          role,
          JSON.stringify({
            name: participant.name,
            sid: participant.sid,
            joinedAt: participant.joinedAt,
          }),
        ]
      );

      // Record attendance leave
      if (role === 'student' || role === 'teacher') {
        const email = extractEmail(participant.identity, metadata);
        try {
          await recordLeave(
            room.name,
            email,
            participant.name || email,
            role,
          );
        } catch (e) {
          console.error('[webhook/livekit] Attendance recordLeave failed:', e);
        }
      }
    }

    return NextResponse.json<ApiResponse>({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[webhook/livekit] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────

function safeParseJson(str?: string): Record<string, unknown> | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Extract the real email from a LiveKit identity string.
 * Identity format: {role}_{email} (e.g., student_john@example.com)
 * Also handles: teacher_email@x.com_screen
 * Falls back to metadata.portal_user_id or raw identity.
 */
function extractEmail(identity: string, metadata: Record<string, unknown> | null): string {
  // 1. Prefer metadata.portal_user_id (set on all new tokens)
  if (metadata?.portal_user_id && typeof metadata.portal_user_id === 'string') {
    return metadata.portal_user_id;
  }

  // 2. Parse from identity by stripping role prefix and _screen suffix
  let id = identity;
  if (id.endsWith('_screen')) id = id.slice(0, -7);

  const knownPrefixes = ['academic_operator_', 'batch_coordinator_', 'teacher_', 'student_', 'parent_', 'owner_', 'ghost_', 'hr_'];
  for (const prefix of knownPrefixes) {
    if (id.startsWith(prefix)) {
      return id.slice(prefix.length);
    }
  }

  // 3. Fallback: return identity as-is (legacy tokens without role prefix)
  return identity;
}
