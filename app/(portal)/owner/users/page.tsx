// ═══════════════════════════════════════════════════════════════
// Owner → Users & HR Management — Server Page
// ═══════════════════════════════════════════════════════════════

import { requireRole } from '@/lib/auth-utils';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const user = await requireRole('owner');
  return <UsersClient userName={user.name} userEmail={user.id} userRole={user.role} />;
}
