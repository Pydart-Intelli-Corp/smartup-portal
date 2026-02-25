import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import HRDashboardClient from './HRDashboardClient';

export const metadata = { title: 'HR Dashboard · SmartUp' };

export default async function HRPage() {
  const user = await requireRole('hr');
  const permissions = await getEffectivePermissions(user.id, user.role);
  return (
    <HRDashboardClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
      permissions={permissions}
    />
  );
}
