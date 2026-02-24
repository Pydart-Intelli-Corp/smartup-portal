import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import LoginForm from '@/components/auth/LoginForm';

/**
 * Login page — auth layout group.
 * If the user already has a valid session, redirect to /dev.
 * Otherwise render the LoginForm.
 */
export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const user = await verifySession(token);
    if (user) redirect('/coordinator'); // middleware will re-route by role
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoginForm />
    </main>
  );
}
