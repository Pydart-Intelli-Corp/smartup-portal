// ═══════════════════════════════════════════════════════════════
// GET /api/v1/users/search?q=priya&role=teacher
// ═══════════════════════════════════════════════════════════════
// Search portal_users for coordinator assignment flow.
// Requires authenticated session (coordinator or owner).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { searchUsers, getUsersByRole } from '@/lib/users';
import type { ApiResponse, PortalRole } from '@/types';

export async function GET(request: NextRequest) {
  // Auth check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifySession(token);
  if (!user || !['coordinator', 'academic_operator', 'owner'].includes(user.role)) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const role = searchParams.get('role') as PortalRole | null;

  try {
    const users = q
      ? await searchUsers(q, role || undefined)
      : role
        ? await getUsersByRole(role)
        : [];

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { users: users.map(u => ({
        email: u.email,
        name: u.full_name,
        role: u.portal_role,
        phone: u.phone,
        batchIds: u.batch_ids,
      })) },
    });
  } catch (error) {
    console.error('[User Search]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to search users' }, { status: 500 });
  }
}
