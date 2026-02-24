// ═══════════════════════════════════════════════════════════════
// Room Notification Helpers
// Sends emails on: creation, 30-min reminder, 5-min reminder, go-live
// All send synchronously (fire-and-forget from caller perspective)
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } from '@/lib/email';
import {
  teacherInviteTemplate,
  studentInviteTemplate,
  roomReminderTemplate,
  roomStartedTemplate,
  type RoomReminderData,
} from '@/lib/email-templates';
import { fmtDateLongIST, fmtTimeIST } from '@/lib/utils';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://smartuplearning.online';

// ── Types ───────────────────────────────────────────────────

interface RoomData {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  scheduled_start: string;
  duration_minutes: number;
  notes_for_teacher?: string | null;
}

interface Assignment {
  participant_email: string;
  participant_name: string;
  participant_type: 'teacher' | 'student';
  payment_status: string;
}

// ── Fetch participants for a room ───────────────────────────

async function getAssignments(roomId: string): Promise<Assignment[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_type, payment_status
     FROM room_assignments WHERE room_id = $1`,
    [roomId]
  );
  return result.rows as unknown as Assignment[];
}

// ── Send + log helper ───────────────────────────────────────

async function sendAndLog(
  roomId: string,
  recipientEmail: string,
  templateType: string,
  content: { subject: string; html: string; text: string }
): Promise<boolean> {
  try {
    const logId = await logEmailQueued(roomId, recipientEmail, templateType, content.subject);
    const result = await sendEmail({
      to: recipientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      priority: 'high',
    });
    if (result.success) {
      await logEmailSent(logId, result.messageId);
      return true;
    } else {
      await logEmailFailed(logId, result.error || 'Unknown');
      return false;
    }
  } catch (err) {
    console.error(`[room-notify] Failed to send ${templateType} to ${recipientEmail}:`, err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. ON ROOM CREATION — invite emails to teacher + students
// ═══════════════════════════════════════════════════════════════

export async function sendCreationNotifications(room: RoomData): Promise<void> {
  const assignments = await getAssignments(room.room_id);
  if (assignments.length === 0) return;

  const dateStr = fmtDateLongIST(room.scheduled_start);
  const timeStr = fmtTimeIST(room.scheduled_start);
  const duration = `${room.duration_minutes} minutes`;
  const joinBase = `${BASE_URL}/join/${room.room_id}`;

  for (const a of assignments) {
    if (a.participant_type === 'teacher') {
      const content = teacherInviteTemplate({
        teacherName: a.participant_name,
        roomName: room.room_name,
        subject: room.subject,
        grade: room.grade,
        date: dateStr,
        time: timeStr,
        duration,
        laptopLink: joinBase,
        tabletLink: `${joinBase}?device=tablet`,
        notes: room.notes_for_teacher ?? undefined,
        recipientEmail: a.participant_email,
      });
      await sendAndLog(room.room_id, a.participant_email, 'teacher_invite', content);
    } else {
      const content = studentInviteTemplate({
        studentName: a.participant_name,
        roomName: room.room_name,
        subject: room.subject,
        grade: room.grade,
        date: dateStr,
        time: timeStr,
        duration,
        joinLink: joinBase,
        paymentStatus: (a.payment_status as 'paid' | 'unpaid' | 'exempt') || 'unpaid',
        recipientEmail: a.participant_email,
      });
      await sendAndLog(room.room_id, a.participant_email, 'student_invite', content);
    }
  }

  console.log(`[room-notify] Creation emails sent for ${room.room_id} (${assignments.length} participants)`);
}

// ═══════════════════════════════════════════════════════════════
// 2. REMINDERS — 30-min and 5-min before class
// ═══════════════════════════════════════════════════════════════

export async function sendReminderNotifications(
  room: RoomData,
  minutesBefore: number
): Promise<number> {
  const assignments = await getAssignments(room.room_id);
  if (assignments.length === 0) return 0;

  const timeStr = fmtTimeIST(room.scheduled_start);
  const joinBase = `${BASE_URL}/join/${room.room_id}`;
  const studentCount = assignments.filter(a => a.participant_type === 'student').length;
  let sent = 0;

  for (const a of assignments) {
    const data: RoomReminderData & { recipientEmail: string } = {
      recipientName: a.participant_name,
      recipientRole: a.participant_type as 'teacher' | 'student',
      roomName: room.room_name,
      startTime: timeStr,
      recipientEmail: a.participant_email,
    };

    if (a.participant_type === 'teacher') {
      data.classSize = studentCount;
      data.laptopLink = joinBase;
      data.tabletLink = `${joinBase}?device=tablet`;
    } else {
      data.joinLink = joinBase;
      data.teacherName = assignments.find(x => x.participant_type === 'teacher')?.participant_name;
    }

    // Override subject line for 5-min reminder
    const content = roomReminderTemplate(data);
    if (minutesBefore <= 5) {
      content.subject = `Class starts in 5 minutes — ${room.room_name}`;
      content.text = content.text.replace('30 minutes', '5 minutes');
      content.html = content.html.replace(/30 minutes/g, '5 minutes');
    }

    const ok = await sendAndLog(
      room.room_id,
      a.participant_email,
      'room_reminder',
      content
    );
    if (ok) sent++;
  }

  console.log(`[room-notify] ${minutesBefore}-min reminders sent for ${room.room_id}: ${sent}/${assignments.length}`);
  return sent;
}

// ═══════════════════════════════════════════════════════════════
// 3. ON GO-LIVE — "Class has started" email
// ═══════════════════════════════════════════════════════════════

export async function sendGoLiveNotifications(room: RoomData): Promise<void> {
  const assignments = await getAssignments(room.room_id);
  if (assignments.length === 0) return;

  const joinBase = `${BASE_URL}/join/${room.room_id}`;
  const teacherName = assignments.find(a => a.participant_type === 'teacher')?.participant_name || 'Your teacher';

  for (const a of assignments) {
    // Only notify students — teacher already knows (they clicked Go Live)
    if (a.participant_type !== 'student') continue;

    const content = roomStartedTemplate({
      studentName: a.participant_name,
      roomName: room.room_name,
      teacherName,
      joinLink: joinBase,
      recipientEmail: a.participant_email,
    });
    await sendAndLog(room.room_id, a.participant_email, 'room_started', content);
  }

  console.log(`[room-notify] Go-live emails sent for ${room.room_id}`);
}
