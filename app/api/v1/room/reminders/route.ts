// ═══════════════════════════════════════════════════════════════
// Room Reminders Cron API — GET /api/v1/room/reminders
// Called by server cron every minute. Sends:
//   - 30-minute reminder (rooms starting in 28–32 min window)
//   - 5-minute reminder  (rooms starting in 3–7 min window)
// Uses email_log to avoid duplicate sends per room per window.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendReminderNotifications } from '@/lib/room-notifications';

// Simple bearer token for cron auth (use CRON_SECRET env var)
const CRON_SECRET = process.env.CRON_SECRET || 'smartup-cron-2026';

export async function GET(req: NextRequest) {
  // Auth: require cron secret or internal call
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  if (authHeader !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, unknown>[] = [];

  // ── 30-minute window: rooms starting 28–32 min from now ───
  const min30Low = new Date(now.getTime() + 28 * 60_000);
  const min30High = new Date(now.getTime() + 32 * 60_000);

  const rooms30 = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade,
            r.scheduled_start, r.duration_minutes, r.notes_for_teacher
     FROM rooms r
     WHERE r.status = 'scheduled'
       AND r.scheduled_start BETWEEN $1 AND $2
       AND NOT EXISTS (
         SELECT 1 FROM email_log el
         WHERE el.room_id = r.room_id
           AND el.template_type = 'room_reminder'
           AND el.created_at > NOW() - INTERVAL '35 minutes'
       )`,
    [min30Low.toISOString(), min30High.toISOString()]
  );

  for (const room of rooms30.rows) {
    const sent = await sendReminderNotifications(room as {
      room_id: string; room_name: string; subject: string; grade: string;
      scheduled_start: string; duration_minutes: number; notes_for_teacher?: string;
    }, 30);
    results.push({ room_id: room.room_id, type: '30min', sent });
  }

  // ── 5-minute window: rooms starting 3–7 min from now ─────
  const min5Low = new Date(now.getTime() + 3 * 60_000);
  const min5High = new Date(now.getTime() + 7 * 60_000);

  const rooms5 = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade,
            r.scheduled_start, r.duration_minutes, r.notes_for_teacher
     FROM rooms r
     WHERE r.status = 'scheduled'
       AND r.scheduled_start BETWEEN $1 AND $2
       AND NOT EXISTS (
         SELECT 1 FROM email_log el
         WHERE el.room_id = r.room_id
           AND el.template_type = 'room_reminder'
           AND el.created_at > NOW() - INTERVAL '8 minutes'
           AND el.subject LIKE '%5 minutes%'
       )`,
    [min5Low.toISOString(), min5High.toISOString()]
  );

  for (const room of rooms5.rows) {
    const sent = await sendReminderNotifications(room as {
      room_id: string; room_name: string; subject: string; grade: string;
      scheduled_start: string; duration_minutes: number; notes_for_teacher?: string;
    }, 5);
    results.push({ room_id: room.room_id, type: '5min', sent });
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    reminders: results,
  });
}
