'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateShortIST, fmtTimeIST, cn } from '@/lib/utils';
import {
  Video,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Timer,
} from 'lucide-react';

interface Props {
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  status: string;
  scheduledStart: string;
  durationMinutes: number;
  teacherEmail: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  emailToken: string | null;
  device: string;
}

/** Format ms into "Xh Ym Zs" or "Ym Zs" or "Zs" */
function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function JoinRoomClient({
  roomId,
  roomName,
  subject,
  grade,
  status,
  scheduledStart,
  durationMinutes,
  teacherEmail,
  userName,
  userEmail,
  userRole,
  emailToken,
  device,
}: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => setMounted(true), []);

  const startDate = new Date(scheduledStart);
  const lobbyOpenTime = new Date(startDate.getTime() - 15 * 60 * 1000);
  const endTime = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const isLive = status === 'live';
  const isScheduled = status === 'scheduled';
  const isEnded = status === 'ended' || now > endTime;
  const lobbyOpen = now >= lobbyOpenTime;
  const canJoin = (isLive || (isScheduled && lobbyOpen)) && !isEnded;

  // How far away is the lobby opening?
  const msUntilLobby = lobbyOpenTime.getTime() - now.getTime();
  // How far away is class start?
  const msUntilStart = startDate.getTime() - now.getTime();

  // Tick every second when waiting, so countdown updates live
  const needsTick = useCallback(() => {
    return mounted && !isEnded && !lobbyOpen;
  }, [mounted, isEnded, lobbyOpen]);

  useEffect(() => {
    if (!needsTick()) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Max poll attempts (5 min ÷ 5s = 60 attempts)
  const MAX_POLL = 60;

  // Auto-poll when waiting for teacher to go live (every 5s, max 60 attempts)
  useEffect(() => {
    if (!waitingForTeacher) return;
    if (pollCount >= MAX_POLL) {
      setWaitingForTeacher(false);
      setError('Teacher has not started the class yet. Please try again later.');
      return;
    }
    const id = setInterval(() => {
      if (!joining) {
        setPollCount((c) => c + 1);
        handleJoin();
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForTeacher, pollCount, joining]);

  async function handleJoin() {
    setJoining(true);
    setError('');

    try {
      // Pass device param so teachers joining from tablet get screen-only grants
      const isScreenDevice = device === 'screen' || device === 'tablet';
      const res = await fetch('/api/v1/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          ...(isScreenDevice && userRole === 'teacher' ? { device: 'screen' } : {}),
          // Pass email token so the API can authenticate without session cookie
          ...(emailToken ? { email_token: emailToken } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Special case: teacher hasn't started the class yet
        if (data.error === 'CLASS_NOT_LIVE') {
          setWaitingForTeacher(true);
          setError('');
          return;
        }
        setError(data.error || 'Failed to join room');
        return;
      }

      setWaitingForTeacher(false);

      // Store session data and redirect to classroom
      const result = data.data;
      if (result?.livekit_token) {
        sessionStorage.setItem('lk_token', result.livekit_token);
        sessionStorage.setItem('lk_url', result.livekit_url || '');
        sessionStorage.setItem('room_name', result.room_name || roomId);
        sessionStorage.setItem('participant_role', result.role || userRole);
        sessionStorage.setItem('participant_name', result.participant_name || userName);
        sessionStorage.setItem('scheduled_start', result.scheduled_start || new Date().toISOString());
        sessionStorage.setItem('duration_minutes', String(result.duration_minutes || durationMinutes));
        sessionStorage.setItem('device', result.device || 'primary');
        sessionStorage.setItem('room_status', result.room_status || 'scheduled');
        sessionStorage.setItem('is_rejoin', result.is_rejoin ? 'true' : 'false');
        router.push(`/classroom/${roomId}`);
      } else {
        setError('No token received from server');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-white/80" />
          <h1 className="text-xl font-bold text-white">{roomName}</h1>
          <p className="text-sm text-blue-200">
            {subject} · {grade}
          </p>
        </div>

        {/* Room info */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-800 p-3 text-center">
              <Calendar className="mx-auto mb-1 h-4 w-4 text-gray-500" />
              <p className="text-sm font-medium" suppressHydrationWarning>
                {mounted
                  ? fmtDateShortIST(startDate)
                  : '\u00A0'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 p-3 text-center">
              <Clock className="mx-auto mb-1 h-4 w-4 text-gray-500" />
              <p className="text-sm font-medium" suppressHydrationWarning>
                {mounted
                  ? `${fmtTimeIST(startDate)} · ${durationMinutes}m`
                  : '\u00A0'}
              </p>
            </div>
          </div>

          {teacherEmail && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-800 p-3">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-400">Teacher assigned</span>
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail} · {userRole}</p>
            </div>
          </div>

          {/* Status banners */}
          {isLive && !isEnded && (
            <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-950/30 p-3 text-green-400">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium">Class is Live — Join Now!</span>
            </div>
          )}

          {isScheduled && lobbyOpen && !isEnded && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/30 p-3 text-blue-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Lobby is open — you can enter early</span>
            </div>
          )}

          {/* ── Early arrival: class not open yet ─────────────── */}
          {isScheduled && !lobbyOpen && mounted && (
            <div className="space-y-3">
              {/* Main countdown card */}
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-900/40">
                    <Timer className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-300">
                      You&apos;re early!
                    </p>
                    <p className="mt-1 text-xs text-amber-400/80">
                      This class is scheduled for{' '}
                      <span className="font-medium text-amber-300">
                        {fmtTimeIST(startDate)}, {fmtDateShortIST(startDate)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Countdown display */}
                <div className="mt-3 flex items-center justify-center gap-2 rounded-md bg-gray-900/60 py-3" suppressHydrationWarning>
                  <Clock className="h-4 w-4 text-amber-400/70" />
                  {msUntilLobby > 3600000 ? (
                    <span className="text-sm text-gray-300">
                      Lobby opens in <span className="font-bold text-amber-300">{fmtCountdown(msUntilLobby)}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">
                      Lobby opens in <span className="font-mono font-bold text-amber-300">{fmtCountdown(msUntilLobby)}</span>
                    </span>
                  )}
                </div>

                {/* Timeline */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-gray-800/50 px-2 py-1.5 text-center">
                    <span className="text-gray-500">Lobby opens</span>
                    <p className="font-medium text-gray-300">{fmtTimeIST(lobbyOpenTime)}</p>
                  </div>
                  <div className="rounded bg-gray-800/50 px-2 py-1.5 text-center">
                    <span className="text-gray-500">Class starts</span>
                    <p className="font-medium text-gray-300">{fmtTimeIST(startDate)}</p>
                  </div>
                </div>
              </div>

              {/* Helpful tip */}
              <div className="flex items-start gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                <p className="text-xs text-gray-500">
                  You can join the lobby <strong>15 minutes</strong> before the scheduled start time.
                  This page will update automatically — no need to refresh.
                </p>
              </div>
            </div>
          )}

          {isEnded && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-gray-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">This class has already ended</span>
            </div>
          )}

          {/* ── Waiting for teacher to go live ────────────────── */}
          {waitingForTeacher && !isEnded && (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900/40">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-300">
                      Waiting for teacher to start the class
                    </p>
                    <p className="mt-1 text-xs text-blue-400/80">
                      The teacher is setting up. You&apos;ll be connected automatically once the class goes live.
                    </p>
                  </div>
                </div>

                {/* Pulsing dots animation */}
                <div className="mt-3 flex items-center justify-center gap-1.5 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                <p className="text-xs text-gray-500">
                  Checking every few seconds... You&apos;ll join automatically — no need to refresh.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={!canJoin || joining || isEnded || waitingForTeacher}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2',
              waitingForTeacher
                ? 'bg-blue-900 text-blue-300 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500'
            )}
          >
            {waitingForTeacher ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for teacher...
              </>
            ) : joining ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : isEnded ? (
              'Class Ended'
            ) : !canJoin && mounted ? (
              <>
                <Timer className="h-4 w-4" />
                {msUntilStart > 86400000
                  ? `Class starts on ${fmtDateShortIST(startDate)}`
                  : `Opens in ${fmtCountdown(msUntilLobby)}`}
              </>
            ) : !canJoin ? (
              'Lobby Not Open Yet'
            ) : (
              <>
                <Video className="h-4 w-4" />
                {isLive ? 'Join Live Class' : 'Enter Lobby'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
