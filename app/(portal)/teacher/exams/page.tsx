// ═══════════════════════════════════════════════════════════════
// Teacher Exams — /teacher/exams
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import TeacherExamsClient from './TeacherExamsClient';

export default async function TeacherExamsPage() {
  const user = await requireRole('teacher');
  return (
    <TeacherExamsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
