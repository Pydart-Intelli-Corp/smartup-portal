// ═══════════════════════════════════════════════════════════════
// Coordinator Cancellations — /coordinator/cancellations
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import CancellationsClient from './CancellationsClient';

export default async function CancellationsPage() {
  const user = await requireRole('coordinator');

  return (
    <CancellationsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
