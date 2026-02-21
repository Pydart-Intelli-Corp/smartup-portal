import { requireRole } from '@/lib/auth-utils';
import HRDashboardClient from './HRDashboardClient';

export const metadata = { title: 'HR Dashboard · SmartUp' };

export default async function HRPage() {
  const user = await requireRole('hr');
  return (
    <HRDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
