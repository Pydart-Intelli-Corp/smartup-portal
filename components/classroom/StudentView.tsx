'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useParticipants,
  VideoTrack,
  AudioTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
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
 * StudentView — YouTube-fullscreen-style immersive classroom.
 *
 * The whiteboard / teacher video fills the ENTIRE screen.
 * All UI — header info, controls, PIPs, chat — float as overlays
 * that auto-hide after 3 seconds of inactivity.
 * Tap / move mouse anywhere to reveal overlays.
 *
 * Features:
 *   - Browser Fullscreen API on entry (with fallback)
 *   - 100% viewport content — no layout chrome
 *   - Overlay header: room name + LIVE badge + countdown + participants
 *   - Overlay controls: Google Meet-style bottom bar
 *   - Floating teacher PIP + self-cam PIP (fade with overlays)
 *   - Chat slides from right (keeps overlays visible while open)
 *   - CSS landscape rotation for mobile portrait
 *   - Cross-browser: Chrome, Safari, Firefox, Edge, mobile, desktop
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

// ─── helpers ──────────────────────────────────────────────
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

function fmtCountdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── constants ────────────────────────────────────────────
const HIDE_DELAY = 3500;          // ms before overlays auto-hide
const WARNING_THRESHOLD = 5 * 60; // 5 min warning

