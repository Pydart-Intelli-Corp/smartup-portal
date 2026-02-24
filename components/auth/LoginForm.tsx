'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

      // Successful login — redirect to intended URL or role dashboard
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
      const role = data.data?.user?.role || 'student';
      const dashboardMap: Record<string, string> = {
        coordinator:        '/coordinator',
        academic_operator:  '/academic-operator',
        academic:           '/academic-operator', // legacy alias
        hr:                 '/hr',
        teacher:            '/teacher',
        student:            '/student',
        parent:             '/parent',
        owner:              '/owner',
        ghost:              '/ghost',
      };
      router.push(dashboardMap[role] || '/student');
    } catch {
      setError('Network error — could not reach server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-2xl font-bold text-white">
          S
        </div>
        <h1 className="text-2xl font-bold text-white">SmartUp</h1>
        <p className="mt-1 text-sm text-gray-400">
          Live Classes for Class 1–12 (CBSE / ICSE)
        </p>
      </div>

      {/* Login Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-300">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@smartuplearning.online"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
              className="h-11 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
                className="h-11 pr-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="h-11 w-full bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-600/50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In to SmartUp'
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-sm text-red-400">
              <span className="mt-0.5 shrink-0">!</span>
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
