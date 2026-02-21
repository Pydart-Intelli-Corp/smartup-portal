// ═══════════════════════════════════════════════════════════════
// Room Notify API — POST /api/v1/coordinator/rooms/[room_id]/notify
// Generates real LiveKit tokens + join links and sends emails
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { createLiveKitToken } from '@/lib/livekit';
import { sendEmail } from '@/lib/email';
import { teacherInviteTemplate, studentInviteTemplate } from '@/lib/email-templates';
import type { PortalRole } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;

  // Auth check
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['coordinator', 'academic_operator', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Get room
  const roomResult = await db.query(
    'SELECT * FROM rooms WHERE room_id = $1',
    [room_id]
  );
  if (roomResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }
  const room = roomResult.rows[0] as Record<string, unknown>;

  if (room.status !== 'scheduled') {
    return NextResponse.json(
      { success: false, error: `Cannot notify for ${room.status} room` },
      { status: 400 }
    );
  }

  // Get all assignments
  const assignResult = await db.query(
    `SELECT * FROM room_assignments WHERE room_id = $1`,
    [room_id]
  );
  const assignments = assignResult.rows as Array<Record<string, unknown>>;

  if (assignments.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No participants assigned to this room' },
      { status: 400 }
    );
  }

  const emailsSent: string[] = [];
  const errors: string[] = [];

  for (const assignment of assignments) {
    const participantEmail = assignment.participant_email as string;
    const participantName = assignment.participant_name as string;
    const participantType = assignment.participant_type as string;
    const role = participantType as PortalRole;

    try {
      // Generate real LiveKit join token
      const livekitToken = await createLiveKitToken({
        roomName: room_id,
        participantIdentity: participantEmail,
        participantName: participantName,
        role,
        metadata: JSON.stringify({
          room_id,
          room_name: room.room_name,
          role: participantType,
        }),
      });

      // Build join link
      const joinLink = `${BASE_URL}/join/${room_id}?token=${livekitToken}`;

      // Store token in assignment
      await db.query(
        `UPDATE room_assignments SET join_token = $1, notification_sent_at = NOW() WHERE id = $2`,
        [livekitToken, assignment.id]
      );

      // Build template data and send directly (no queue)
      const scheduledStart = new Date(room.scheduled_start as string);
      const dateStr = scheduledStart.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const timeStr = scheduledStart.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
      const duration = `${room.duration_minutes} minutes`;

      let emailContent: { subject: string; html: string; text: string };
      if (participantType === 'teacher') {
        emailContent = teacherInviteTemplate({
          teacherName: participantName,
          roomName: room.room_name as string,
          subject: room.subject as string,
          grade: room.grade as string,
          date: dateStr,
          time: timeStr,
          duration,
          laptopLink: joinLink,
          tabletLink: `${joinLink}&device=tablet`,
          notes: (room.notes_for_teacher as string | null) ?? undefined,
          recipientEmail: participantEmail,
        });
      } else {
        emailContent = studentInviteTemplate({
          studentName: participantName,
          roomName: room.room_name as string,
          subject: room.subject as string,
          grade: room.grade as string,
          date: dateStr,
          time: timeStr,
          duration,
          joinLink,
          paymentStatus: (assignment.payment_status as 'paid' | 'unpaid' | 'exempt') ?? 'unpaid',
          recipientEmail: participantEmail,
        });
      }

      const result = await sendEmail({
        to: participantEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        priority: 'high',
      });

      if (!result.success) throw new Error(result.error || 'SMTP send failed');

      emailsSent.push(participantEmail);
    } catch (err) {
      console.error(`Failed to notify ${participantEmail}:`, err);
      errors.push(participantEmail);
    }
  }

  // Record event
  await db.query(
    `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
     VALUES ($1, 'notification_sent', $2, 'coordinator', $3)`,
    [
      room_id,
      user.id,
      JSON.stringify({ sent: emailsSent, failed: errors }),
    ]
  );

  // Update room reminder_sent_at
  await db.query(
    `UPDATE rooms SET reminder_sent_at = NOW() WHERE room_id = $1`,
    [room_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      sent: emailsSent.length,
      failed: errors.length,
      emails: emailsSent,
      errors,
    },
  });
}
