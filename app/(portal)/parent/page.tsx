// ═══════════════════════════════════════════════════════════════
// Parent Dashboard — /parent
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import ParentDashboardClient from './ParentDashboardClient';

export default async function ParentPage() {
  const user = await requireRole('parent');

  return (
    <ParentDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
