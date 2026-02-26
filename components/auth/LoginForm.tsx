'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      if (redirectTo) { router.push(redirectTo); return; }

      const role = data.data?.user?.role || 'student';
      const dashboardMap: Record<string, string> = {
        batch_coordinator: '/batch-coordinator',
        academic_operator: '/academic-operator',
        academic: '/academic-operator',
        hr: '/hr',
        teacher: '/teacher',
        student: '/student',
        parent: '/parent',
        owner: '/owner',
        ghost: '/ghost',
      };
      router.push(dashboardMap[role] || '/student');
    } catch {
      setError('Network error — could not reach server');
    } finally {
      setLoading(false);
    }
  }

  const emailActive = emailFocused || email.length > 0;
  const passwordActive = passwordFocused || password.length > 0;

  return (
    <div className="flex flex-col h-full justify-center max-w-sm mx-auto">
      {/* Logo — mobile only (desktop logo is in the page top-left) */}
      <div className="mb-6 sm:hidden">
        <img src="/logo/full.png" alt="SmartUp" className="h-10 object-contain drop-shadow-lg" />
      </div>

      {/* Greeting */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Welcome back
        </h1>
        <p className="text-emerald-200/70 text-[15px]">
          Sign in to continue to your dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-300 flex items-start gap-2.5">
            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-red-400/25 flex items-center justify-center">
              <span className="text-red-300 text-[10px] font-bold">!</span>
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Email — floating label ── */}
        <div className="relative">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            disabled={loading}
            autoComplete="email"
            required
            className={`peer w-full h-14 px-4 pt-4 rounded-xl border bg-white/10 text-white placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
              emailFocused
                ? 'border-emerald-400/60 ring-2 ring-emerald-400/15'
                : 'border-white/15 hover:border-white/25'
            }`}
          />
          <label
            htmlFor="email"
            className={`absolute left-4 transition-all duration-200 pointer-events-none ${
              emailActive
                ? 'top-1.5 text-[11px] font-medium text-emerald-300'
                : 'top-1/2 -translate-y-1/2 text-[15px] text-emerald-200/50'
            }`}
          >
            Email address
          </label>
        </div>

        {/* ── Password — floating label ── */}
        <div className="relative">
          <input
            ref={passwordRef}
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            disabled={loading}
            autoComplete="current-password"
            required
            className={`peer w-full h-14 px-4 pt-4 pr-12 rounded-xl border bg-white/10 text-white placeholder:text-emerald-200/40 text-[15px] outline-none transition-all duration-200 disabled:opacity-50 ${
              passwordFocused
                ? 'border-emerald-400/60 ring-2 ring-emerald-400/15'
                : 'border-white/15 hover:border-white/25'
            }`}
          />
          <label
            htmlFor="password"
            className={`absolute left-4 transition-all duration-200 pointer-events-none ${
              passwordActive
                ? 'top-1.5 text-[11px] font-medium text-emerald-300'
                : 'top-1/2 -translate-y-1/2 text-[15px] text-emerald-200/50'
            }`}
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-200/50 hover:text-white/70 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        </div>

        {/* ── Submit button ── */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="group relative w-full h-13 rounded-xl text-emerald-950 font-medium text-[15px] bg-linear-to-r from-emerald-300 to-teal-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 overflow-hidden shadow-lg shadow-emerald-400/15"
        >
          {/* Shimmer effect */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/10 to-transparent" />

          {loading ? (
            <span className="relative flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </span>
          ) : (
            <span className="relative flex items-center justify-center gap-2">
              Continue
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-emerald-200/40">
        SmartUp Learning &middot; Empowering education
      </p>
    </div>
  );
}
