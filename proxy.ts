import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';

/**
 * SmartUp Portal Middleware
 * Protects portal routes — redirects to /login if no valid session.
 */

// Routes that do NOT require a session
const PUBLIC_PATHS = ['/login', '/expired', '/api/v1/auth/login', '/api/v1/health'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow public paths ──────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Allow all API routes — each route validates itself ─────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Allow /join/* — token in URL is the auth ───────────────
  if (pathname.startsWith('/join/')) {
    const response = NextResponse.next();
    response.headers.set('x-join-route', '1');
    return response;
  }

  // ── Allow /classroom/* — auth via sessionStorage token ───
  if (pathname.startsWith('/classroom/')) {
    const response = NextResponse.next();
    response.headers.set('x-join-route', '1');
    return response;
  }

  // ── /dev only in development ───────────────────────────────
  if (pathname.startsWith('/dev') && process.env.NODE_ENV !== 'development') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── All other routes require a valid session cookie ────────
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = await verifySession(sessionCookie);

  if (!user) {
    // Invalid or expired token — clear cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ── If logged in user visits /login, redirect to dashboard ──
  if (pathname === '/login') {
    const dashboardUrl = getDashboardUrl(user.role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // ── Role-based route protection ────────────────────────────
  // Owner can access everything
  if (user.role === 'owner') return NextResponse.next();

  const routeRoleMap: Record<string, string[]> = {
    '/coordinator':       ['coordinator'],
    '/academic-operator': ['academic_operator', 'academic'], // 'academic' is legacy alias
    '/hr':                ['hr'],
    '/teacher':           ['teacher'],
    '/student':           ['student'],
    '/parent':            ['parent'],
    '/ghost':             ['ghost'],
  };

  for (const [prefix, roles] of Object.entries(routeRoleMap)) {
    if (pathname.startsWith(prefix) && !roles.includes(user.role)) {
      return NextResponse.redirect(new URL(getDashboardUrl(user.role), request.url));
    }
  }

  return NextResponse.next();
}

/** Maps portal role to their dashboard URL */
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'coordinator':       return '/coordinator';
    case 'academic_operator': return '/academic-operator';
    case 'academic':          return '/academic-operator'; // legacy alias
    case 'hr':                return '/hr';
    case 'teacher':           return '/teacher';
    case 'student':           return '/student';
    case 'parent':            return '/parent';
    case 'owner':             return '/owner';
    case 'ghost':             return '/ghost';
    default:                  return '/login';
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
