// ═══════════════════════════════════════════════════════════════
// Server-side user getter for dashboard pages
// ═══════════════════════════════════════════════════════════════

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import type { SmartUpUser } from '@/types';

/**
 * Get authenticated user or redirect to login.
 * Use in server components: const user = await getServerUser();
 */
export async function getServerUser(): Promise<SmartUpUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect('/login');

  const user = await verifySession(token);
  if (!user) redirect('/login');

  return user;
}

/**
 * Get user and ensure they have the required role.
 * Redirects to their correct dashboard if role mismatch.
 */
export async function requireRole(...roles: string[]): Promise<SmartUpUser> {
  const user = await getServerUser();

  if (!roles.includes(user.role)) {
    // Owner can access everything
    if (user.role === 'owner') return user;

    const dashMap: Record<string, string> = {
      batch_coordinator:   '/batch-coordinator',
      academic_operator:  '/academic-operator',
      academic:           '/academic-operator', // legacy alias
      hr:                 '/hr',
      teacher:            '/teacher',
      student:            '/student',
      parent:             '/parent',
      owner:              '/owner',
      ghost:              '/ghost',
    };
    redirect(dashMap[user.role] || '/login');
  }

  return user;
}
