import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PortalRole } from '@/types';

/**
 * Merge Tailwind classes — combines clsx conditional logic with
 * tailwind-merge conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format seconds as MM:SS for class timer display.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Indian Standard Time (IST) Formatters ───────────────────
// All user-facing dates use en-IN locale with Asia/Kolkata timezone
// to ensure consistent IST display regardless of server/browser TZ.

const IST_TZ = 'Asia/Kolkata';
const IST_LOCALE = 'en-IN';

/** Format time only: "07:30 pm" */
export function fmtTimeIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(IST_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST_TZ });
}

/** Format date only: "21 Feb 2026" */
export function fmtDateShortIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(IST_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST_TZ });
}

/** Format date only (no year): "21 Feb" */
export function fmtDateBriefIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(IST_LOCALE, { day: 'numeric', month: 'short', timeZone: IST_TZ });
}

/** Format full date: "21 February 2026" */
export function fmtDateLongIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(IST_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: IST_TZ });
}

/** Format date + time: "21 Feb 2026, 07:30 pm" */
export function fmtDateTimeIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(IST_LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: IST_TZ,
  });
}

/** Smart format: "Today 07:30 pm" / "Tomorrow 07:30 pm" / "21 Feb 07:30 pm" */
export function fmtSmartDateIST(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  // Compare date strings in IST
  const dStr = d.toLocaleDateString(IST_LOCALE, { timeZone: IST_TZ });
  const nowStr = now.toLocaleDateString(IST_LOCALE, { timeZone: IST_TZ });
  const tomStr = tomorrow.toLocaleDateString(IST_LOCALE, { timeZone: IST_TZ });
  const time = fmtTimeIST(d);
  if (dStr === nowStr) return `Today ${time}`;
  if (dStr === tomStr) return `Tomorrow ${time}`;
  return `${fmtDateBriefIST(d)} ${time}`;
}

/**
 * Generate a consistent room name from batch + schedule IDs.
 * Format: class_{batchId}_{scheduleId}
 */
export function generateRoomId(batchId: string, scheduleId: string): string {
  return `class_${batchId}_${scheduleId}`;
}

/** Get IST date value (YYYY-MM-DD) for <input type="date"> fields */
export function toISTDateValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: IST_TZ }); // en-CA → YYYY-MM-DD
}

/** Get IST time value (HH:mm) for <input type="time"> fields */
export function toISTTimeValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST_TZ });
}

/** Convert IST date (YYYY-MM-DD) + time (HH:mm) → UTC ISO string.
 *  IST is always UTC+05:30, so we subtract 5h30m. */
export function istToUTCISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, h - 5, min - 30));
  return utc.toISOString();
}

/**
 * Check if a role has ghost observation access.
 * Ghost roles: ghost (dedicated), owner, academic_operator, coordinator, academic (full access)
 * Parent has limited ghost access (child's room only, handled separately).
 */
export function isGhostRole(role: PortalRole): boolean {
  return ['ghost', 'owner', 'academic_operator', 'coordinator', 'academic'].includes(role);
}

/**
 * Check if a role has full ghost dashboard/oversight access.
 */
export function hasFullGhostAccess(role: PortalRole): boolean {
  return ['ghost', 'owner', 'academic_operator', 'coordinator', 'academic'].includes(role);
}
