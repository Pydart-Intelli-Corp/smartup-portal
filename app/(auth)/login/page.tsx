import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import LoginForm from '@/components/auth/LoginForm';
import LoginSlideshow from '@/components/auth/LoginSlideshow';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const user = await verifySession(token);
    if (user) redirect('/batch-coordinator');
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {/* ── Logo — top-left on desktop ── */}
      <div className="absolute top-6 left-8 z-40 hidden sm:block">
        <img src="/logo/full.png" alt="SmartUp" className="h-10 object-contain drop-shadow-lg" />
      </div>

      {/* ── Fullscreen image slideshow ── */}
      <LoginSlideshow />

      {/* ── Right-side login panel ── */}
      <div className="absolute inset-y-0 right-0 z-30 flex w-full items-center justify-center sm:w-120 md:w-130">
        {/* Green→teal gradient panel — more transparent */}
        <div className="absolute inset-0 bg-linear-to-b from-emerald-900/60 via-emerald-950/65 to-teal-950/70 backdrop-blur-xl" />
        {/* Subtle left edge glow */}
        <div className="absolute inset-y-0 left-0 w-px bg-emerald-400/10 hidden sm:block" />

        {/* Form content */}
        <div className="relative z-10 w-full px-8 sm:px-12 py-10">
          <LoginForm />
        </div>
      </div>


    </main>
  );
}
