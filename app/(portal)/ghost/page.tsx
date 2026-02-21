// ═══════════════════════════════════════════════════════════════
// Ghost Dashboard — /ghost
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import GhostDashboardClient from './GhostDashboardClient';

export default async function GhostPage() {
  const user = await requireRole('ghost');

  return (
    <GhostDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
