// ═══════════════════════════════════════════════════════════════
// Coordinator Admissions — /coordinator/admissions
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import AdmissionsClient from './AdmissionsClient';

export default async function AdmissionsPage() {
  const user = await requireRole('coordinator');

  return (
    <AdmissionsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
