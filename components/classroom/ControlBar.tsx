'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { cn } from '@/lib/utils';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  ScreenShareIcon, ScreenShareOffIcon,
  WhiteboardIcon,
  HandRaiseIcon,
  ChatIcon,
  EndCallIcon,
  LeaveIcon,
} from './icons';

/**
 * ControlBar — classroom media controls (Google Meet style).
 * Teacher: mic, camera, screen share, whiteboard toggle, chat, end class.
 * Student: mic, camera, hand raise, chat toggle, leave.
 * Ghost: no controls (read-only observe).
 */

export interface ControlBarProps {
  role: 'teacher' | 'student' | 'ghost';
  roomId: string;
  whiteboardActive?: boolean;
  onToggleWhiteboard?: () => void;
  onToggleChat?: () => void;
  handRaised?: boolean;
  onToggleHandRaise?: () => void;
  onEndClass?: () => void;
  onLeave?: () => void;
  className?: string;
  scheduledStart?: string;
  durationMinutes?: number;
}

export default function ControlBar({
  role,
  roomId,
  whiteboardActive = false,
  onToggleWhiteboard,
  onToggleChat,
  handRaised = false,
  onToggleHandRaise,
  onEndClass,
  onLeave,
  className,
  scheduledStart,
  durationMinutes,
}: ControlBarProps) {
  const { localParticipant } = useLocalParticipant();
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState('');

  // ── Early end approval state ──
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [earlyEndReason, setEarlyEndReason] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forceEndTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (role === 'ghost') return null;

  // ── Determine if ending early ──
  const isBeforeScheduledEnd = useCallback(() => {
    if (!scheduledStart || !durationMinutes) return false;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return false;
    const endTime = start + durationMinutes * 60 * 1000;
    return Date.now() < endTime;
  }, [scheduledStart, durationMinutes]);

  // Poll for approval status
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (forceEndTimeout.current) clearTimeout(forceEndTimeout.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/end-request`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.data?.status;
        if (status === 'approved') {
          setApprovalStatus('approved');
          setApprovalPending(false);
          if (pollRef.current) clearInterval(pollRef.current);
          // Class was ended by coordinator approval — just navigate
          onEndClass?.();
        } else if (status === 'denied') {
          setApprovalStatus('denied');
          setApprovalPending(false);
          if (pollRef.current) clearInterval(pollRef.current);
          setEndError(data?.data?.reason || 'Coordinator denied your end-class request');
        }
      } catch {}
    }, 5000);
  }, [roomId, onEndClass]);

  const handleEndClass = async () => {
    setIsEnding(true);
    setEndError('');

    // If before scheduled end → request coordinator approval
    if (isBeforeScheduledEnd()) {
      try {
        const res = await fetch(`/api/v1/room/${roomId}/end-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: earlyEndReason }),
        });
        if (res.ok || res.status === 409) {
          // 409 = already pending
          setApprovalPending(true);
          setApprovalStatus('pending');
          startPolling();
          // Allow force-end after 3 minutes
          forceEndTimeout.current = setTimeout(() => {
            setApprovalPending(false);
            setApprovalStatus('none');
            setEndError('');
          }, 3 * 60 * 1000);
        } else {
          const data = await res.json().catch(() => null);
          setEndError(data?.error || 'Failed to request end-class approval');
        }
      } catch {
        setEndError('Network error — please try again');
      } finally {
        setIsEnding(false);
      }
      return;
    }

    // Time expired → end directly
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        onEndClass?.();
      } else {
        const data = await res.json().catch(() => null);
        setEndError(data?.error || 'Failed to end session — please try again');
      }
    } catch {
      setEndError('Network error — please try again');
    } finally {
      setIsEnding(false);
    }
  };

  // Force end — used after 3-min timeout or when teacher insists
  const handleForceEnd = async () => {
    setIsEnding(true);
    setEndError('');
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        onEndClass?.();
      } else {
        const data = await res.json().catch(() => null);
        setEndError(data?.error || 'Failed to end session');
      }
    } catch {
      setEndError('Network error');
    } finally {
      setIsEnding(false);
      setApprovalPending(false);
    }
  };

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenShareOn = localParticipant.isScreenShareEnabled;

  const toggleMic = async () => {
    try { await localParticipant.setMicrophoneEnabled(!isMicOn); }
    catch (err) { console.error('[ControlBar] Mic toggle failed:', err); }
  };

  const toggleCamera = async () => {
    try { await localParticipant.setCameraEnabled(!isCameraOn); }
    catch (err) { console.error('[ControlBar] Camera toggle failed:', err); }
  };

  const toggleScreenShare = async () => {
    try { await localParticipant.setScreenShareEnabled(!isScreenShareOn); }
    catch (err) { console.error('[ControlBar] Screen share toggle failed:', err); }
  };

  return (
    <div className={cn(
      'relative flex h-18 items-center justify-center gap-2 border-t border-[#3c4043]/50 bg-[#202124] px-6',
      className
    )}>
      {/* Microphone */}
      <MeetButton
        on={isMicOn}
        onClick={toggleMic}
        title={isMicOn ? 'Turn off microphone (Ctrl+D)' : 'Turn on microphone (Ctrl+D)'}
        onIcon={<MicOnIcon className="h-5 w-5" />}
        offIcon={<MicOffIcon className="h-5 w-5" />}
        offColor="bg-[#ea4335]"
      />

      {/* Camera */}
      <MeetButton
        on={isCameraOn}
        onClick={toggleCamera}
        title={isCameraOn ? 'Turn off camera (Ctrl+E)' : 'Turn on camera (Ctrl+E)'}
        onIcon={<CameraOnIcon className="h-5 w-5" />}
        offIcon={<CameraOffIcon className="h-5 w-5" />}
        offColor="bg-[#ea4335]"
      />

      {/* Divider */}
      <div className="mx-1 h-8 w-px bg-[#5f6368]/30" />

      {/* Student: Hand raise */}
      {role === 'student' && onToggleHandRaise && (
        <MeetButton
          on={handRaised}
          onClick={onToggleHandRaise}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          onIcon={<HandRaiseIcon className="h-5 w-5" />}
          offIcon={<HandRaiseIcon className="h-5 w-5" />}
          onColor="bg-[#fbbf24]"
          onTextColor="text-black"
        />
      )}

      {/* Chat */}
      {onToggleChat && (
        <MeetButton
          on={false}
          onClick={onToggleChat}
          title="Chat with everyone"
          onIcon={<ChatIcon className="h-5 w-5" />}
          offIcon={<ChatIcon className="h-5 w-5" />}
        />
      )}

      {/* Divider */}
      <div className="mx-1 h-8 w-px bg-[#5f6368]/30" />

      {/* Teacher: End Class */}
      {role === 'teacher' && (
        <button
          onClick={() => setShowEndConfirm(true)}
          title="End session for everyone"
          className="flex h-12 items-center gap-2 rounded-full bg-[#ea4335] px-5 text-sm font-medium text-white transition-all hover:bg-[#d33426] hover:shadow-lg hover:shadow-red-900/30 active:scale-95"
        >
          <EndCallIcon className="h-5 w-5" />
          <span className="hidden sm:inline">End</span>
        </button>
      )}

      {/* Student: Leave */}
      {role === 'student' && (
        <button
          onClick={() => setShowLeaveConfirm(true)}
          title="Leave session"
          className="flex h-12 items-center gap-2 rounded-full bg-[#ea4335] px-5 text-sm font-medium text-white transition-all hover:bg-[#d33426] hover:shadow-lg hover:shadow-red-900/30 active:scale-95"
        >
          <LeaveIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      )}

      {/* End class confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-90 rounded-2xl bg-[#2d2e30] p-6 text-center shadow-2xl ring-1 ring-white/10">
            {/* Approval pending state */}
            {approvalPending ? (
              <>
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#5f6368] border-t-[#8ab4f8]" />
                <h3 className="mb-2 text-lg font-semibold text-white">Waiting for Coordinator Approval</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Your request to end the session early has been sent to the batch coordinator.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowEndConfirm(false); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            ) : approvalStatus === 'denied' ? (
              <>
                <h3 className="mb-2 text-lg font-semibold text-[#ea4335]">Request Denied</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  The coordinator denied your early end request.
                </p>
                {endError && <p className="mb-3 text-sm text-red-400">{endError}</p>}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowEndConfirm(false); setEndError(''); setApprovalStatus('none'); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={handleForceEnd}
                    disabled={isEnding}
                    className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] disabled:opacity-50 transition-colors"
                  >
                    {isEnding ? 'Ending...' : 'Force End'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {isBeforeScheduledEnd() ? 'End session early?' : 'End session for everyone?'}
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  {isBeforeScheduledEnd()
                    ? 'The scheduled session time has not ended yet. This will require coordinator approval.'
                    : 'This will disconnect all students.'}
                </p>
                {isBeforeScheduledEnd() && (
                  <input
                    type="text"
                    value={earlyEndReason}
                    onChange={(e) => setEarlyEndReason(e.target.value)}
                    placeholder="Reason for ending early (optional)"
                    className="mb-3 w-full rounded-lg bg-[#3c4043] px-3 py-2 text-sm text-white placeholder-[#9aa0a6] outline-none ring-1 ring-white/5 focus:ring-[#8ab4f8]/50"
                  />
                )}
                {endError && <p className="mb-3 text-sm text-red-400">{endError}</p>}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowEndConfirm(false); setEndError(''); }}
                    className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndClass}
                    disabled={isEnding}
                    className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] disabled:opacity-50 transition-colors"
                  >
                    {isEnding ? (isBeforeScheduledEnd() ? 'Requesting...' : 'Ending...') : (isBeforeScheduledEnd() ? 'Request End' : 'End Session')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl bg-[#2d2e30] p-6 text-center shadow-2xl ring-1 ring-white/10">
            <h3 className="mb-2 text-lg font-semibold text-white">Leave this session?</h3>
            <p className="mb-4 text-sm text-muted-foreground">You can rejoin while the session is active.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-full bg-[#3c4043] px-5 py-2 text-sm text-white hover:bg-[#4a4d51] transition-colors"
              >
                Stay
              </button>
              <button
                onClick={onLeave}
                className="rounded-full bg-[#ea4335] px-5 py-2 text-sm font-medium text-white hover:bg-[#d33426] transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Google Meet-style circular button ────────────────────────
function MeetButton({
  on,
  onClick,
  title,
  onIcon,
  offIcon,
  onColor = 'bg-[#3c4043]',
  offColor = 'bg-[#3c4043]',
  onTextColor = 'text-white',
  offTextColor = 'text-white',
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  onColor?: string;
  offColor?: string;
  onTextColor?: string;
  offTextColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150 active:scale-90',
        on ? `${onColor} ${onTextColor}` : `${offColor} ${offTextColor}`,
        on ? 'hover:bg-[#4a4d51]' : (offColor === 'bg-[#ea4335]' ? 'hover:bg-[#d33426]' : 'hover:bg-[#4a4d51]'),
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
