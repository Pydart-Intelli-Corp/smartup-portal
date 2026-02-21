// ═══════════════════════════════════════════════════════════════
// Student Dashboard — /student
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import StudentDashboardClient from './StudentDashboardClient';

export default async function StudentPage() {
  const user = await requireRole('student');

  return (
    <StudentDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
