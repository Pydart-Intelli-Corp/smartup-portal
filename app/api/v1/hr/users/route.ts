// ═══════════════════════════════════════════════════════════════
// HR Users API — GET + POST
// GET  /api/v1/hr/users?role=teacher|student|coordinator|parent|all
// POST /api/v1/hr/users — Create user + profile + send credentials
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { hash } from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { credentialsTemplate } from '@/lib/email-templates';
import type { PortalRole } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const ROLE_LABELS: Record<string, string> = {
  teacher:     'Teacher',
  student:     'Student',
  coordinator: 'Batch Coordinator',
  parent:      'Parent',
  hr:          'HR Associate',
  academic_operator: 'Academic Operator',
};

async function getHR(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['hr', 'owner'].includes(user.role)) return null;
  return user;
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ── GET — List users ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const role = url.searchParams.get('role') || 'all';
  const search = url.searchParams.get('q') || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const allowedRoles: PortalRole[] = ['teacher', 'student', 'coordinator', 'parent', 'hr', 'academic_operator'];

  let sql = `
    SELECT
      u.email, u.full_name, u.portal_role, u.is_active, u.created_at,
      p.phone, p.whatsapp, p.subjects, p.grade, p.section, p.board,
      p.parent_email, p.qualification, p.experience_years, p.assigned_region,
      p.admission_date, p.notes, p.date_of_birth,
      par.full_name AS parent_name
    FROM portal_users u
    LEFT JOIN user_profiles p ON p.email = u.email
    LEFT JOIN portal_users par ON par.email = p.parent_email
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (role !== 'all' && allowedRoles.includes(role as PortalRole)) {
    params.push(role);
    sql += ` AND u.portal_role = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  sql += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(sql, params);

  // Count
  let countSql = `SELECT COUNT(*) FROM portal_users u WHERE 1=1`;
  const countParams: unknown[] = [];
  if (role !== 'all' && allowedRoles.includes(role as PortalRole)) {
    countParams.push(role);
    countSql += ` AND u.portal_role = $${countParams.length}`;
  }
  if (search) {
    countParams.push(`%${search}%`);
    countSql += ` AND (u.full_name ILIKE $${countParams.length} OR u.email ILIKE $${countParams.length})`;
  }
  const countResult = await db.query(countSql, countParams);

  return NextResponse.json({
    success: true,
    data: {
      users: result.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
    },
  });
}

// ── POST — Create new user ──────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    email, full_name, portal_role, password: manualPassword,
    // Profile fields
    phone, whatsapp, date_of_birth, qualification, notes, experience_years, assigned_region, admission_date,
    // Teacher
    subjects,
    // Student
    grade, section, board, parent_email,
  } = body as Record<string, unknown>;

  if (!email || !full_name || !portal_role) {
    return NextResponse.json({ success: false, error: 'email, full_name, and portal_role are required' }, { status: 400 });
  }

  const emailStr = (email as string).trim().toLowerCase();
  const roleStr = portal_role as PortalRole;

  const allowedRoles: PortalRole[] = ['teacher', 'student', 'coordinator', 'parent', 'academic_operator'];
  if (!allowedRoles.includes(roleStr)) {
    return NextResponse.json({ success: false, error: 'Invalid role. Allowed: teacher, student, coordinator, parent, academic_operator' }, { status: 400 });
  }

  // Check duplicate
  const existing = await db.query('SELECT email FROM portal_users WHERE email = $1', [emailStr]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
  }

  // Parent validation for students
  if (roleStr === 'student' && parent_email) {
    const parentCheck = await db.query(
      `SELECT email FROM portal_users WHERE email = $1 AND portal_role = 'parent'`,
      [(parent_email as string).trim().toLowerCase()]
    );
    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Parent email not found. Create parent account first.' }, { status: 400 });
    }
  }

  const tempPassword = (manualPassword as string | undefined)?.trim() || generatePassword();
  const passwordHash = await hash(tempPassword, 12);

  await db.withTransaction(async (client) => {
    // 1. Create portal_user
    await client.query(
      `INSERT INTO portal_users (email, full_name, portal_role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [emailStr, (full_name as string).trim(), roleStr, passwordHash]
    );

    // 2. Build profile fields
    const profileSubjects = Array.isArray(subjects) && subjects.length > 0 ? subjects : null;
    const profileParent = parent_email ? (parent_email as string).trim().toLowerCase() : null;

    await client.query(
      `INSERT INTO user_profiles (
         email, phone, whatsapp, date_of_birth, qualification, notes,
         subjects, experience_years,
         grade, section, board, parent_email, admission_date,
         assigned_region
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8,
         $9, $10, $11, $12, $13,
         $14
       )`,
      [
        emailStr,
        phone || null, whatsapp || null,
        date_of_birth || null,
        qualification || null, notes || null,
        profileSubjects, experience_years || null,
        grade || null, section || null, board || null,
        profileParent,
        admission_date || null,
        assigned_region || null,
      ]
    );
  });

  // 3. Send credentials email (non-blocking — don't fail if email fails)
  const roleLabel = ROLE_LABELS[roleStr] || roleStr;
  let additionalInfo = '';
  if (roleStr === 'teacher' && Array.isArray(subjects) && subjects.length > 0) {
    additionalInfo = `Subjects: ${(subjects as string[]).join(', ')}`;
  }
  if (roleStr === 'student') {
    const parts: string[] = [];
    if (grade) parts.push(`Grade: ${grade}`);
    if (section) parts.push(`Section: ${section}`);
    if (board) parts.push(`Board: ${board}`);
    additionalInfo = parts.join(' | ');
  }

  const tpl = credentialsTemplate({
    recipientEmail: emailStr,
    recipientName: (full_name as string).trim(),
    role: roleLabel,
    loginEmail: emailStr,
    tempPassword,
    loginUrl: `${BASE_URL}/login`,
    additionalInfo: additionalInfo || undefined,
  });

  sendEmail({ to: emailStr, subject: tpl.subject, html: tpl.html, text: tpl.text })
    .catch((err) => console.error('[HR] credentials email failed:', err));

  return NextResponse.json({
    success: true,
    data: {
      email: emailStr,
      full_name: (full_name as string).trim(),
      portal_role: roleStr,
      temp_password: tempPassword,
      email_sent: true,
    },
    message: `${roleLabel} account created. Credentials sent to ${emailStr}`,
  }, { status: 201 });
}
