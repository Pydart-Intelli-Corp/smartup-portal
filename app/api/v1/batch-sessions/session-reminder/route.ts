// ═══════════════════════════════════════════════════════════════
// Session Reminder Email API (30 minutes before class)
// POST /api/v1/batch-sessions/session-reminder
//
// Finds sessions starting in the next 30 minutes and sends
// reminder emails with join links to all participants (teacher,
// students, parents, batch coordinator).
//
// Uses email_log with template_type='session_reminder' to
// deduplicate — each session_id only gets one batch of
// reminder emails.
//
// Called by AO dashboard polling every 60s.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';
import { sessionReminderTemplate } from '@/lib/email-templates';
import type { PortalRole } from '@/types';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator'].includes(user.role)) return null;
  return user;
}

// ── Helper: format time from HH:MM:SS to 12h ────────────────
function fmtTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // ── Find sessions starting within 30 minutes ─────────
    // Sessions that are 'scheduled' or 'live' (already auto-started)
    // and whose start_time is within the next 30 minutes window
    const sessionsRes = await db.query(`
      SELECT s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
             s.livekit_room_name, s.start_time, s.duration_minutes, s.topic,
             s.scheduled_date, s.status,
             b.batch_name, b.coordinator_email, b.academic_operator_email
      FROM batch_sessions s
      JOIN batches b ON b.batch_id = s.batch_id
      WHERE s.status IN ('scheduled', 'live')
        AND s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= (s.start_time - interval '30 minutes')
        AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time < s.start_time
      ORDER BY s.start_time ASC
    `);

    if (sessionsRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sent: 0, sessions_notified: 0 },
        message: 'No sessions starting within 30 minutes',
      });
    }

    // ── Filter out sessions already reminded ─────────────
    const sessionIds = sessionsRes.rows.map(r => (r as { session_id: string }).session_id);
    const alreadyReminded = await db.query(
      `SELECT DISTINCT substring(subject from 'SID:([a-f0-9-]+)') AS session_id
       FROM email_log
       WHERE template_type = 'session_reminder'
         AND created_at::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND substring(subject from 'SID:([a-f0-9-]+)') = ANY($1)`,
      [sessionIds]
    );
    const remindedSet = new Set(
      alreadyReminded.rows.map(r => (r as { session_id: string }).session_id)
    );

    const sessionsToNotify = sessionsRes.rows.filter(
      r => !remindedSet.has((r as { session_id: string }).session_id)
    );

    if (sessionsToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sent: 0, sessions_notified: 0 },
        message: 'All upcoming sessions already reminded',
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.smartuplearning.online';
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://smartuplearning.online';
    let totalSent = 0;
    let sessionsNotified = 0;

    for (const row of sessionsToNotify) {
      const session = row as {
        session_id: string; batch_id: string; subject: string; teacher_email: string;
        teacher_name: string; livekit_room_name: string; start_time: string;
        duration_minutes: number; topic: string | null; scheduled_date: string;
        status: string; batch_name: string; coordinator_email: string;
        academic_operator_email: string;
      };

      try {
        const roomName = session.livekit_room_name;
        const startTime12 = fmtTime12(session.start_time);

        // Ensure LiveKit room exists (may already be live from auto-start)
        await ensureRoom(roomName, JSON.stringify({
          session_id: session.session_id,
          batch_id: session.batch_id,
          subject: session.subject,
          batch_name: session.batch_name,
        }));

        // If still 'scheduled', mark as 'live' so participants can join
        if (session.status === 'scheduled') {
          await db.query(
            `UPDATE batch_sessions SET status = 'live', started_at = NOW() WHERE session_id = $1 AND status = 'scheduled'`,
            [session.session_id]
          );
        }

        // ── Generate tokens & send emails ──────────────
        type Recipient = {
          email: string; name: string;
          role: PortalRole;
          displayRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
          childName?: string;
        };
        const recipients: Recipient[] = [];

        // Teacher
        if (session.teacher_email) {
          recipients.push({
            email: session.teacher_email,
            name: session.teacher_name || 'Teacher',
            role: 'teacher' as PortalRole,
            displayRole: 'teacher',
          });
        }

        // Coordinator
        if (session.coordinator_email) {
          const coordRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [session.coordinator_email]);
          const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
          recipients.push({
            email: session.coordinator_email,
            name: coordName,
            role: 'batch_coordinator' as PortalRole,
            displayRole: 'batch_coordinator',
          });
        }

        // Students & Parents
        const studentsRes = await db.query(`
          SELECT bs.student_email, bs.parent_email,
                 u.full_name AS student_name, pu.full_name AS parent_name
          FROM batch_students bs
          LEFT JOIN portal_users u ON u.email = bs.student_email
          LEFT JOIN portal_users pu ON pu.email = bs.parent_email
          WHERE bs.batch_id = $1
        `, [session.batch_id]);

        for (const sRow of studentsRes.rows) {
          const st = sRow as { student_email: string; student_name: string; parent_email: string | null; parent_name: string | null };
          recipients.push({
            email: st.student_email,
            name: st.student_name || st.student_email,
            role: 'student' as PortalRole,
            displayRole: 'student',
          });

          if (st.parent_email) {
            recipients.push({
              email: st.parent_email,
              name: st.parent_name || st.parent_email,
              role: 'parent' as PortalRole,
              displayRole: 'parent',
              childName: st.student_name || st.student_email,
            });
          }
        }

        // Generate token and send email for each recipient
        for (const recipient of recipients) {
          try {
            const token = await createLiveKitToken({
              roomName,
              participantIdentity: recipient.email,
              participantName: recipient.name,
              role: recipient.role,
            });

            const joinUrl = `${baseUrl}/classroom/${session.session_id}?token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;

            const { subject, html, text } = sessionReminderTemplate({
              recipientName: recipient.name,
              recipientRole: recipient.displayRole,
              subject: session.subject,
              teacherName: session.teacher_name || 'TBA',
              batchName: session.batch_name,
              startTime: startTime12,
              duration: `${session.duration_minutes} min`,
              topic: session.topic || undefined,
              childName: recipient.childName,
              joinUrl,
              recipientEmail: recipient.email,
            });

            // Include session_id in subject for dedup tracking
            const subjectWithId = `${subject} [SID:${session.session_id}]`;

            // Log to email_log
            const logRes = await db.query<{ id: string }>(
              `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
               VALUES (NULL, $1, 'session_reminder', $2, 'queued') RETURNING id`,
              [recipient.email, subjectWithId]
            );
            const logId = logRes.rows[0].id;

            const result = await sendEmail({
              to: recipient.email,
              subject,
              html,
              text,
              priority: 'high',
            });

            if (result.success) {
              await db.query(`UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`, [result.messageId || null, logId]);
              totalSent++;
            } else {
              await db.query(`UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error || 'Unknown', logId]);
            }
          } catch (err) {
            console.error(`[session-reminder] Failed to email ${recipient.email} for session ${session.session_id}:`, err);
          }
        }

        sessionsNotified++;
      } catch (err) {
        console.error(`[session-reminder] Failed to process session ${session.session_id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: totalSent,
        sessions_notified: sessionsNotified,
      },
      message: totalSent > 0
        ? `Sent ${totalSent} reminder${totalSent > 1 ? 's' : ''} for ${sessionsNotified} session${sessionsNotified > 1 ? 's' : ''}`
        : 'No reminders sent',
    });

  } catch (err) {
    console.error('[session-reminder] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to send session reminder emails',
    }, { status: 500 });
  }
}