// ─── component ────────────────────────────────────────────
export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  onLeave,
  onTimeExpired,
}: StudentViewProps) {
  // ── overlay visibility ──
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── timer state ──
  const [now, setNow] = useState(Date.now());
  const expiredFired = useRef(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // ── orientation / device ──
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // ── detect mobile ──
  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(touch && ua);
  }, []);

  // ── detect portrait ──
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

  // ── try orientation lock (mobile) ──
  useEffect(() => {
    if (!isMobile) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { try { (screen.orientation as any)?.unlock?.(); } catch {} };
  }, [isMobile]);

  // ── keyboard height (CSS-rotated mode) ──
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const fn = () => { const d = window.innerHeight - vv.height; setKbHeight(d > 50 ? d : 0); };
    vv.addEventListener('resize', fn);
    return () => vv.removeEventListener('resize', fn);
  }, []);

  // ── request browser fullscreen on mount ──
  useEffect(() => {
    const el = document.documentElement;
    const tryFs = async () => {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
      } catch { /* user gesture required or not supported — graceful fallback */ }
    };
    // Delay slightly so the page is rendered before requesting
    const t = setTimeout(tryFs, 300);
    return () => clearTimeout(t);
  }, []);

  // ── tick every second for countdown timer ──
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // compute end time, remaining, warning, expired
  const endTime = useMemo(() => {
    if (!scheduledStart) return null;
    const s = new Date(scheduledStart).getTime();
    return isNaN(s) ? null : s + durationMinutes * 60_000;
  }, [scheduledStart, durationMinutes]);

  const remaining = endTime ? Math.max(0, Math.floor((endTime - now) / 1000)) : null;
  const isExpired = remaining === 0;
  const isWarning = remaining !== null && remaining > 0 && remaining <= WARNING_THRESHOLD;

  // fire onTimeExpired once
  useEffect(() => {
    if (isExpired && !expiredFired.current && onTimeExpired) {
      expiredFired.current = true;
      onTimeExpired();
    }
  }, [isExpired, onTimeExpired]);

  // ── overlay auto-hide logic ──
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    // don't auto-hide while chat or dialog is open
    if (!chatOpen && !showLeaveDialog) {
      hideRef.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY);
    }
  }, [chatOpen, showLeaveDialog]);

  // keep overlays visible while chat/dialog is open
  useEffect(() => {
    if (chatOpen || showLeaveDialog) {
      setOverlayVisible(true);
      if (hideRef.current) clearTimeout(hideRef.current);
    } else {
      // restart auto-hide
      showOverlay();
    }
  }, [chatOpen, showLeaveDialog, showOverlay]);

  // initial show
  useEffect(() => {
    showOverlay();
    return () => { if (hideRef.current) clearTimeout(hideRef.current); };
  }, [showOverlay]);

  // ── participants ──
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const allParticipants = useParticipants();

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

  // ── local media ──
  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;

  const toggleMic = async () => { try { await localParticipant.setMicrophoneEnabled(!isMicOn); } catch {} };
  const toggleCam = async () => { try { await localParticipant.setCameraEnabled(!isCamOn); } catch {} };

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

  // ── CSS rotation for mobile portrait ──
  const forceRotate = hasScreenShare && isPortrait && isMobile;

  const wrapStyle: React.CSSProperties = forceRotate
    ? {
        position: 'fixed', top: 0, left: 0,
        width: `calc(100vh - ${kbHeight}px)`, height: '100vw',
        transform: 'rotate(90deg)', transformOrigin: 'top left',
        marginLeft: '100vw', overflow: 'hidden',
      }
    : { position: 'fixed', inset: 0 };

  const show = overlayVisible;       // shorthand
  const compact = forceRotate;        // smaller elements when rotated

  // ─────── RENDER ─────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="bg-black text-white select-none"
      style={wrapStyle}
      onPointerDown={showOverlay}
      onPointerMove={showOverlay}
    >
      {/* === LAYER 0 — Full-screen content (always visible) === */}
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
              showName={false}
              showMicIndicator={false}
              playAudio={true}
              className="h-full w-full !border-0 !rounded-none"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#202124]">
            <div className="text-center px-8">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-[#e8eaed]">
                {teacher ? 'Class in progress' : 'Waiting for teacher\u2026'}
              </h2>
              <p className="mt-2 text-sm text-[#9aa0a6]">
                {teacher
                  ? `${teacher.name || teacher.identity} \u2014 audio only`
                  : 'The class will begin when the teacher starts sharing'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Teacher audio — always on */}
      {teacher?.getTrackPublication(Track.Source.Microphone)?.track && (
        <AudioTrack
          trackRef={{ participant: teacher, publication: teacher.getTrackPublication(Track.Source.Microphone)!, source: Track.Source.Microphone } as TrackReference}
        />
      )}

      {/* === LAYER 1 — Warning / expired banner (always visible) === */}
      {isWarning && !warningDismissed && (
        <div className="absolute top-0 inset-x-0 z-[60] flex items-center justify-center gap-3 bg-[#f9ab00] px-4 py-1.5">
          <span className="text-xs font-bold text-[#202124]">
            {'\u26A0'} Class ends in {Math.ceil((remaining ?? 0) / 60)} min
          </span>
          <button onClick={() => setWarningDismissed(true)} className="rounded bg-black/15 px-2 py-0.5 text-[10px] font-medium text-[#202124] hover:bg-black/25">
            Dismiss
          </button>
        </div>
      )}
      {isExpired && (
        <div className="absolute top-0 inset-x-0 z-[60] flex items-center justify-center bg-[#ea4335] px-4 py-1.5 animate-pulse">
          <span className="text-xs font-bold text-white">{'\u23F0'} Class ended — disconnecting\u2026</span>
        </div>
      )}

      {/* === LAYER 2 — Overlay UI (auto-hide) === */}

      {/* -- Top overlay: gradient + info bar -- */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-50 transition-all duration-500 ease-out',
          show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none',
        )}
      >
        <div className={cn(
          'flex items-center justify-between bg-gradient-to-b from-black/70 via-black/40 to-transparent',
          compact ? 'px-3 pt-2 pb-8' : 'px-4 pt-3 pb-10',
        )}>
          {/* Left: room name + live */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className={cn('truncate font-medium text-white/95 drop-shadow-sm', compact ? 'text-xs' : 'text-sm')}>
              {roomName}
            </span>
          </div>

          {/* Right: countdown + participants */}
          <div className="flex items-center gap-3">
            {remaining !== null && (
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 font-mono font-semibold drop-shadow-sm',
                  compact ? 'text-xs' : 'text-sm',
                  isExpired ? 'bg-red-600/30 text-red-300' : isWarning ? 'bg-amber-500/20 text-amber-300' : 'text-white/90',
                )}
              >
                {fmtCountdown(remaining)}
              </span>
            )}
            <span className={cn('text-white/60', compact ? 'text-[10px]' : 'text-xs')}>
              {'\uD83D\uDC65'} {allParticipants.length}
            </span>
          </div>
        </div>
      </div>

      {/* -- Teacher camera PIP (overlay, fades with controls) -- */}
      {hasScreenShare && hasTeacherCam && teacher && teacherCamPub && (
        <div
          className={cn(
            'absolute z-40 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 transition-all duration-500',
            show ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
            compact ? 'top-2 right-2 w-[100px] h-[68px]' : 'top-14 right-3 w-[160px] h-[100px] sm:w-[200px] sm:h-[126px]',
          )}
        >
          <VideoTrack
            trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-0.5">
            <span className="text-[10px] font-medium text-white/90 drop-shadow-sm">
              {teacher.name || teacher.identity}
            </span>
          </div>
        </div>
      )}

      {/* -- Self-cam PIP (overlay, fades with controls) -- */}
      {isCamOn && (
        <div
          className={cn(
            'absolute z-40 overflow-hidden rounded-xl ring-1 ring-white/10 shadow-lg transition-all duration-500',
            show ? 'opacity-100 scale-100' : 'opacity-40 scale-95',
            compact ? 'bottom-14 left-2 w-12 h-12' : 'bottom-24 left-3 w-[88px] h-[88px] sm:w-[100px] sm:h-[100px]',
          )}
        >
          <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
            <VideoTile participant={localParticipant} size="small" mirror={false} showName={false} showMicIndicator={false} className="!w-full !h-full !rounded-none !border-0" />
          </div>
        </div>
      )}

      {/* -- Hand raised badge (always visible) -- */}
      {handRaised && (
        <div className={cn(
          'absolute z-40 flex items-center gap-2 rounded-full bg-[#f9ab00] px-3 py-1.5 shadow-lg',
          compact ? 'bottom-14 right-2' : 'bottom-24 right-3',
        )}>
          <span className="text-sm">{'\uD83D\uDD90'}</span>
          <span className="text-[11px] font-bold text-[#202124]">Hand raised</span>
        </div>
      )}

      {/* -- Bottom overlay: gradient + controls -- */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-50 transition-all duration-500 ease-out',
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={cn(
          'flex items-center justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent',
          compact ? 'gap-2.5 px-3 pt-8 pb-2.5' : 'gap-3 px-5 pt-10 pb-4',
        )}>
          {/* Mic */}
          <OvBtn on={isMicOn} onClick={toggleMic} title={isMicOn ? 'Mute' : 'Unmute'}
            onIcon={<MicOnIcon className="w-5 h-5" />} offIcon={<MicOffIcon className="w-5 h-5" />}
            offDanger compact={compact} />
          {/* Camera */}
          <OvBtn on={isCamOn} onClick={toggleCam} title={isCamOn ? 'Stop video' : 'Start video'}
            onIcon={<CameraOnIcon className="w-5 h-5" />} offIcon={<CameraOffIcon className="w-5 h-5" />}
            offDanger compact={compact} />

          <div className="h-7 w-px bg-white/15" />

          {/* Hand raise */}
          <OvBtn on={handRaised} onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}
            onIcon={<HandRaiseIcon className="w-5 h-5" />} offIcon={<HandRaiseIcon className="w-5 h-5" />}
            onWarn compact={compact} />
          {/* Chat */}
          <OvBtn on={chatOpen} onClick={() => { setChatOpen(!chatOpen); showOverlay(); }}
            title="Chat"
            onIcon={<ChatIcon className="w-5 h-5" />} offIcon={<ChatIcon className="w-5 h-5" />}
            onPrimary compact={compact} />

          <div className="h-7 w-px bg-white/15" />

          {/* Leave */}
          <button
            onClick={() => setShowLeaveDialog(true)}
            className={cn(
              'flex items-center gap-2 rounded-full bg-[#ea4335] font-medium text-white',
              'transition-all duration-150 hover:bg-[#c5221f] active:scale-95 shadow-lg shadow-red-900/30',
              compact ? 'h-10 px-4 text-xs' : 'h-12 px-5 text-sm',
            )}
          >
            <LeaveIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            <span className={compact ? 'hidden' : 'hidden sm:inline'}>Leave</span>
          </button>
        </div>
      </div>

      {/* === LAYER 3 — Panels & dialogs === */}

      {/* Chat backdrop */}
      {chatOpen && (
        <div className="absolute inset-0 z-[58] bg-black/30 sm:bg-transparent" onClick={() => setChatOpen(false)} />
      )}
      {/* Chat panel */}
      <div
        className={cn(
          'absolute top-0 bottom-0 right-0 z-[59] shadow-2xl',
          'transition-transform duration-300 ease-out',
          compact ? 'w-[260px]' : 'w-[300px] sm:w-[340px]',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <ChatPanel participantName={participantName} participantRole="student" onClose={() => setChatOpen(false)} />
      </div>

      {/* Leave dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLeaveDialog(false)}>
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/[0.06]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ea4335]/10">
              <LeaveIcon className="h-7 w-7 text-[#ea4335]" />
            </div>
            <h3 className="text-lg font-semibold text-[#e8eaed]">Leave this class?</h3>
            <p className="mt-1 text-sm text-[#9aa0a6]">You can rejoin while the class is active.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowLeaveDialog(false)} className="flex-1 rounded-full bg-[#3c4043] py-2.5 text-sm font-medium text-[#e8eaed] hover:bg-[#4a4d51]">Cancel</button>
              <button onClick={onLeave} className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white hover:bg-[#c5221f]">Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overlay round button ─────────────────────────────────
function OvBtn({ on, onClick, title, onIcon, offIcon, offDanger, onWarn, onPrimary, compact }: {
  on: boolean; onClick: () => void; title: string;
  onIcon: React.ReactNode; offIcon: React.ReactNode;
  offDanger?: boolean; onWarn?: boolean; onPrimary?: boolean; compact?: boolean;
}) {
  const sz = compact ? 'h-10 w-10' : 'h-12 w-12';
  let clr: string;
  if (on) {
    if (onWarn)    clr = 'bg-[#f9ab00] text-[#202124] hover:bg-[#e09c00]';
    else if (onPrimary) clr = 'bg-[#1a73e8] text-white hover:bg-[#1557b0]';
    else clr = 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  } else {
    clr = offDanger ? 'bg-[#ea4335] text-white hover:bg-[#c5221f]' : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  }
  return (
    <button onClick={onClick} title={title}
      className={cn('flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 shadow-lg', sz, clr)}>
      {on ? onIcon : offIcon}
    </button>
  );
}
