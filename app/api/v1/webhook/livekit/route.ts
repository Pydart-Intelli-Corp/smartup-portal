import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { webhookReceiver } from '@/lib/livekit';
import { db } from '@/lib/db';

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

      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_ended_by_teacher', $2)`,
        [room.name, JSON.stringify({ sid: room.sid })]
      );
    }

    // ── Handle: participant_joined ───────────────────────────
    if (eventType === 'participant_joined' && room && participant) {
      const metadata = safeParseJson(participant.metadata);

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_joined', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          metadata?.effective_role || metadata?.portal_role || 'unknown',
          JSON.stringify({
            name: participant.name,
            sid: participant.sid,
            metadata: participant.metadata,
          }),
        ]
      );
    }

    // ── Handle: participant_left ─────────────────────────────
    if (eventType === 'participant_left' && room && participant) {
      const metadata = safeParseJson(participant.metadata);

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_left', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          metadata?.effective_role || metadata?.portal_role || 'unknown',
          JSON.stringify({
            name: participant.name,
            sid: participant.sid,
            joinedAt: participant.joinedAt,
          }),
        ]
      );
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
