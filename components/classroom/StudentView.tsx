'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  VideoTrack,
  AudioTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import HeaderBar from './HeaderBar';
import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import WhiteboardComposite from './WhiteboardComposite';
import { cn } from '@/lib/utils';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  HandRaiseIcon,
  ChatIcon,
  LeaveIcon,
} from './icons';

/**
 * StudentView — Google Meet-style student classroom.
 *
 * Professional layout:
 *   ┌──────────────────────────────────────────┐
 *   │  Header  (room name • timer • count)     │
 *   ├──────────────────────────────────────────┤
 *   │                                          │
 *   │   WHITEBOARD / TEACHER CAMERA            │
 *   │   (full area, object-fit contain)        │
 *   │                                  [T PIP] │
 *   │ [Self PIP]                               │
 *   │                                          │
 *   ├──────────────────────────────────────────┤
 *   │   🎤  📷  │  ✋  💬  │   Leave           │
 *   └──────────────────────────────────────────┘
 *
 * Features:
 *   - Bottom control bar (Google Meet style, centered pill buttons)
 *   - Floating teacher camera PIP when screen share is active
 *   - Self-cam PIP (mirrored, counter-rotated when CSS-rotated)
 *   - Chat panel slides from right
 *   - Auto-hide controls on mobile (tap to show, 4s auto-hide)
 *   - CSS landscape rotation fallback for mobile portrait + screen share
 *   - Safe area support for notched devices (iOS)
 *   - Cross-platform: mobile, tablet, desktop, all browsers
 */

export interface StudentViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart: string;
  durationMinutes: number;
  onLeave: () => void;
  onTimeExpired?: () => void;
}

