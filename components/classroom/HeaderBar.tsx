'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParticipants } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * HeaderBar — Room info, live countdown timer, participant count, sidebar toggle.
 * Sits at the top of TeacherView and StudentView.
 *
 * Shows a COUNTDOWN to class end time (scheduled_start + duration_minutes).
 * When time runs out, flashes red with "OVERTIME" indicator.
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
  className?: string;
}

function formatTimer(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const prefix = totalSeconds < 0 ? '-' : '';
  if (h > 0) {
    return `${prefix}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${prefix}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HeaderBar({
  roomName,
  role,
  scheduledStart,
  durationMinutes = 60,
  sidebarOpen = true,
  onToggleSidebar,
  className,
}: HeaderBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const participants = useParticipants();

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

  // Remaining seconds (positive = time left, negative = overtime)
  const remainingSeconds = endTime ? Math.floor((endTime - now) / 1000) : null;
  const isOvertime = remainingSeconds !== null && remainingSeconds < 0;
  const isWarning = remainingSeconds !== null && remainingSeconds >= 0 && remainingSeconds <= 5 * 60; // last 5 min

  // Elapsed since scheduled start
  const elapsedSeconds = useMemo(() => {
    if (!scheduledStart) return 0;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [scheduledStart, now]);

  return (
    <div
      className={cn(
        'flex h-12 items-center justify-between border-b border-gray-800 bg-gray-900 px-4',
        className
      )}
    >
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
            {/* Remaining / Overtime */}
            <div
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-sm font-semibold',
                isOvertime
                  ? 'animate-pulse bg-red-600/30 text-red-400'
                  : isWarning
                    ? 'bg-yellow-600/20 text-yellow-400'
                    : 'text-white'
              )}
            >
              {isOvertime && (
                <span className="text-[10px] font-bold uppercase tracking-wider">OT</span>
              )}
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
  );
}
