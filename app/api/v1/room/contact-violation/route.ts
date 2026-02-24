import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/v1/room/contact-violation
 *
 * Records an unauthorized contact information detection event.
 * Called by the ChatPanel client when a message containing
 * phone numbers, social media handles, or other contact info is detected.
 *
 * Body: { room_id, sender_email, sender_name, sender_role, message_text, detected_pattern, severity }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      room_id,
      sender_email,
      sender_name,
      sender_role,
      message_text,
      detected_pattern,
      severity,
    } = body;

    if (!room_id || !sender_email || !message_text || !detected_pattern) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO contact_violations
         (room_id, sender_email, sender_name, sender_role, message_text, detected_pattern, severity, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [room_id, sender_email, sender_name || '', sender_role || '', message_text, detected_pattern, severity || 'warning'],
    );

    // Also log as a room_event for the audit trail
    try {
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'contact_violation', $2::jsonb)`,
        [
          room_id,
          JSON.stringify({
            sender_email,
            sender_name,
            sender_role,
            detected_pattern,
            severity,
            message_preview: message_text.substring(0, 100),
          }),
        ],
      );
    } catch {
      // room_events logging is best-effort
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact-violation] Error recording violation:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
