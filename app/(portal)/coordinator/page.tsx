// ═══════════════════════════════════════════════════════════════
// Coordinator Dashboard — /coordinator
// ═══════════════════════════════════════════════════════════════
// Create rooms, assign teacher/students, send notifications,
// monitor live/scheduled/ended rooms.
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import CoordinatorDashboardClient from './CoordinatorDashboardClient';

export default async function CoordinatorPage() {
  const user = await requireRole('coordinator');

  return (
    <CoordinatorDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
