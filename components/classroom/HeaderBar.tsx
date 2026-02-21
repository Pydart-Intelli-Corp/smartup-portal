'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParticipants } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * HeaderBar — Room info, live countdown timer, participant count, sidebar toggle.
 * Sits at the top of TeacherView and StudentView.
 *
 * Shows a COUNTDOWN to class end time (scheduled_start + duration_minutes).
 * At 5 minutes remaining, shows a warning banner.
 * At 0:00, fires onTimeExpired callback (no overtime allowed).
 */

export interface HeaderBarProps {
  roomName: string;
  role: 'teacher' | 'student' | 'ghost';
  /** ISO string of when the class was scheduled to start */
  scheduledStart?: string;
  /** Total class duration in minutes */
  durationMinutes?: number;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  /** Fires once when the class timer reaches 0:00 */
  onTimeExpired?: () => void;
  className?: string;
}

function formatTimer(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HeaderBar({
  roomName,
  role,
  scheduledStart,
  durationMinutes = 60,
  sidebarOpen = true,
  onToggleSidebar,
  onTimeExpired,
  className,
}: HeaderBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const [warningDismissed, setWarningDismissed] = useState(false);
  const participants = useParticipants();
  const expiredFired = useRef(false);

  // Count only visible participants (not hidden)
  const visibleCount = participants.length;

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute class end time from scheduled_start + duration
  const endTime = useMemo(() => {
    if (!scheduledStart) return null;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return null;
    return start + durationMinutes * 60 * 1000;
  }, [scheduledStart, durationMinutes]);

  // Remaining seconds (clamped to 0 — no overtime)
  const remainingSeconds = endTime ? Math.max(0, Math.floor((endTime - now) / 1000)) : null;
  const isExpired = remainingSeconds === 0;
  const isWarning = remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 5 * 60; // last 5 min

  // Elapsed since scheduled start
  const elapsedSeconds = useMemo(() => {
    if (!scheduledStart) return 0;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [scheduledStart, now]);

  // Fire onTimeExpired exactly once when timer hits 0
  useEffect(() => {
    if (isExpired && !expiredFired.current && onTimeExpired) {
      expiredFired.current = true;
      onTimeExpired();
    }
  }, [isExpired, onTimeExpired]);

  return (
    <div className={cn('relative', className)}>
      {/* 5-minute warning banner */}
      {isWarning && !warningDismissed && (
        <div className="flex items-center justify-center gap-3 bg-yellow-600 px-4 py-1.5 text-xs font-semibold text-white">
          <span>⚠ Class ends in {Math.ceil((remainingSeconds ?? 0) / 60)} minute{Math.ceil((remainingSeconds ?? 0) / 60) !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setWarningDismissed(true)}
            className="rounded bg-yellow-700/60 px-2 py-0.5 text-[10px] hover:bg-yellow-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Time expired banner */}
      {isExpired && (
        <div className="flex items-center justify-center bg-red-600 px-4 py-1.5 text-xs font-semibold text-white animate-pulse">
          ⏰ Class time has ended — disconnecting...
        </div>
      )}

      <div className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        {/* Left: SmartUp + Room name */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-emerald-400">S</span>
          <span className="truncate text-sm font-medium text-white">
            {roomName}
          </span>
        </div>

        {/* Center: Live badge + countdown + elapsed + participants */}
        <div className="flex items-center gap-4">
          {/* Live badge */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold uppercase text-red-400">Live</span>
          </div>

          {/* Countdown timer */}
          {remainingSeconds !== null ? (
            <div className="flex items-center gap-2">
              {/* Remaining time (clamped at 00:00) */}
              <div
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-sm font-semibold',
                  isExpired
                    ? 'animate-pulse bg-red-600/30 text-red-400'
                    : isWarning
                      ? 'bg-yellow-600/20 text-yellow-400'
                      : 'text-white'
                )}
              >
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              {/* Elapsed (smaller, secondary) */}
              <span className="text-xs text-gray-500" title="Elapsed time">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
          ) : (
            /* Fallback: just elapsed if no schedule info */
            <span className="font-mono text-sm text-gray-300">{formatTimer(elapsedSeconds)}</span>
          )}

          {/* Participant count */}
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>👥</span>
            <span>{visibleCount}</span>
          </div>
        </div>

        {/* Right: Sidebar toggle */}
        <div className="flex items-center">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={cn(
                'rounded px-2 py-1 text-sm transition-colors',
                sidebarOpen
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? '▣' : '☰'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
