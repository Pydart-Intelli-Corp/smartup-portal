// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Email Templates (Step 05)
// ═══════════════════════════════════════════════════════════════
// Plain HTML email templates — no external template engine.
// All templates share a master layout wrapper.
// ═══════════════════════════════════════════════════════════════

// ── Master Layout ───────────────────────────────────────────

function masterLayout(body: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SmartUp Classes</title>
</head>
<body style="margin:0; padding:0; background-color:#f0fdf4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(5,150,105,0.08); border:1px solid #d1fae5;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding:28px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align:middle; padding-right:12px;">
                      <div style="background-color:#ffffff; border-radius:10px; padding:5px; display:inline-block; line-height:0;">
                        <img src="https://smartuplearning.online/logo/full.png" alt="SmartUp" height="36" style="display:block; width:auto; border-radius:6px;" />
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.3px;">SmartUp</h1>
                      <p style="margin:2px 0 0; color:rgba(255,255,255,0.75); font-size:11px; letter-spacing:0.5px; text-transform:uppercase;">Online Classes</p>
                    </td>
                  </tr></table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="font-size:11px; color:rgba(255,255,255,0.6); letter-spacing:0.5px;">smartuplearning.online</span>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr><td style="height:3px; background: linear-gradient(90deg, #10b981, #06b6d4, #059669);"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f0fdf4; padding:20px 32px; border-top:1px solid #d1fae5;">
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <p style="margin:0 0 3px; font-size:13px; color:#059669; font-weight:600;">SmartUp Online Classes</p>
                  <p style="margin:0 0 3px; font-size:12px; color:#6b7280;">Need help? <a href="mailto:support@smartuplearning.online" style="color:#059669; text-decoration:none;">support@smartuplearning.online</a></p>
                  <p style="margin:0; font-size:11px; color:#9ca3af;">This email was sent to ${recipientEmail}</p>
                </td>
                <td align="right" style="vertical-align:bottom;">
                  <p style="margin:0; font-size:11px; color:#d1fae5;">© 2026 SmartUp</p>
                </td>
              </tr></table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared Helpers ──────────────────────────────────────────

function button(text: string, href: string, color: string = '#059669'): string {
  return `<a href="${href}" style="display:inline-block; padding:13px 28px; background-color:${color}; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; margin:8px 4px 8px 0; letter-spacing:0.2px; box-shadow:0 2px 8px rgba(5,150,105,0.25);">${text}</a>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 14px; font-size:13px; color:#6b7280; font-weight:500; border-bottom:1px solid #f0fdf4; background-color:#f9fafb; width:38%;">${label}</td>
    <td style="padding:9px 14px; font-size:13px; color:#111827; font-weight:600; border-bottom:1px solid #f0fdf4;">${value}</td>
  </tr>`;
}

function infoTable(rows: [string, string][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; border:1px solid #d1fae5; border-radius:8px; overflow:hidden;">
    ${rows.map(([l, v]) => infoRow(l, v)).join('\n')}
  </table>`;
}

function alertBox(text: string, color: string, bgColor: string): string {
  return `<div style="padding:12px 16px; background-color:${bgColor}; border-left:4px solid ${color}; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px; color:${color}; font-weight:500; line-height:1.5;">${text}</div>`;
}

// ── Type Definitions ────────────────────────────────────────

export interface TeacherInviteData {
  teacherName: string;
  roomName: string;
  subject: string;
  grade: string;
  date: string;        // formatted date string e.g. "28 Feb 2026"
  time: string;        // formatted time e.g. "10:00 AM"
  duration: string;    // e.g. "60 minutes"
  notes?: string;      // coordinator notes (optional)
  laptopLink: string;
  tabletLink: string;
  recipientEmail: string;
}

export interface StudentInviteData {
  studentName: string;
  roomName: string;
  subject: string;
  grade: string;
  date: string;
  time: string;
  duration: string;
  joinLink: string;
  paymentStatus: 'paid' | 'unpaid' | 'exempt';
  recipientEmail: string;
}

export interface PaymentConfirmationData {
  studentName: string;
  roomName: string;
  amount: string;
  transactionId: string;
  date: string;
  joinLink: string;
  recipientEmail: string;
}

export interface RoomReminderData {
  recipientName: string;
  recipientRole: 'teacher' | 'student';
  roomName: string;
  startTime: string;
  teacherName?: string;   // shown for students
  classSize?: number;     // shown for teachers
  laptopLink?: string;    // teacher only
  tabletLink?: string;    // teacher only
  joinLink?: string;      // student only
  recipientEmail: string;
}

export interface RoomCancelledData {
  roomName: string;
  date: string;
  time: string;
  reason?: string;
  recipientEmail: string;
}

export interface RoomRescheduledData {
  roomName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  joinLink: string;
  recipientEmail: string;
}

export interface CoordinatorSummaryData {
  coordinatorName: string;
  roomName: string;
  date: string;
  teacherName: string;
  teacherLaptopLink: string;
  teacherTabletLink: string;
  studentCount: number;
  unpaidCount: number;
  recipientEmail: string;
}

// ── Template 1: Teacher Invitation ──────────────────────────

export function teacherInviteTemplate(data: TeacherInviteData): { subject: string; html: string; text: string } {
  const subject = `Your class is scheduled — ${data.roomName} on ${data.date} at ${data.time}`;

  const notesBlock = data.notes
    ? `<div style="padding:12px 16px; background-color:#fff8e1; border-left:4px solid #ffc107; border-radius:4px; margin:16px 0; font-size:14px; color:#795548;">
        <strong>Notes from Coordinator:</strong><br/>${data.notes}
      </div>`
    : '';

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.teacherName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">Your class has been scheduled. Please review the details below.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Grade', data.grade],
      ['Date', data.date],
      ['Time', data.time],
      ['Duration', data.duration],
    ])}

    ${notesBlock}

    <div style="margin:24px 0;">
      ${button('Join on Laptop', data.laptopLink, '#28a745')}
      ${button('Join on Tablet', data.tabletLink, '#4a6cf7')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0 0 8px;">Click the <strong>Laptop</strong> link when using your desktop/laptop. Click the <strong>Tablet</strong> link when using your drawing tablet for whiteboard writing.</p>
    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your SmartUp credentials after clicking the link.</p>
  `;

  const text = `Dear ${data.teacherName},\n\nYour class "${data.roomName}" is scheduled for ${data.date} at ${data.time}.\nSubject: ${data.subject} | Grade: ${data.grade} | Duration: ${data.duration}\n${data.notes ? `Notes: ${data.notes}\n` : ''}\nLaptop: ${data.laptopLink}\nTablet: ${data.tabletLink}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 2: Student Invitation ──────────────────────────

export function studentInviteTemplate(data: StudentInviteData): { subject: string; html: string; text: string } {
  const subject = `You have been invited to: ${data.roomName} — ${data.date} at ${data.time}`;

  const paymentBlock = data.paymentStatus === 'unpaid'
    ? alertBox('Your fee payment is pending. You will be redirected to the payment page when you click Join.', '#e65100', '#fff3e0')
    : alertBox('Your fee is confirmed.', '#2e7d32', '#e8f5e9');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been invited to the following class.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Grade / Class', data.grade],
      ['Date', data.date],
      ['Time', data.time],
      ['Duration', data.duration],
    ])}

    ${paymentBlock}

    <div style="margin:24px 0;">
      ${button('Join Class', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your SmartUp credentials after clicking the link.</p>
  `;

  const text = `Dear ${data.studentName},\n\nYou have been invited to "${data.roomName}" on ${data.date} at ${data.time}.\nSubject: ${data.subject} | Grade: ${data.grade} | Duration: ${data.duration}\nPayment: ${data.paymentStatus}\n\nJoin: ${data.joinLink}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 3: Payment Confirmation ────────────────────────

export function paymentConfirmationTemplate(data: PaymentConfirmationData): { subject: string; html: string; text: string } {
  const subject = `Payment confirmed — ${data.roomName}`;

  const body = `
    <div style="text-align:center; padding:16px; background-color:#e8f5e9; border-radius:8px; margin:0 0 24px;">
      <span style="font-size:32px;">✓</span>
      <h2 style="margin:8px 0 0; color:#2e7d32; font-size:20px;">Payment Successful</h2>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 16px;">Dear ${data.studentName},</p>

    ${infoTable([
      ['Amount', data.amount],
      ['Transaction ID', data.transactionId],
      ['Date', data.date],
      ['Room', data.roomName],
    ])}

    <div style="margin:24px 0;">
      ${button('Join Your Class Now', data.joinLink, '#28a745')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Your access to this class has been activated.</p>
  `;

  const text = `Payment Successful\n\nDear ${data.studentName},\n\nAmount: ${data.amount}\nTransaction ID: ${data.transactionId}\nDate: ${data.date}\nRoom: ${data.roomName}\n\nJoin: ${data.joinLink}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 4: 30-Minute Reminder ──────────────────────────

export function roomReminderTemplate(data: RoomReminderData): { subject: string; html: string; text: string } {
  const subject = `Class starts in 30 minutes — ${data.roomName}`;

  const contextInfo = data.recipientRole === 'teacher'
    ? `<p style="font-size:14px; color:#495057;">Class size: <strong>${data.classSize} students</strong></p>`
    : `<p style="font-size:14px; color:#495057;">Teacher: <strong>${data.teacherName}</strong></p>`;

  const buttons = data.recipientRole === 'teacher'
    ? `${button('Join on Laptop', data.laptopLink!, '#28a745')} ${button('Join on Tablet', data.tabletLink!, '#4a6cf7')}`
    : button('Join Class', data.joinLink!);

  const body = `
    ${alertBox('Your class starts in 30 minutes.', '#1565c0', '#e3f2fd')}

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>

    ${infoTable([
      ['Room', data.roomName],
      ['Start Time', data.startTime],
    ])}

    ${contextInfo}

    <div style="margin:24px 0;">
      ${buttons}
    </div>
  `;

  const text = `Class starts in 30 minutes!\n\nDear ${data.recipientName},\n\nRoom: ${data.roomName}\nStart Time: ${data.startTime}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 5: Room Cancelled ──────────────────────────────

export function roomCancelledTemplate(data: RoomCancelledData): { subject: string; html: string; text: string } {
  const subject = `Class cancelled — ${data.roomName} on ${data.date}`;

  const reasonBlock = data.reason
    ? `<p style="font-size:14px; color:#495057; margin:16px 0;"><strong>Reason:</strong> ${data.reason}</p>`
    : '';

  const body = `
    ${alertBox('This class has been cancelled.', '#c62828', '#ffebee')}

    ${infoTable([
      ['Room', data.roomName],
      ['Original Date', data.date],
      ['Original Time', data.time],
    ])}

    ${reasonBlock}

    <p style="font-size:14px; color:#495057; margin:16px 0 0;">Please contact your coordinator for details.</p>
  `;

  const text = `Class Cancelled\n\nRoom: ${data.roomName}\nDate: ${data.date}\nTime: ${data.time}\n${data.reason ? `Reason: ${data.reason}\n` : ''}\nPlease contact your coordinator for details.\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 6: Room Rescheduled ────────────────────────────

export function roomRescheduledTemplate(data: RoomRescheduledData): { subject: string; html: string; text: string } {
  const subject = `Class rescheduled — ${data.roomName} new time: ${data.newDate} at ${data.newTime}`;

  const body = `
    ${alertBox('This class has been rescheduled.', '#e65100', '#fff3e0')}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="padding:12px; background-color:#ffebee; border-radius:6px; text-align:center; width:48%;">
          <p style="margin:0 0 4px; font-size:12px; color:#c62828; text-transform:uppercase; font-weight:600;">Original</p>
          <p style="margin:0; font-size:15px; color:#1a1a2e; font-weight:600;">${data.oldDate}<br/>${data.oldTime}</p>
        </td>
        <td style="text-align:center; font-size:20px; color:#6c757d; width:4%;">→</td>
        <td style="padding:12px; background-color:#e8f5e9; border-radius:6px; text-align:center; width:48%;">
          <p style="margin:0 0 4px; font-size:12px; color:#2e7d32; text-transform:uppercase; font-weight:600;">New</p>
          <p style="margin:0; font-size:15px; color:#1a1a2e; font-weight:600;">${data.newDate}<br/>${data.newTime}</p>
        </td>
      </tr>
    </table>

    <div style="margin:24px 0;">
      ${button('Join with New Link', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Your previous join link is no longer valid. Please use the new link above.</p>
  `;

  const text = `Class Rescheduled\n\nRoom: ${data.roomName}\nOriginal: ${data.oldDate} at ${data.oldTime}\nNew: ${data.newDate} at ${data.newTime}\n\nJoin: ${data.joinLink}\n\nYour previous join link is no longer valid.\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 7: Coordinator Summary ─────────────────────────

export function coordinatorSummaryTemplate(data: CoordinatorSummaryData): { subject: string; html: string; text: string } {
  const subject = `Notifications sent — ${data.roomName} (${data.studentCount} students)`;

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.coordinatorName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">All participants have been notified for the following class.</p>

    ${infoTable([
      ['Room', data.roomName],
      ['Date', data.date],
      ['Teacher', data.teacherName],
      ['Students Emailed', String(data.studentCount)],
      ['Unpaid Students', String(data.unpaidCount)],
    ])}

    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Teacher Links (for your reference)</h3>
    <p style="font-size:13px; color:#495057; margin:0 0 4px;">
      Laptop: <a href="${data.teacherLaptopLink}" style="color:#4a6cf7;">${data.teacherLaptopLink}</a>
    </p>
    <p style="font-size:13px; color:#495057; margin:0 0 16px;">
      Tablet: <a href="${data.teacherTabletLink}" style="color:#4a6cf7;">${data.teacherTabletLink}</a>
    </p>

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">This email is for your records. All participants have been notified.</p>
  `;

  const text = `Notifications Sent\n\nDear ${data.coordinatorName},\n\nRoom: ${data.roomName}\nDate: ${data.date}\nTeacher: ${data.teacherName}\nStudents Emailed: ${data.studentCount}\nUnpaid: ${data.unpaidCount}\n\nTeacher Laptop Link: ${data.teacherLaptopLink}\nTeacher Tablet Link: ${data.teacherTabletLink}\n\nAll participants have been notified.\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Welcome / Credentials Template ─────────────────────────
export interface CredentialsTemplateData {
  recipientEmail: string;
  recipientName: string;
  role: string;         // Human-readable role label
  loginEmail: string;
  tempPassword: string;
  loginUrl: string;
  additionalInfo?: string;  // e.g. subjects, grade, etc.
}

export function credentialsTemplate(data: CredentialsTemplateData): { subject: string; html: string; text: string } {
  const roleColors: Record<string, string> = {
    'Teacher': '#059669', 'Student': '#7c3aed', 'Admin': '#2563eb',
    'Parent': '#e11d48', 'HR Associate': '#0d9488',
  };
  const accent = roleColors[data.role] || '#4a6cf7';

  const subject = `Welcome to SmartUp \u2014 Your ${data.role} Account`;

  const body = `
    <h2 style="font-size:22px; color:#1a1a2e; margin:0 0 8px;">Welcome to SmartUp! \uD83C\uDF93</h2>
    <p style="font-size:15px; color:#495057; margin:0 0 20px;">
      Dear <strong>${data.recipientName}</strong>, your <strong>${data.role}</strong> account has been created.
      Here are your login credentials:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:0 0 24px;">
      <tr style="background-color:#f8f9fa;">
        <td colspan="2" style="padding:12px 16px; font-size:13px; font-weight:700; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px; background-color:${accent}20; border-bottom:1px solid #e9ecef;">
          Login Credentials
        </td>
      </tr>
      ${infoRow('Login URL', '<a href="' + data.loginUrl + '" style="color:' + accent + ';">' + data.loginUrl + '</a>')}
      ${infoRow('Email', data.loginEmail)}
      ${infoRow('Password', '<code style="background:#f1f3f5; padding:2px 6px; border-radius:4px; font-family:monospace; color:#e63946;">' + data.tempPassword + '</code>')}
      ${infoRow('Role', '<span style="background:' + accent + '20; color:' + accent + '; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:700;">' + data.role + '</span>')}
      ${data.additionalInfo ? infoRow('Details', data.additionalInfo) : ''}
    </table>

    <div style="background:#fff3cd; border:1px solid #ffc107; border-radius:6px; padding:14px 16px; margin:0 0 20px;">
      <p style="margin:0; font-size:13px; color:#856404;">
        \u26A0\uFE0F <strong>Important:</strong> Please log in and change your password immediately.
        Do not share your credentials with anyone.
      </p>
    </div>

    ${button('Login to SmartUp', data.loginUrl, accent)}

    <p style="font-size:13px; color:#6c757d; margin:20px 0 0;">
      If you have any issues logging in, please contact your HR Associate or reply to this email.
    </p>
  `;

  const text = `Welcome to SmartUp!\n\nDear ${data.recipientName},\n\nYour ${data.role} account has been created.\n\nLogin URL: ${data.loginUrl}\nEmail: ${data.loginEmail}\nPassword: ${data.tempPassword}\n\nPlease change your password after first login.\n\n\u2014 SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 9: Room Started (Class is Live) ────────────────

export interface RoomStartedData {
  studentName: string;
  roomName: string;
  teacherName: string;
  joinLink: string;
  recipientEmail: string;
}

export function roomStartedTemplate(data: RoomStartedData): { subject: string; html: string; text: string } {
  const subject = `🔴 Class is LIVE now — ${data.roomName}`;

  const body = `
    ${alertBox('Your class has started! Join now.', '#c62828', '#ffebee')}

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">
      <strong>${data.teacherName}</strong> has started the class <strong>"${data.roomName}"</strong>.
      Click below to join immediately.
    </p>

    <div style="text-align:center; margin:24px 0;">
      ${button('🎓 Join Class Now', data.joinLink, '#c62828')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your SmartUp credentials after clicking the link.</p>
  `;

  const text = `Your class "${data.roomName}" is LIVE now!\n\nDear ${data.studentName},\n\n${data.teacherName} has started the class.\n\nJoin now: ${data.joinLink}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// BATCH CREATION NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════════

// ── Shared Batch Info Table ─────────────────────────────────

interface BatchInfoBase {
  batchName: string;
  batchType: string;     // e.g. "One-to-One", "One-to-Three"
  subjects: string[];
  grade: string;
  section?: string;
  board?: string;
}

function batchInfoRows(b: BatchInfoBase): [string, string][] {
  const rows: [string, string][] = [
    ['Batch Name', b.batchName],
    ['Batch Type', b.batchType],
    ['Subject(s)', b.subjects.length > 0 ? b.subjects.join(', ') : '—'],
    ['Grade', b.grade || '—'],
  ];
  if (b.section) rows.push(['Section', b.section]);
  if (b.board) rows.push(['Board', b.board]);
  return rows;
}

// ── Template 10: Batch Created — Coordinator ────────────────

export interface BatchCoordinatorNotifyData extends BatchInfoBase {
  coordinatorName: string;
  studentCount: number;
  teacherCount: number;
  teachers: { name: string; email: string; subject: string }[];
  students: { name: string; email: string }[];
  loginUrl: string;
  recipientEmail: string;
}

export function batchCoordinatorNotifyTemplate(data: BatchCoordinatorNotifyData): { subject: string; html: string; text: string } {
  const subject = `New batch assigned to you — ${data.batchName}`;

  const teacherRows = data.teachers.map(t =>
    `<tr><td style="padding:6px 12px; font-size:13px; color:#1a1a2e; border-bottom:1px solid #f1f3f5;">${t.name}</td><td style="padding:6px 12px; font-size:13px; color:#495057; border-bottom:1px solid #f1f3f5;">${t.subject}</td><td style="padding:6px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #f1f3f5;">${t.email}</td></tr>`
  ).join('');

  const studentRows = data.students.map(s =>
    `<tr><td style="padding:6px 12px; font-size:13px; color:#1a1a2e; border-bottom:1px solid #f1f3f5;">${s.name}</td><td style="padding:6px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #f1f3f5;">${s.email}</td></tr>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.coordinatorName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">A new batch has been created and assigned to you as the <strong>Batch Coordinator</strong>. Here are the details:</p>

    ${infoTable(batchInfoRows(data))}

    <div style="display:flex; gap:16px; margin:16px 0;">
      <div style="flex:1; text-align:center; padding:12px; background:#e8f5e9; border-radius:8px;">
        <p style="margin:0; font-size:24px; font-weight:700; color:#2e7d32;">${data.teacherCount}</p>
        <p style="margin:4px 0 0; font-size:12px; color:#6c757d;">Teacher(s)</p>
      </div>
      <div style="flex:1; text-align:center; padding:12px; background:#e3f2fd; border-radius:8px;">
        <p style="margin:0; font-size:24px; font-weight:700; color:#1565c0;">${data.studentCount}</p>
        <p style="margin:4px 0 0; font-size:12px; color:#6c757d;">Student(s)</p>
      </div>
    </div>

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Assigned Teachers</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:6px; overflow:hidden;">
      <tr style="background:#f8f9fa;"><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Name</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Subject</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Email</th></tr>
      ${teacherRows}
    </table>` : ''}

    ${data.students.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Enrolled Students</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:6px; overflow:hidden;">
      <tr style="background:#f8f9fa;"><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Name</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Email</th></tr>
      ${studentRows}
    </table>` : ''}

    <div style="margin:24px 0;">
      ${button('Open SmartUp Portal', data.loginUrl, '#059669')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You are responsible for scheduling sessions and managing this batch. Log in to get started.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject} (${t.email})`).join('\n');
  const studentsTxt = data.students.map(s => `  • ${s.name} (${s.email})`).join('\n');
  const text = `New Batch Assigned to You\n\nDear ${data.coordinatorName},\n\nBatch: ${data.batchName}\nType: ${data.batchType}\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers (${data.teacherCount}):\n${teachersTxt}\n\nStudents (${data.studentCount}):\n${studentsTxt}\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 11: Batch Created — Teacher ────────────────────

export interface BatchTeacherNotifyData extends BatchInfoBase {
  teacherName: string;
  assignedSubject: string;
  coordinatorName: string;
  coordinatorEmail: string;
  studentCount: number;
  loginUrl: string;
  recipientEmail: string;
}

export function batchTeacherNotifyTemplate(data: BatchTeacherNotifyData): { subject: string; html: string; text: string } {
  const subject = `You've been assigned to batch — ${data.batchName}`;

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.teacherName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been assigned as a <strong>Teacher</strong> in a new batch. Here are the details:</p>

    ${infoTable([
      ...batchInfoRows(data),
      ['Your Subject', `<strong style="color:#059669;">${data.assignedSubject}</strong>`],
      ['Students', String(data.studentCount)],
      ['Coordinator', `${data.coordinatorName} (${data.coordinatorEmail})`],
    ])}

    ${alertBox('Sessions will be scheduled by your batch coordinator. You will receive a separate notification before each class.', '#1565c0', '#e3f2fd')}

    <div style="margin:24px 0;">
      ${button('Open SmartUp Portal', data.loginUrl, '#059669')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">If you have any questions, please contact your coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const text = `You've Been Assigned to a Batch\n\nDear ${data.teacherName},\n\nBatch: ${data.batchName}\nYour Subject: ${data.assignedSubject}\nType: ${data.batchType}\nGrade: ${data.grade}\nStudents: ${data.studentCount}\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 12: Batch Created — Student ────────────────────

export interface BatchStudentNotifyData extends BatchInfoBase {
  studentName: string;
  teachers: { name: string; subject: string }[];
  coordinatorName: string;
  coordinatorEmail: string;
  loginUrl: string;
  recipientEmail: string;
}

export function batchStudentNotifyTemplate(data: BatchStudentNotifyData): { subject: string; html: string; text: string } {
  const subject = `You've been enrolled in — ${data.batchName}`;

  const teacherList = data.teachers.map(t =>
    `<li style="padding:4px 0; font-size:14px; color:#1a1a2e;"><strong>${t.name}</strong> — ${t.subject}</li>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been enrolled in a new batch. Here are the details:</p>

    ${infoTable(batchInfoRows(data))}

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:20px 0 8px;">Your Teachers</h3>
    <ul style="margin:0; padding:0 0 0 20px;">${teacherList}</ul>` : ''}

    <div style="margin:8px 0; padding:12px 16px; background-color:#e8f5e9; border-left:4px solid #2e7d32; border-radius:4px; font-size:14px; color:#2e7d32;">
      Your coordinator <strong>${data.coordinatorName}</strong> will schedule your classes. You will receive a notification before each session.
    </div>

    <div style="margin:24px 0;">
      ${button('Open SmartUp Portal', data.loginUrl, '#7c3aed')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Questions? Contact your coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject}`).join('\n');
  const text = `You've Been Enrolled in a Batch\n\nDear ${data.studentName},\n\nBatch: ${data.batchName}\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers:\n${teachersTxt}\n\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 13: Batch Created — Parent ─────────────────────

export interface BatchParentNotifyData extends BatchInfoBase {
  parentName: string;
  childName: string;
  childEmail: string;
  teachers: { name: string; subject: string }[];
  coordinatorName: string;
  coordinatorEmail: string;
  loginUrl: string;
  recipientEmail: string;
}

export function batchParentNotifyTemplate(data: BatchParentNotifyData): { subject: string; html: string; text: string } {
  const subject = `Your child ${data.childName} has been enrolled in — ${data.batchName}`;

  const teacherList = data.teachers.map(t =>
    `<li style="padding:4px 0; font-size:14px; color:#1a1a2e;"><strong>${t.name}</strong> — ${t.subject}</li>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.parentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">
      Your child <strong>${data.childName}</strong> (<span style="color:#6c757d;">${data.childEmail}</span>) has been enrolled in a new batch.
    </p>

    ${infoTable(batchInfoRows(data))}

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:20px 0 8px;">Assigned Teachers</h3>
    <ul style="margin:0; padding:0 0 0 20px;">${teacherList}</ul>` : ''}

    <div style="margin:8px 0; padding:12px 16px; background-color:#fff3e0; border-left:4px solid #e65100; border-radius:4px; font-size:14px; color:#795548;">
      Class sessions will be scheduled soon. Both you and your child will receive notifications before each session.
    </div>

    <div style="margin:24px 0;">
      ${button('Open Parent Portal', data.loginUrl, '#e11d48')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Questions? Contact the coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject}`).join('\n');
  const text = `Your Child Has Been Enrolled\n\nDear ${data.parentName},\n\nYour child ${data.childName} (${data.childEmail}) has been enrolled in batch "${data.batchName}".\n\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers:\n${teachersTxt}\n\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// DAILY TIMETABLE & SESSION REMINDER TEMPLATES
// ═══════════════════════════════════════════════════════════════

// ── Template 14: Daily Timetable (Morning) ──────────────────

export interface SessionInfo {
  subject: string;
  teacherName: string;
  startTime: string;     // e.g. "10:00 AM"
  duration: string;      // e.g. "60 minutes"
  batchName: string;
  topic?: string;
}

export interface DailyTimetableData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  date: string;          // e.g. "Thursday, 26 Feb 2026"
  sessions: SessionInfo[];
  childName?: string;    // for parents
  loginUrl: string;
  recipientEmail: string;
}

export function dailyTimetableTemplate(data: DailyTimetableData): { subject: string; html: string; text: string } {
  const roleLabel = data.recipientRole === 'parent'
    ? `${data.childName}'s`
    : 'Your';
  const count = data.sessions.length;
  const subject = `📅 Today's Timetable — ${count} class${count > 1 ? 'es' : ''} on ${data.date}`;

  const roleColors: Record<string, string> = {
    teacher: '#059669',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#0d9488',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  const sessionRows = data.sessions.map((s, i) => `
    <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
      <td style="padding:10px 12px; font-size:14px; color:#1a1a2e; font-weight:600; border-bottom:1px solid #e9ecef;">${s.startTime}</td>
      <td style="padding:10px 12px; font-size:14px; border-bottom:1px solid #e9ecef;">
        <span style="color:#1a1a2e; font-weight:600;">${s.subject}</span>
        ${s.topic ? `<br/><span style="font-size:12px; color:#6c757d;">Topic: ${s.topic}</span>` : ''}
      </td>
      <td style="padding:10px 12px; font-size:13px; color:#495057; border-bottom:1px solid #e9ecef;">${s.teacherName}</td>
      <td style="padding:10px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #e9ecef;">${s.duration}</td>
      <td style="padding:10px 12px; font-size:12px; color:#6c757d; border-bottom:1px solid #e9ecef;">${s.batchName}</td>
    </tr>
  `).join('');

  const greetingNote = data.recipientRole === 'parent'
    ? `Here is <strong>${data.childName}</strong>'s class schedule for today.`
    : data.recipientRole === 'teacher'
    ? `Here are the classes you are teaching today.`
    : data.recipientRole === 'batch_coordinator'
    ? `Here are all classes under your batches today.`
    : `Here is your class schedule for today.`;

  const body = `
    <div style="text-align:center; padding:16px; background: linear-gradient(135deg, ${accent}15, ${accent}05); border-radius:8px; margin:0 0 24px;">
      <p style="margin:0 0 4px; font-size:13px; color:${accent}; text-transform:uppercase; font-weight:700; letter-spacing:1px;">Today's Schedule</p>
      <h2 style="margin:0; font-size:22px; color:#1a1a2e;">${data.date}</h2>
      <p style="margin:8px 0 0; font-size:32px; font-weight:700; color:${accent};">${count}</p>
      <p style="margin:0; font-size:13px; color:#6c757d;">class${count > 1 ? 'es' : ''} scheduled</p>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Good morning, ${data.recipientName}!</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${greetingNote} You will receive a reminder with your join link 30 minutes before each class.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:16px 0;">
      <tr style="background-color:${accent}; color:#ffffff;">
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Time</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Subject</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Teacher</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Duration</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Batch</th>
      </tr>
      ${sessionRows}
    </table>

    ${alertBox('Join links will be sent 30 minutes before each class starts.', '#1565c0', '#e3f2fd')}

    <div style="margin:24px 0;">
      ${button('Open SmartUp Portal', data.loginUrl, accent)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Have a great day of learning! 🎓</p>
  `;

  const sessionsTxt = data.sessions.map(s => `  • ${s.startTime} — ${s.subject} (${s.teacherName}) [${s.duration}] — ${s.batchName}${s.topic ? ` | Topic: ${s.topic}` : ''}`).join('\n');
  const text = `${roleLabel} Timetable for ${data.date}\n\nDear ${data.recipientName},\n\n${greetingNote}\n\n${sessionsTxt}\n\nJoin links will be sent 30 minutes before each class.\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 15: 30-Minute Session Reminder with Join Link ──

export interface SessionReminderData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  subject: string;
  teacherName: string;
  batchName: string;
  startTime: string;     // e.g. "10:00 AM"
  duration: string;      // e.g. "60 minutes"
  topic?: string;
  childName?: string;    // for parents
  joinUrl: string;
  recipientEmail: string;
}

export function sessionReminderTemplate(data: SessionReminderData): { subject: string; html: string; text: string } {
  const subject = `⏰ Class in 30 min — ${data.subject} at ${data.startTime}`;

  const roleColors: Record<string, string> = {
    teacher: '#059669',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#0d9488',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  const roleNote = data.recipientRole === 'parent'
    ? `<strong>${data.childName}</strong>'s class is starting in 30 minutes.`
    : data.recipientRole === 'teacher'
    ? `Your class is starting in <strong>30 minutes</strong>. Please prepare your materials.`
    : `Your class is starting in <strong>30 minutes</strong>.`;

  const body = `
    <div style="text-align:center; padding:20px; background: linear-gradient(135deg, #c6282815, #c6282805); border-radius:8px; margin:0 0 24px; border:2px solid #c6282830;">
      <p style="margin:0; font-size:36px;">⏰</p>
      <h2 style="margin:8px 0; font-size:20px; color:#c62828;">Class Starts in 30 Minutes</h2>
      <p style="margin:0; font-size:15px; color:#495057;">${data.startTime}</p>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${roleNote}</p>

    ${infoTable([
      ['Subject', `<strong style="color:${accent};">${data.subject}</strong>`],
      ['Teacher', data.teacherName],
      ['Batch', data.batchName],
      ['Start Time', data.startTime],
      ['Duration', data.duration],
      ...(data.topic ? [['Topic', data.topic] as [string, string]] : []),
    ])}

    <div style="text-align:center; margin:28px 0; padding:20px; background:#f8f9fa; border-radius:8px; border:1px dashed #dee2e6;">
      <p style="margin:0 0 12px; font-size:14px; color:#495057; font-weight:600;">Click below to join the class:</p>
      ${button('🎓 Join Class Now', data.joinUrl, '#c62828')}
    </div>

    ${data.recipientRole === 'teacher'
      ? alertBox('Students will join using their own links. You may start teaching once the class timer begins.', '#e65100', '#fff3e0')
      : alertBox('Please join on time. The class will be recorded for future reference.', '#1565c0', '#e3f2fd')
    }

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">If you have trouble joining, copy this link: <a href="${data.joinUrl}" style="color:#4a6cf7; word-break:break-all;">${data.joinUrl}</a></p>
  `;

  const text = `Class in 30 Minutes!\n\nDear ${data.recipientName},\n\n${data.recipientRole === 'parent' ? `${data.childName}'s` : 'Your'} class is starting soon.\n\nSubject: ${data.subject}\nTeacher: ${data.teacherName}\nBatch: ${data.batchName}\nTime: ${data.startTime}\nDuration: ${data.duration}${data.topic ? `\nTopic: ${data.topic}` : ''}\n\nJoin: ${data.joinUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 16: Weekly Timetable (Mon–Sat school schedule) ──

export interface WeeklyTimetableSlot {
  day: string;           // e.g. "Monday"
  subject: string;
  teacherName: string;
  startTime: string;     // e.g. "10:00 AM"
  endTime: string;       // e.g. "11:30 AM"
  duration: string;      // e.g. "90 min"
}

export interface WeeklyTimetableData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  batchName: string;
  batchGrade: string;
  slots: WeeklyTimetableSlot[];
  childName?: string;
  loginUrl: string;
  recipientEmail: string;
  isUpdate?: boolean;
}

export function weeklyTimetableTemplate(data: WeeklyTimetableData): { subject: string; html: string; text: string } {
  const roleLabel = data.recipientRole === 'parent'
    ? `${data.childName}'s`
    : 'Your';

  const prefix = data.isUpdate ? '🔄 Updated' : '📅';
  const subject = `${prefix} Weekly Timetable — ${data.batchName} (Grade ${data.batchGrade})`;

  const roleColors: Record<string, string> = {
    teacher: '#059669',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#0d9488',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  // Group slots by day (Mon–Sat only)
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = new Map<string, WeeklyTimetableSlot[]>();
  for (const s of data.slots) {
    if (!dayOrder.includes(s.day)) continue;
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day)!.push(s);
  }

  // Use brand green for all day labels (consistent with SmartUp theme)
  const dayColor = '#16A34A';

  const dayAbbr: Record<string, string> = {
    Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
    Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
  };

  let timetableHTML = '';
  for (const day of dayOrder) {
    const daySlots = byDay.get(day);

    if (!daySlots || daySlots.length === 0) {
      // Show empty day row
      timetableHTML += `
        <tr style="background-color:#f8f9fa;">
          <td style="padding:10px 14px; font-size:13px; font-weight:700; color:${dayColor}; border-bottom:1px solid #e9ecef; vertical-align:middle; width:80px;">${dayAbbr[day]}</td>
          <td colspan="3" style="padding:10px 14px; font-size:13px; color:#adb5bd; font-style:italic; border-bottom:1px solid #e9ecef;">No class</td>
        </tr>
      `;
      continue;
    }

    daySlots.forEach((s, i) => {
      timetableHTML += `
        <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
          ${i === 0
            ? `<td rowspan="${daySlots.length}" style="padding:10px 14px; font-size:13px; font-weight:700; color:${dayColor}; border-bottom:1px solid #e9ecef; vertical-align:middle; width:80px; border-right:2px solid ${dayColor}30;">${dayAbbr[day]}</td>`
            : ''}
          <td style="padding:10px 14px; font-size:14px; color:#1a1a2e; font-weight:600; border-bottom:1px solid #e9ecef; white-space:nowrap;">${s.startTime} – ${s.endTime}</td>
          <td style="padding:10px 14px; font-size:14px; border-bottom:1px solid #e9ecef;">
            <span style="color:#1a1a2e; font-weight:600;">${s.subject}</span>
          </td>
          <td style="padding:10px 14px; font-size:13px; color:#495057; border-bottom:1px solid #e9ecef;">${s.teacherName}</td>
        </tr>
      `;
    });
  }

  const totalSlots = data.slots.filter(s => dayOrder.includes(s.day)).length;
  const activeDays = dayOrder.filter(d => byDay.has(d)).length;
  const uniqueSubjects = [...new Set(data.slots.map(s => s.subject))];

  const greetingNote = data.recipientRole === 'parent'
    ? `Here is <strong>${data.childName}</strong>'s weekly class timetable for <strong>${data.batchName}</strong>.`
    : data.recipientRole === 'teacher'
    ? `Here is the weekly class schedule for <strong>${data.batchName}</strong>.`
    : data.recipientRole === 'batch_coordinator'
    ? `Here is the weekly timetable for <strong>${data.batchName}</strong>.`
    : `Here is your weekly class timetable for <strong>${data.batchName}</strong>.`;

  const updateNote = data.isUpdate
    ? alertBox('⚠ This timetable has been updated. Please review the changes below.', '#e65100', '#fff3e0')
    : '';

  const body = `
    <div style="text-align:center; padding:16px; background: linear-gradient(135deg, ${accent}15, ${accent}05); border-radius:8px; margin:0 0 24px;">
      <p style="margin:0 0 4px; font-size:13px; color:${accent}; text-transform:uppercase; font-weight:700; letter-spacing:1px;">
        ${data.isUpdate ? '🔄 Updated Weekly Timetable' : '📅 Weekly Timetable'}
      </p>
      <h2 style="margin:0; font-size:20px; color:#1a1a2e;">${data.batchName}</h2>
      <p style="margin:4px 0 0; font-size:13px; color:#6c757d;">Grade ${data.batchGrade}</p>
      <div style="margin:12px 0 0; display:flex; justify-content:center; gap:24px;">
        <div>
          <span style="font-size:24px; font-weight:700; color:${accent};">${totalSlots}</span>
          <br/><span style="font-size:11px; color:#6c757d;">Classes/Week</span>
        </div>
        <div>
          <span style="font-size:24px; font-weight:700; color:${accent};">${activeDays}</span>
          <br/><span style="font-size:11px; color:#6c757d;">Days</span>
        </div>
        <div>
          <span style="font-size:24px; font-weight:700; color:${accent};">${uniqueSubjects.length}</span>
          <br/><span style="font-size:11px; color:#6c757d;">Subjects</span>
        </div>
      </div>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${greetingNote}</p>

    ${updateNote}

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:16px 0;">
      <tr style="background-color:${accent}; color:#ffffff;">
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Day</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Time</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Subject</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Teacher</th>
      </tr>
      ${timetableHTML}
    </table>

    ${alertBox('You will receive a join link 30 minutes before each class starts.', '#0D9488', '#f0fdfa')}

    <div style="margin:24px 0;">
      ${button('Open SmartUp Portal', data.loginUrl, accent)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Happy learning! 🎓</p>
  `;

  // Plain text version
  const sessionsTxt = dayOrder
    .map(d => {
      const slots = byDay.get(d);
      if (!slots) return `  ${d}: No class`;
      const lines = slots.map(s => `    ${s.startTime}–${s.endTime}  ${s.subject} (${s.teacherName})`);
      return `  ${d}:\n${lines.join('\n')}`;
    }).join('\n');

  const text = `${data.isUpdate ? 'UPDATED ' : ''}${roleLabel} Weekly Timetable — ${data.batchName} (Grade ${data.batchGrade})\n\nDear ${data.recipientName},\n\n${totalSlots} class${totalSlots > 1 ? 'es' : ''}/week across ${activeDays} day${activeDays > 1 ? 's' : ''}.\n\n${sessionsTxt}\n\nJoin links will be sent 30 minutes before each class.\n\nLogin: ${data.loginUrl}\n\n— SmartUp Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// SESSION REQUEST TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface SessionRequestSubmittedData {
  aoName: string;
  requesterName: string;
  requesterRole: string;
  requestType: string;
  batchName: string;
  reason: string;
  proposedDate?: string;
  proposedTime?: string;
}

export function sessionRequestSubmittedTemplate(data: SessionRequestSubmittedData) {
  const isCancel = data.requestType === 'cancel';
  const subject = `📋 ${isCancel ? 'Cancellation' : 'Reschedule'} Request — ${data.batchName}`;
  const accent = isCancel ? '#dc2626' : '#2563eb';

  const rows: [string, string][] = [
    ['Request Type', isCancel ? '❌ Cancel Session' : '🔄 Reschedule Session'],
    ['Requested By', `${data.requesterName} (${data.requesterRole})`],
    ['Batch', data.batchName],
    ['Reason', data.reason],
  ];
  if (data.proposedDate) rows.push(['Proposed Date', data.proposedDate]);
  if (data.proposedTime) rows.push(['Proposed Time', data.proposedTime]);

  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">New Session Request</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.aoName}, a ${data.requesterRole} has submitted a request that needs your review.</p>
    ${alertBox(isCancel ? 'A student/parent is requesting to cancel a session.' : 'A student/parent is requesting a schedule change.', accent, isCancel ? '#fef2f2' : '#eff6ff')}
    ${infoTable(rows)}
    <p style="font-size:14px; color:#1a1a2e; margin:16px 0 0;">Please review this request in your dashboard.</p>
  `;
  const text = `New ${data.requestType} request for ${data.batchName} by ${data.requesterName}. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRequestApprovedData {
  requesterName: string;
  requestType: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  proposedDate?: string;
  proposedTime?: string;
}

export function sessionRequestApprovedTemplate(data: SessionRequestApprovedData) {
  const isCancel = data.requestType === 'cancel';
  const subject = `✅ Request Approved — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Request Approved</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.requesterName},</p>
    ${alertBox(isCancel
      ? `Your cancellation request for ${data.batchName} — ${data.subject} on ${data.sessionDate} has been approved.`
      : `Your reschedule request has been approved. The session has been moved to ${data.proposedDate || 'the new date'}${data.proposedTime ? ' at ' + data.proposedTime : ''}.`,
      '#059669', '#f0fdf4')}
    ${infoTable([
      ['Batch', data.batchName],
      ['Subject', data.subject],
      ['Original Date', data.sessionDate],
      ...(data.proposedDate ? [['New Date', data.proposedDate] as [string, string]] : []),
      ['Status', '✅ Approved'],
    ])}
  `;
  const text = `Your ${data.requestType} request for ${data.batchName} has been approved.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRequestRejectedData {
  requesterName: string;
  requestType: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  reason: string;
}

export function sessionRequestRejectedTemplate(data: SessionRequestRejectedData) {
  const subject = `❌ Request Rejected — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Request Rejected</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.requesterName},</p>
    ${alertBox(`Your ${data.requestType} request for ${data.batchName} — ${data.subject} on ${data.sessionDate} has been rejected.`, '#dc2626', '#fef2f2')}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject], ['Session Date', data.sessionDate],
      ['Reason', data.reason], ['Status', '❌ Rejected'],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">Contact your academic coordinator for questions.</p>
  `;
  const text = `Your ${data.requestType} request for ${data.batchName} was rejected. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRescheduledNotifyData {
  recipientName: string;
  batchName: string;
  subject: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  reason: string;
  requestedBy: string;
}

export function sessionRescheduledNotifyTemplate(data: SessionRescheduledNotifyData) {
  const subject = `🔄 Session Rescheduled — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Session Rescheduled</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.recipientName},</p>
    ${alertBox(`A session has been rescheduled at the request of ${data.requestedBy}.`, '#2563eb', '#eff6ff')}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject],
      ['Previous', `${data.oldDate} at ${data.oldTime}`],
      ['New Schedule', `${data.newDate} at ${data.newTime}`],
      ['Reason', data.reason],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">Please update your schedule accordingly.</p>
  `;
  const text = `Session rescheduled: ${data.batchName} ${data.subject} moved from ${data.oldDate} to ${data.newDate}.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionCancelledNotifyData {
  recipientName: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  startTime: string;
  reason: string;
  cancelledBy: string;
}

export function sessionCancelledNotifyTemplate(data: SessionCancelledNotifyData) {
  const subject = `❌ Session Cancelled — ${data.batchName} ${data.subject} (${data.sessionDate})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Session Cancelled</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.recipientName},</p>
    ${alertBox('The following session has been cancelled.', '#dc2626', '#fef2f2')}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject], ['Date', data.sessionDate],
      ['Time', data.startTime], ['Cancelled By', data.cancelledBy], ['Reason', data.reason],
    ])}
  `;
  const text = `Session cancelled: ${data.batchName} ${data.subject} on ${data.sessionDate}. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

// ═══════════════════════════════════════════════════════════════
// TEACHER LEAVE REQUEST TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface LeaveRequestSubmittedData {
  reviewerName: string;
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  affectedSessions: number;
}

export function leaveRequestSubmittedTemplate(data: LeaveRequestSubmittedData) {
  const subject = `📋 Leave Request — ${data.teacherName} (${data.leaveType})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Teacher Leave Request</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.reviewerName}, a teacher has submitted a leave request.</p>
    ${alertBox(`${data.affectedSessions} session${data.affectedSessions !== 1 ? 's' : ''} will be affected if approved.`, '#f59e0b', '#fffbeb')}
    ${infoTable([
      ['Teacher', data.teacherName],
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate], ['Reason', data.reason],
      ['Affected Sessions', String(data.affectedSessions)],
    ])}
    <p style="font-size:14px; color:#1a1a2e; margin:16px 0 0;">Please review in your dashboard.</p>
  `;
  const text = `Leave request from ${data.teacherName} (${data.leaveType}): ${data.startDate} to ${data.endDate}. ${data.affectedSessions} sessions affected.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveRequestApprovedData {
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  affectedSessions: number;
}

export function leaveRequestApprovedTemplate(data: LeaveRequestApprovedData) {
  const subject = `✅ Leave Approved — ${data.startDate} to ${data.endDate}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request Approved</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.teacherName},</p>
    ${alertBox('Your leave request has been approved.', '#059669', '#f0fdf4')}
    ${infoTable([
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['Sessions Cancelled', String(data.affectedSessions)], ['Status', '✅ Approved'],
    ])}
    ${data.affectedSessions > 0 ? alertBox(`${data.affectedSessions} sessions auto-cancelled. Stakeholders notified.`, '#f59e0b', '#fffbeb') : ''}
  `;
  const text = `Leave approved: ${data.startDate} to ${data.endDate}. ${data.affectedSessions} sessions cancelled.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveRequestRejectedData {
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  rejectedBy: string;
  rejectedByRole: string;
  reason: string;
}

export function leaveRequestRejectedTemplate(data: LeaveRequestRejectedData) {
  const subject = `❌ Leave Rejected — ${data.startDate} to ${data.endDate}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request Rejected</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.teacherName},</p>
    ${alertBox('Your leave request has been rejected.', '#dc2626', '#fef2f2')}
    ${infoTable([
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['Rejected By', `${data.rejectedBy} (${data.rejectedByRole})`], ['Reason', data.reason],
    ])}
  `;
  const text = `Leave rejected: ${data.startDate} to ${data.endDate}. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveSessionsAffectedData {
  recipientName: string;
  teacherName: string;
  batchName: string;
  sessionDates: string;
  sessionsCount: number;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export function leaveSessionsAffectedTemplate(data: LeaveSessionsAffectedData) {
  const subject = `⚠️ Sessions Cancelled — ${data.batchName} (Teacher on Leave)`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Sessions Cancelled Due to Teacher Leave</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.recipientName},</p>
    ${alertBox(`${data.sessionsCount} session${data.sessionsCount !== 1 ? 's' : ''} cancelled because teacher is on leave.`, '#f59e0b', '#fffbeb')}
    ${infoTable([
      ['Batch', data.batchName], ['Teacher', data.teacherName],
      ['Leave Period', `${data.startDate} to ${data.endDate}`],
      ['Cancelled Dates', data.sessionDates],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">The academic team will arrange make-up sessions if needed.</p>
  `;
  const text = `${data.sessionsCount} sessions for ${data.batchName} cancelled — teacher ${data.teacherName} on leave (${data.startDate} to ${data.endDate}).`;
  return { subject, html: masterLayout(body, ''), text };
}

// ── Template: Invoice Generated ─────────────────────────────

export interface InvoiceGeneratedData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  dueDate: string;
  billingPeriod: string;
  payLink: string;
}

export function invoiceGeneratedTemplate(data: InvoiceGeneratedData) {
  const subject = `📄 New Invoice ${data.invoiceNumber} — ${data.amount} due by ${data.dueDate}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">New Invoice Generated</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">A new invoice has been generated for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Invoice #', data.invoiceNumber],
      ['Description', data.description],
      ['Amount', data.amount],
      ['Billing Period', data.billingPeriod],
      ['Due Date', data.dueDate],
    ])}

    <div style="margin:24px 0;">
      ${button('Pay Now', data.payLink, '#28a745')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Please ensure payment is made before the due date to avoid any disruption in classes.</p>
  `;
  const text = `New Invoice ${data.invoiceNumber}\n\nDear ${data.recipientName},\n\nA new invoice of ${data.amount} has been generated for ${data.studentName}.\nDescription: ${data.description}\nDue Date: ${data.dueDate}\n\nPay at: ${data.payLink}\n\n— SmartUp Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payment Receipt ───────────────────────────────

export interface PaymentReceiptData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  receiptNumber: string;
  invoiceNumber: string;
  amount: string;
  transactionId: string;
  paymentMethod: string;
  paymentDate: string;
  receiptLink: string;
}

export function paymentReceiptTemplate(data: PaymentReceiptData) {
  const subject = `✅ Payment Received — ${data.receiptNumber} (${data.amount})`;
  const body = `
    <div style="text-align:center; padding:16px; background-color:#e8f5e9; border-radius:8px; margin:0 0 24px;">
      <span style="font-size:32px;">✓</span>
      <h2 style="margin:8px 0 0; color:#2e7d32; font-size:20px;">Payment Successful</h2>
    </div>

    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">Payment has been received for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Receipt #', data.receiptNumber],
      ['Invoice #', data.invoiceNumber],
      ['Amount', data.amount],
      ['Transaction ID', data.transactionId],
      ['Payment Method', data.paymentMethod],
      ['Date', data.paymentDate],
    ])}

    <div style="margin:24px 0;">
      ${button('View Receipt', data.receiptLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">This is an auto-generated receipt. Please save it for your records.</p>
  `;
  const text = `Payment Received — ${data.receiptNumber}\n\nDear ${data.recipientName},\n\nAmount: ${data.amount}\nTransaction ID: ${data.transactionId}\nReceipt: ${data.receiptLink}\n\n— SmartUp Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payslip Notification ──────────────────────────

export interface PayslipNotificationData {
  teacherName: string;
  recipientEmail: string;
  periodLabel: string;
  classesConducted: number;
  basePay: string;
  incentive: string;
  deductions: string;
  totalPay: string;
  status: string;
}

export function payslipNotificationTemplate(data: PayslipNotificationData) {
  const subject = `💰 Payslip — ${data.periodLabel} (${data.totalPay})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Payslip for ${data.periodLabel}</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.teacherName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">Your payslip for <strong>${data.periodLabel}</strong> has been ${data.status === 'paid' ? 'paid' : 'generated'}.</p>

    ${infoTable([
      ['Period', data.periodLabel],
      ['Classes Conducted', String(data.classesConducted)],
      ['Base Pay', data.basePay],
      ['Incentive', data.incentive],
      ['Deductions (LOP)', data.deductions],
      ['Total Pay', data.totalPay],
      ['Status', data.status.toUpperCase()],
    ])}

    ${data.status === 'paid'
      ? alertBox('Your salary has been processed and credited.', '#2e7d32', '#e8f5e9')
      : alertBox('Your payslip has been generated. Payment will be processed shortly.', '#1565c0', '#e3f2fd')
    }

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">For any discrepancies, please contact the HR department.</p>
  `;
  const text = `Payslip for ${data.periodLabel}\n\nDear ${data.teacherName},\nClasses: ${data.classesConducted}\nBase Pay: ${data.basePay}\nIncentive: ${data.incentive}\nDeductions: ${data.deductions}\nTotal: ${data.totalPay}\nStatus: ${data.status}\n\n— SmartUp Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payment Reminder ──────────────────────────────

export interface PaymentReminderData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  payLink: string;
}

export function paymentReminderTemplate(data: PaymentReminderData) {
  const isOverdue = data.daysOverdue > 0;
  const subject = isOverdue
    ? `⚠️ Payment Overdue — ${data.invoiceNumber} (${data.daysOverdue} days)`
    : `🔔 Payment Reminder — ${data.invoiceNumber} due ${data.dueDate}`;
  const body = `
    ${isOverdue
      ? alertBox(`Payment of ${data.amount} is ${data.daysOverdue} day${data.daysOverdue !== 1 ? 's' : ''} overdue!`, '#d32f2f', '#ffebee')
      : alertBox(`Payment of ${data.amount} is due by ${data.dueDate}.`, '#f57c00', '#fff3e0')
    }

    <p style="color:#6c757d; font-size:14px; margin:16px 0;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">This is a reminder for the pending fee payment for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Invoice #', data.invoiceNumber],
      ['Amount', data.amount],
      ['Due Date', data.dueDate],
      ...(isOverdue ? [['Overdue By', `${data.daysOverdue} days`] as [string, string]] : []),
    ])}

    <div style="margin:24px 0;">
      ${button('Pay Now', data.payLink, isOverdue ? '#d32f2f' : '#28a745')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Continued non-payment may result in temporary suspension from classes.</p>
  `;
  const text = `Payment ${isOverdue ? 'Overdue' : 'Reminder'} — ${data.invoiceNumber}\n\nDear ${data.recipientName},\nAmount: ${data.amount}\nDue Date: ${data.dueDate}${isOverdue ? `\nOverdue: ${data.daysOverdue} days` : ''}\n\nPay at: ${data.payLink}\n\n— SmartUp Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}
