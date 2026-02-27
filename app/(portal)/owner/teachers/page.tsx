import { requireRole } from '@/lib/auth-utils';
import OwnerTeachersClient from './OwnerTeachersClient';

export const metadata = { title: 'Teacher Management · SmartUp' };

export default async function OwnerTeachersPage() {
  const user = await requireRole('owner');
  return (
    <OwnerTeachersClient
      userName={user.name}
      userEmail={user.id}
      userRole={user.role}
    />
  );
}