// ─── Teacher detection helpers ────────────────────────────
function isTeacherPrimary(p: RemoteParticipant): boolean {
  try {
    const m = JSON.parse(p.metadata || '{}');
    return (m.effective_role || m.portal_role) === 'teacher' && m.device !== 'screen';
  } catch { return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen'); }
}

function isTeacherScreen(p: RemoteParticipant): boolean {
  try {
    const m = JSON.parse(p.metadata || '{}');
    return m.device === 'screen' && (m.portal_role === 'teacher' || m.effective_role === 'teacher_screen');
  } catch { return p.identity.endsWith('_screen') && p.identity.startsWith('teacher'); }
}

// ─── Component ────────────────────────────────────────────
export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  onLeave,
  onTimeExpired,
}: StudentViewProps) {
  // ── UI state ──
  const [chatOpen, setChatOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Device & orientation detection ──
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(touch && ua);
  }, []);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Try Screen Orientation API lock (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { try { (screen.orientation as any)?.unlock?.(); } catch {} };
  }, [isMobile]);

  // Virtual keyboard height detection (for CSS-rotated mode)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const fn = () => {
      const diff = window.innerHeight - vv.height;
      setKbHeight(diff > 50 ? diff : 0);
    };
    vv.addEventListener('resize', fn);
    return () => vv.removeEventListener('resize', fn);
  }, []);

  // ── LiveKit participants ──
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const teacher = useMemo(() => remotes.find(isTeacherPrimary) ?? null, [remotes]);
  const screenDevice = useMemo(() => remotes.find(isTeacherScreen) ?? null, [remotes]);

  const hasScreenShare = useMemo(() => {
    for (const src of [screenDevice, teacher]) {
      if (!src) continue;
      const pub = src.getTrackPublication(Track.Source.ScreenShare);
      if (pub && !pub.isMuted) return true;
    }
    return false;
  }, [teacher, screenDevice]);

  const hasTeacherCam = useMemo(() => {
    if (!teacher) return false;
    const p = teacher.getTrackPublication(Track.Source.Camera);
    return !!p && !p.isMuted;
  }, [teacher]);

  const teacherCamPub = useMemo(() => {
    if (!teacher) return null;
    const p = teacher.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
    return p && !p.isMuted && p.track ? p : null;
  }, [teacher]);

  // ── Local media state ──
  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;

  // ── Handlers ──
  const toggleMic = async () => {
    try { await localParticipant.setMicrophoneEnabled(!isMicOn); } catch {}
  };

  const toggleCam = async () => {
    try { await localParticipant.setCameraEnabled(!isCamOn); } catch {}
  };

  const toggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
          action: next ? 'raise' : 'lower',
        })),
        { topic: 'hand_raise', reliable: true },
      );
    } catch {}
  }, [handRaised, localParticipant]);

  // ── Controls auto-hide (mobile only) ──
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (isMobile) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [isMobile]);

  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls]);

  // ── Force CSS landscape rotation (mobile portrait + screen share) ──
  const forceRotate = hasScreenShare && isPortrait && isMobile;

  const wrapStyle: React.CSSProperties | undefined = forceRotate
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: `calc(100vh - ${kbHeight}px)`,
        height: '100vw',
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        marginLeft: '100vw',
        overflow: 'hidden',
      }
    : undefined;

  // ─── Render ─────────────────────────────────────────────
  return (
    <div
      className={cn('bg-[#202124] text-[#e8eaed] select-none overflow-hidden', !forceRotate && 'flex flex-col h-[100dvh]')}
      style={wrapStyle}
      onPointerDown={showControls}
    >
      {/* ── Header ──────────────────────────────────────── */}
      {!forceRotate && (
        <div
          className={cn(
            'relative z-40 transition-all duration-300 ease-out',
            controlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none',
          )}
        >
          <HeaderBar
            roomName={roomName}
            role="student"
            scheduledStart={scheduledStart}
            durationMinutes={durationMinutes}
            onTimeExpired={onTimeExpired}
          />
        </div>
      )}

      {/* Rotated mode: floating room badge */}
      {forceRotate && (
        <div className="absolute top-2 left-2 z-40 flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-3 py-1.5 ring-1 ring-white/[0.06]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-medium text-white/90">{roomName}</span>
        </div>
      )}

      {/* ── Main content area ───────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">

        {/* Whiteboard / Teacher camera / Waiting state */}
        <div className="absolute inset-0">
          {hasScreenShare && teacher ? (
            <WhiteboardComposite
              teacher={teacher}
              teacherScreenDevice={screenDevice}
              hideOverlay={true}
              className="h-full w-full"
            />
          ) : hasTeacherCam && teacher ? (
            <div className="flex h-full items-center justify-center bg-[#202124]">
              <VideoTile
                participant={teacher}
                size="large"
                showName={true}
                showMicIndicator={true}
                playAudio={true}
                className="h-full w-full"
              />
            </div>
          ) : (
            /* Waiting / audio-only state */
            <div className="flex h-full items-center justify-center bg-[#202124]">
              <div className="text-center px-8">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                  <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-[#e8eaed]">
                  {teacher ? 'Class in progress' : 'Waiting for teacher…'}
                </h2>
                <p className="mt-2 text-sm text-[#9aa0a6]">
                  {teacher
                    ? `${teacher.name || teacher.identity} — audio only`
                    : 'The class will begin when the teacher starts sharing'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Teacher audio (always active when teacher present) */}
        {teacher?.getTrackPublication(Track.Source.Microphone)?.track && (
          <AudioTrack
            trackRef={{
              participant: teacher,
              publication: teacher.getTrackPublication(Track.Source.Microphone)!,
              source: Track.Source.Microphone,
            } as TrackReference}
          />
        )}

        {/* Teacher camera PIP (visible when screen share is active) */}
        {hasScreenShare && hasTeacherCam && teacher && teacherCamPub && (
          <div
            className={cn(
              'absolute z-30 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/[0.08] transition-all duration-200 hover:ring-white/20',
              forceRotate
                ? 'top-2 right-2 w-[120px] h-[80px]'
                : 'top-16 right-3 w-[180px] h-[120px] sm:w-[220px] sm:h-[140px]',
            )}
          >
            <VideoTrack
              trackRef={{
                participant: teacher,
                publication: teacherCamPub,
                source: Track.Source.Camera,
              } as TrackReference}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
              <span className="text-[10px] font-medium text-white/90 drop-shadow-sm">
                {teacher.name || teacher.identity}
              </span>
            </div>
          </div>
        )}

        {/* Self-cam PIP */}
        {isCamOn && (
          <div
            className={cn(
              'absolute z-30 overflow-hidden rounded-xl ring-1 ring-white/[0.08] shadow-lg',
              forceRotate
                ? 'bottom-16 left-2 w-14 h-14'
                : 'bottom-[92px] left-3 w-[100px] h-[100px] sm:w-[120px] sm:h-[120px]',
            )}
          >
            <div
              className="h-full w-full"
              style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}
            >
              <VideoTile
                participant={localParticipant}
                size="small"
                mirror={false}
                showName={false}
                showMicIndicator={false}
                className="!w-full !h-full !rounded-none"
              />
            </div>
          </div>
        )}

        {/* Hand raised floating badge */}
        {handRaised && (
          <div
            className={cn(
              'absolute z-30 flex items-center gap-2 rounded-full bg-[#f9ab00] px-3.5 py-2 shadow-lg',
              forceRotate ? 'bottom-16 right-2' : 'bottom-[92px] right-3',
            )}
          >
            <span className="text-sm">🖐</span>
            <span className="text-xs font-bold text-[#202124]">Hand raised</span>
          </div>
        )}
      </div>

      {/* ── Bottom Control Bar ──────────────────────────── */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-40 transition-all duration-300 ease-out',
          controlsVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          className={cn(
            'flex items-center justify-center bg-gradient-to-t from-[#202124] via-[#202124]/95 to-transparent',
            forceRotate ? 'gap-2 px-3 pb-2 pt-6' : 'gap-3 px-4 pb-4 pt-8',
          )}
        >
          {/* Mic */}
          <RoundBtn
            on={isMicOn}
            onClick={toggleMic}
            title={isMicOn ? 'Mute' : 'Unmute'}
            onIcon={<MicOnIcon className="w-5 h-5" />}
            offIcon={<MicOffIcon className="w-5 h-5" />}
            offDanger
            compact={forceRotate}
          />
          {/* Camera */}
          <RoundBtn
            on={isCamOn}
            onClick={toggleCam}
            title={isCamOn ? 'Stop video' : 'Start video'}
            onIcon={<CameraOnIcon className="w-5 h-5" />}
            offIcon={<CameraOffIcon className="w-5 h-5" />}
            offDanger
            compact={forceRotate}
          />

          <BarSep />

          {/* Hand raise */}
          <RoundBtn
            on={handRaised}
            onClick={toggleHand}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
            onIcon={<HandRaiseIcon className="w-5 h-5" />}
            offIcon={<HandRaiseIcon className="w-5 h-5" />}
            onWarn
            compact={forceRotate}
          />
          {/* Chat */}
          <RoundBtn
            on={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat"
            onIcon={<ChatIcon className="w-5 h-5" />}
            offIcon={<ChatIcon className="w-5 h-5" />}
            onPrimary
            compact={forceRotate}
          />

          <BarSep />

          {/* Leave */}
          <button
            onClick={() => setShowLeaveDialog(true)}
            className={cn(
              'flex items-center gap-2 rounded-full bg-[#ea4335] font-medium text-white',
              'transition-all duration-150 hover:bg-[#c5221f] active:scale-95',
              forceRotate ? 'h-10 px-4 text-xs' : 'h-12 px-5 text-sm',
            )}
          >
            <LeaveIcon className={forceRotate ? 'w-4 h-4' : 'w-5 h-5'} />
            <span className={forceRotate ? 'hidden' : 'hidden sm:inline'}>Leave</span>
          </button>
        </div>
      </div>

      {/* ── Chat Panel (slides from right) ──────────────── */}
      {chatOpen && (
        <div
          className="absolute inset-0 z-[48] bg-black/40 sm:bg-transparent"
          onClick={() => setChatOpen(false)}
        />
      )}
      <div
        className={cn(
          'absolute top-0 bottom-0 right-0 z-[49] shadow-2xl',
          'transition-transform duration-300 ease-out',
          forceRotate ? 'w-[260px]' : 'w-[300px] sm:w-[340px]',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <ChatPanel
          participantName={participantName}
          participantRole="student"
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* ── Leave confirmation dialog ───────────────────── */}
      {showLeaveDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowLeaveDialog(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ea4335]/10">
              <LeaveIcon className="h-7 w-7 text-[#ea4335]" />
            </div>
            <h3 className="text-lg font-semibold text-[#e8eaed]">Leave this class?</h3>
            <p className="mt-1 text-sm text-[#9aa0a6]">You can rejoin while the class is active.</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLeaveDialog(false)}
                className="flex-1 rounded-full bg-[#3c4043] py-2.5 text-sm font-medium text-[#e8eaed] transition-colors hover:bg-[#4a4d51]"
              >
                Cancel
              </button>
              <button
                onClick={onLeave}
                className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#c5221f]"
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

// ─── Shared sub-components ────────────────────────────────

/** Vertical separator in the control bar */
function BarSep() {
  return <div className="h-8 w-px bg-[#5f6368]/30" />;
}

/** Google Meet-style circular toggle button */
function RoundBtn({
  on,
  onClick,
  title,
  onIcon,
  offIcon,
  offDanger,
  onWarn,
  onPrimary,
  compact,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  offDanger?: boolean;
  onWarn?: boolean;
  onPrimary?: boolean;
  compact?: boolean;
}) {
  const size = compact ? 'h-10 w-10' : 'h-12 w-12';

  let color: string;
  if (on) {
    if (onWarn) color = 'bg-[#f9ab00] text-[#202124] hover:bg-[#e09c00]';
    else if (onPrimary) color = 'bg-[#1a73e8] text-white hover:bg-[#1557b0]';
    else color = 'bg-[#3c4043] text-white hover:bg-[#4a4d51]';
  } else {
    color = offDanger
      ? 'bg-[#ea4335] text-white hover:bg-[#c5221f]'
      : 'bg-[#3c4043] text-white hover:bg-[#4a4d51]';
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-150 active:scale-90',
        size,
        color,
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
