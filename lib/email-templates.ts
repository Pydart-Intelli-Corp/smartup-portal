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
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">SmartUp</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa; padding:20px 32px; border-top:1px solid #e9ecef;">
              <p style="margin:0 0 4px; font-size:13px; color:#6c757d;">SmartUp Online Classes &nbsp;|&nbsp; class.smartup.live</p>
              <p style="margin:0 0 4px; font-size:13px; color:#6c757d;">Need help? <a href="mailto:support@smartup.live" style="color:#4a6cf7;">support@smartup.live</a></p>
              <p style="margin:0; font-size:12px; color:#adb5bd;">This email was sent to ${recipientEmail}</p>
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

function button(text: string, href: string, color: string = '#4a6cf7'): string {
  return `<a href="${href}" style="display:inline-block; padding:14px 28px; background-color:${color}; color:#ffffff; text-decoration:none; border-radius:6px; font-size:15px; font-weight:600; margin:8px 4px 8px 0;">${text}</a>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px; font-size:14px; color:#6c757d; border-bottom:1px solid #f1f3f5;">${label}</td>
    <td style="padding:6px 12px; font-size:14px; color:#1a1a2e; font-weight:600; border-bottom:1px solid #f1f3f5;">${value}</td>
  </tr>`;
}

function infoTable(rows: [string, string][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; border:1px solid #e9ecef; border-radius:6px; overflow:hidden;">
    ${rows.map(([l, v]) => infoRow(l, v)).join('\n')}
  </table>`;
}

function alertBox(text: string, color: string, bgColor: string): string {
  return `<div style="padding:12px 16px; background-color:${bgColor}; border-left:4px solid ${color}; border-radius:4px; margin:16px 0; font-size:14px; color:${color};">${text}</div>`;
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
    'Teacher': '#059669', 'Student': '#7c3aed', 'Batch Coordinator': '#2563eb',
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
