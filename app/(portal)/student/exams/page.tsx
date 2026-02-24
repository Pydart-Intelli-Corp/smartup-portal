// ═══════════════════════════════════════════════════════════════
// Student Exam List — /student/exams
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import StudentExamsClient from './StudentExamsClient';

export default async function StudentExamsPage() {
  const user = await requireRole('student');
  return (
    <StudentExamsClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
