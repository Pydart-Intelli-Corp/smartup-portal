// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — WhatsApp Notification Service
// ═══════════════════════════════════════════════════════════════
// Supports: Twilio WhatsApp API (primary), mock mode for dev
// Templates: class reminders, payment dues, exam notifications,
//            attendance alerts, general announcements
//
// Usage:
//   import { sendWhatsApp, sendBulkReminders } from '@/lib/whatsapp';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Configuration ───────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const WHATSAPP_MODE = process.env.WHATSAPP_MODE || 'mock'; // 'live' | 'mock'

// ── Message Templates ───────────────────────────────────────

export const TEMPLATES = {
  class_reminder: (data: { studentName: string; subject: string; time: string; teacherName: string }) =>
    `📚 *SmartUp Class Reminder*\n\nHi ${data.studentName},\n\nYour *${data.subject}* class is starting at *${data.time}*.\nTeacher: ${data.teacherName}\n\nJoin from your dashboard: https://smartuplearning.online/student`,

  payment_due: (data: { parentName: string; studentName: string; amount: string; dueDate: string }) =>
    `💰 *SmartUp Fee Reminder*\n\nDear ${data.parentName},\n\nPayment of *${data.amount}* for ${data.studentName} is due by *${data.dueDate}*.\n\nPay at: https://smartuplearning.online/parent`,

  exam_scheduled: (data: { studentName: string; examTitle: string; date: string; subject: string }) =>
    `📝 *SmartUp Exam Notice*\n\nHi ${data.studentName},\n\nYou have an upcoming exam:\n*${data.examTitle}*\nSubject: ${data.subject}\nDate: ${data.date}\n\nPrepare well!`,

  exam_result: (data: { studentName: string; examTitle: string; score: string; grade: string; percentage: string }) =>
    `🎓 *SmartUp Exam Result*\n\nHi ${data.studentName},\n\n*${data.examTitle}* Results:\nScore: ${data.score}\nPercentage: ${data.percentage}%\nGrade: ${data.grade}\n\nView details at: https://smartuplearning.online/student/exams`,

  attendance_alert: (data: { parentName: string; studentName: string; date: string; status: string }) =>
    `📋 *SmartUp Attendance Alert*\n\nDear ${data.parentName},\n\n${data.studentName} was *${data.status}* on ${data.date}.\n\nView details at: https://smartuplearning.online/parent`,

  general: (data: { recipientName: string; message: string }) =>
    `📢 *SmartUp Notification*\n\nHi ${data.recipientName},\n\n${data.message}`,
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// ── Send Single WhatsApp Message ────────────────────────────

export interface SendWhatsAppInput {
  to: string;            // phone number with country code (e.g. +919876543210)
  template: TemplateName;
  templateData: Record<string, string>;
  recipientEmail?: string; // for logging
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, template, templateData, recipientEmail } = input;

  // Generate message body from template
  const templateFn = TEMPLATES[template] as (data: Record<string, string>) => string;
  const messageBody = templateFn(templateData);

  let messageId: string | undefined;
  let status: 'sent' | 'failed' = 'sent';
  let errorMsg: string | undefined;

  if (WHATSAPP_MODE === 'live' && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_FROM,
          To: `whatsapp:${to}`,
          Body: messageBody,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        messageId = result.sid;
        status = 'sent';
      } else {
        errorMsg = result.message || 'Twilio Error';
        status = 'failed';
      }
    } catch (err) {
      errorMsg = String(err);
      status = 'failed';
    }
  } else {
    // Mock mode — log and record
    messageId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[whatsapp:mock] To: ${to}, Template: ${template}, Body:\n${messageBody}\n`);
  }

  // Log to notification_log
  try {
    await db.query(
      `INSERT INTO notification_log (channel, recipient, template, payload, status, external_id)
       VALUES ('whatsapp', $1, $2, $3::jsonb, $4, $5)`,
      [recipientEmail || to, template, JSON.stringify({ to, body: messageBody, ...templateData }), status, messageId || null]
    );
  } catch (logErr) {
    console.error('[whatsapp] Failed to log notification:', logErr);
  }

  return { success: status === 'sent', messageId, error: errorMsg };
}

// ── Bulk Reminders ──────────────────────────────────────────

export async function sendClassReminders(roomId: string) {
  // Get room + assigned students
  const roomResult = await db.query(
    `SELECT r.room_name, r.subject, r.scheduled_start, r.teacher_email,
            pu_t.full_name AS teacher_name
     FROM rooms r
     LEFT JOIN portal_users pu_t ON pu_t.email = r.teacher_email
     WHERE r.room_id = $1`,
    [roomId]
  );
  const room = roomResult.rows[0];
  if (!room) return { sent: 0, failed: 0 };

  const studentsResult = await db.query(
    `SELECT ra.participant_email, up.phone, up.whatsapp, pu.full_name
     FROM room_assignments ra
     LEFT JOIN user_profiles up ON up.email = ra.participant_email
     LEFT JOIN portal_users pu ON pu.email = ra.participant_email
     WHERE ra.room_id = $1 AND ra.participant_type = 'student'`,
    [roomId]
  );

  let sent = 0, failed = 0;
  const classTime = room.scheduled_start
    ? new Date(room.scheduled_start as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Scheduled';

  for (const student of studentsResult.rows as Array<Record<string, unknown>>) {
    const phone = (student.whatsapp || student.phone) as string | null;
    if (!phone) { failed++; continue; }

    const result = await sendWhatsApp({
      to: phone,
      template: 'class_reminder',
      templateData: {
        studentName: (student.full_name as string) || 'Student',
        subject: (room.subject as string) || 'Class',
        time: classTime,
        teacherName: (room.teacher_name as string) || 'Teacher',
      },
      recipientEmail: student.participant_email as string,
    });

    if (result.success) sent++; else failed++;
  }

  return { sent, failed, total: studentsResult.rows.length };
}

// ── Send Payment Reminders ──────────────────────────────────

export async function sendPaymentReminders() {
  const result = await db.query(
    `SELECT i.*, pu.full_name AS student_name,
            up.parent_email, up_p.phone AS parent_phone, up_p.whatsapp AS parent_whatsapp,
            pu_p.full_name AS parent_name
     FROM invoices i
     LEFT JOIN portal_users pu ON pu.email = i.student_email
     LEFT JOIN user_profiles up ON up.email = i.student_email
     LEFT JOIN user_profiles up_p ON up_p.email = up.parent_email
     LEFT JOIN portal_users pu_p ON pu_p.email = up.parent_email
     WHERE i.status = 'pending' AND i.due_date <= NOW() + INTERVAL '3 days'`
  );

  let sent = 0, failed = 0;
  for (const inv of result.rows as Array<Record<string, unknown>>) {
    const phone = (inv.parent_whatsapp || inv.parent_phone) as string | null;
    if (!phone) { failed++; continue; }

    const amount = `₹${((inv.amount_paise as number) / 100).toFixed(2)}`;
    const dueDate = inv.due_date
      ? new Date(inv.due_date as string).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      : 'Soon';

    const r = await sendWhatsApp({
      to: phone,
      template: 'payment_due',
      templateData: {
        parentName: (inv.parent_name as string) || 'Parent',
        studentName: (inv.student_name as string) || 'Student',
        amount,
        dueDate,
      },
      recipientEmail: inv.parent_email as string || inv.student_email as string,
    });

    if (r.success) sent++; else failed++;
  }

  return { sent, failed };
}

// ── Get Notification Logs ───────────────────────────────────

export async function getNotificationLogs(filters?: {
  channel?: string;
  recipient?: string;
  limit?: number;
}) {
  let sql = `SELECT * FROM notification_log WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.channel) {
    params.push(filters.channel);
    sql += ` AND channel = $${params.length}`;
  }
  if (filters?.recipient) {
    params.push(filters.recipient);
    sql += ` AND recipient = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC`;
  params.push(filters?.limit || 100);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return result.rows;
}
