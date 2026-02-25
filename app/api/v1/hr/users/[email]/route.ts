// ═══════════════════════════════════════════════════════════════
// HR Users [email] API — GET + PATCH + DELETE
// GET    /api/v1/hr/users/[email] — Get user + profile
// PATCH  /api/v1/hr/users/[email] — Update user + profile
// DELETE /api/v1/hr/users/[email] — Deactivate user
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getEffectivePermissions } from '@/lib/permissions-server';

async function getHR(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['hr', 'owner'].includes(user.role)) return null;
  return user;
}

type Params = { params: Promise<{ email: string }> };

// ── GET — Fetch single user ─────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email } = await params;
  const emailStr = decodeURIComponent(email).toLowerCase();

  const result = await db.query(
    `SELECT
       u.email, u.full_name, u.portal_role, u.is_active, u.created_at,
       p.phone, p.whatsapp, p.subjects, p.grade, p.section, p.board,
       p.parent_email, p.qualification, p.experience_years, p.per_hour_rate, p.assigned_region,
       p.admission_date, p.notes, p.address,
       par.full_name AS parent_name
     FROM portal_users u
     LEFT JOIN user_profiles p ON p.email = u.email
     LEFT JOIN portal_users par ON par.email = p.parent_email
     WHERE u.email = $1`,
    [emailStr]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { user: result.rows[0] } });
}

// ── PATCH — Update user + profile ──────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email } = await params;
  const emailStr = decodeURIComponent(email).toLowerCase();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  // Check user exists
  const existing = await db.query('SELECT email, portal_role FROM portal_users WHERE email = $1', [emailStr]);
  if (existing.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  await db.withTransaction(async (client) => {
    // Update portal_users fields
    if (body.full_name !== undefined) {
      await client.query(
        'UPDATE portal_users SET full_name = $1, updated_at = NOW() WHERE email = $2',
        [(body.full_name as string).trim(), emailStr]
      );
    }
    if (body.is_active !== undefined) {
      // Check users_deactivate permission
      const perms = await getEffectivePermissions(caller.id, caller.role);
      if (perms.users_deactivate !== true && caller.role !== 'owner') {
        return NextResponse.json({ success: false, error: 'You do not have permission to change user status' }, { status: 403 });
      }
      await client.query(
        'UPDATE portal_users SET is_active = $1, updated_at = NOW() WHERE email = $2',
        [body.is_active as boolean, emailStr]
      );
    }

    // Upsert user_profiles
    const profileFields: string[] = [];
    const profileValues: unknown[] = [];
    let idx = 2; // $1 = email

    const profileUpdateable = [
      'phone', 'whatsapp', 'address', 'qualification', 'notes',
      'subjects', 'experience_years', 'per_hour_rate', 'grade', 'section', 'board',
      'parent_email', 'admission_date', 'assigned_region',
    ];

    for (const field of profileUpdateable) {
      if (body[field] !== undefined) {
        profileFields.push(field);
        profileValues.push(body[field] === '' ? null : body[field]);
        idx++;
      }
    }

    if (profileFields.length > 0) {
      // Try update first, then insert
      const setClause = profileFields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const updateResult = await client.query(
        `UPDATE user_profiles SET ${setClause}, updated_at = NOW() WHERE email = $1`,
        [emailStr, ...profileValues]
      );

      if (updateResult.rowCount === 0) {
        // Profile doesn't exist yet — insert
        const colList = ['email', ...profileFields].join(', ');
        const valList = ['$1', ...profileFields.map((_, i) => `$${i + 2}`)].join(', ');
        await client.query(
          `INSERT INTO user_profiles (${colList}) VALUES (${valList})`,
          [emailStr, ...profileValues]
        );
      }
    }
  });

  return NextResponse.json({ success: true, message: 'User updated successfully' });
}

// ── DELETE — Deactivate or permanently delete user ─────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const caller = await getHR(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Check users_deactivate permission
  const perms = await getEffectivePermissions(caller.id, caller.role);
  if (perms.users_deactivate !== true && caller.role !== 'owner') {
    return NextResponse.json({ success: false, error: 'You do not have permission to delete/deactivate users' }, { status: 403 });
  }

  const { email } = await params;
  const emailStr = decodeURIComponent(email).toLowerCase();

  // Prevent self-deletion
  if (emailStr === caller.id) {
    return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
  }

  const url = new URL(req.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  if (permanent) {
    // Prevent deleting owner accounts
    const userCheck = await db.query('SELECT portal_role FROM portal_users WHERE email = $1', [emailStr]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (userCheck.rows[0].portal_role === 'owner') {
      return NextResponse.json({ success: false, error: 'Cannot delete owner accounts' }, { status: 403 });
    }

    await db.withTransaction(async (client) => {
      await client.query('DELETE FROM user_profiles WHERE email = $1', [emailStr]);
      await client.query('DELETE FROM portal_users WHERE email = $1', [emailStr]);
    });

    return NextResponse.json({ success: true, message: 'User permanently deleted' });
  }

  // Soft deactivate
  const result = await db.query(
    'UPDATE portal_users SET is_active = FALSE, updated_at = NOW() WHERE email = $1 RETURNING email',
    [emailStr]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'User deactivated successfully' });
}
