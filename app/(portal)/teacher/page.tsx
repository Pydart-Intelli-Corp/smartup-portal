// ═══════════════════════════════════════════════════════════════
// Teacher Dashboard — /teacher
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import TeacherDashboardClient from './TeacherDashboardClient';

export default async function TeacherPage() {
  const user = await requireRole('teacher');

  return (
    <TeacherDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
