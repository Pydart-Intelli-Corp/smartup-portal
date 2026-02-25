import { requireRole } from '@/lib/auth-utils';
import { getEffectivePermissions } from '@/lib/permissions-server';
import HRDashboardClient from '@/app/(portal)/hr/HRDashboardClient';

export const metadata = { title: 'HR Management · SmartUp' };

export default async function OwnerHRPage() {
  const user = await requireRole('owner');
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
