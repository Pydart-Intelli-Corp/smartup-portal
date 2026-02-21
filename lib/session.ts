import { SignJWT, jwtVerify } from 'jose';
import type { SmartUpUser } from '@/types';

/**
 * Portal session JWT management.
 * Uses jose library for Edge Runtime compatibility (works in proxy).
 */

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const EXPIRY = '8h';
const COOKIE_NAME = 'smartup-session';

/**
 * Sign a JWT from a SmartUpUser object.
 */
export async function signSession(user: SmartUpUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

/**
 * Verify and decode the JWT — returns user or null if invalid/expired.
 */
export async function verifySession(token: string): Promise<SmartUpUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SmartUpUser;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
