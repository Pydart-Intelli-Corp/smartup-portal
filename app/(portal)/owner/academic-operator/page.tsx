import { requireRole } from '@/lib/auth-utils';
import AcademicOperatorDashboardClient from '@/app/(portal)/academic-operator/AcademicOperatorDashboardClient';

export const metadata = { title: 'Academic Operations · SmartUp' };

export default async function OwnerAcademicOperatorPage() {
  const user = await requireRole('owner');
  return (
    <AcademicOperatorDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
