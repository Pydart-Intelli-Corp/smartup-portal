'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useParticipants,
  useTracks,
  useDataChannel,
  VideoTrack,
  AudioTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, VideoQuality, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import VideoTile from './VideoTile';
import VideoQualitySelector, { type VideoQualityOption, QUALITY_MAP } from './VideoQualitySelector';
import WhiteboardComposite from './WhiteboardComposite';
import { cn } from '@/lib/utils';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  HandRaiseIcon,
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

import { sfxHandRaise, sfxHandLower, sfxParticipantJoin, sfxParticipantLeave, sfxWarning, sfxExpired, sfxMediaControl, hapticTap, hapticToggle } from '@/lib/sounds';

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
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [teacherPopup, setTeacherPopup] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('auto');
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

  // ── orientation lock helper (works only in fullscreen on most browsers) ──
  const lockLandscape = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any)?.lock?.('landscape');
    } catch {}
  }, []);

  const unlockOrientation = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (screen.orientation as any)?.unlock?.(); } catch {}
  }, []);

  // ── keyboard height (CSS-rotated mode) ──
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const fn = () => { const d = window.innerHeight - vv.height; setKbHeight(d > 50 ? d : 0); };
    vv.addEventListener('resize', fn);
    return () => vv.removeEventListener('resize', fn);
  }, []);

  // ── fullscreen state & toggle ──
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
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
    // don't auto-hide while dialog is open
    if (!showLeaveDialog) {
      hideRef.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY);
    }
  }, [showLeaveDialog]);

  // ── fullscreen toggle (must be after showOverlay) ──
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
        // After entering fullscreen, lock to landscape (requires fullscreen to be active)
        if (isMobile) await lockLandscape();
      } else {
        // Unlock orientation before exiting fullscreen
        if (isMobile) unlockOrientation();
        if (document.exitFullscreen) await document.exitFullscreen();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      }
    } catch {}
    showOverlay();
  }, [showOverlay, isMobile, lockLandscape, unlockOrientation]);

  // keep overlays visible while dialog is open
  useEffect(() => {
    if (showLeaveDialog) {
      setOverlayVisible(true);
      if (hideRef.current) clearTimeout(hideRef.current);
    } else {
      // restart auto-hide
      showOverlay();
    }
  }, [showLeaveDialog, showOverlay]);

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

  // ── useTracks for reactive track detection ──
  // This properly subscribes to track publish/subscribe/mute events
  const remoteTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.ScreenShareAudio],
    { onlySubscribed: false },
  );

  const hasScreenShare = useMemo(() => {
    return remoteTracks.some((t) => {
      if (t.source !== Track.Source.ScreenShare) return false;
      const p = t.participant as RemoteParticipant;
      return isTeacherPrimary(p) || isTeacherScreen(p);
    });
  }, [remoteTracks]);

  const hasTeacherCam = useMemo(() => {
    if (!teacher) return false;
    return remoteTracks.some(
      (t) => t.source === Track.Source.Camera && t.participant.identity === teacher.identity,
    );
  }, [remoteTracks, teacher]);

  const teacherCamPub = useMemo(() => {
    if (!teacher) return null;
    const tr = remoteTracks.find(
      (t) => t.source === Track.Source.Camera && t.participant.identity === teacher.identity,
    );
    if (!tr) return null;
    const p = tr.publication as RemoteTrackPublication | undefined;
    return p && p.track ? p : null;
  }, [remoteTracks, teacher]);

  // ── Apply video quality to teacher's remote tracks ──
  // Uses setVideoQuality() to directly select simulcast layer (LOW/MEDIUM/HIGH).
  // This is NOT overridden by adaptive stream, unlike setVideoDimensions().
  useEffect(() => {
    if (!teacher) return;
    const quality = QUALITY_MAP[videoQuality];
    // Apply to camera track
    const camPub = teacher.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
    if (camPub) {
      camPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
    // Apply to screen share track (if any)
    const screenPub = teacher.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
    if (screenPub) {
      screenPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
  }, [teacher, videoQuality]);

  // Also apply quality to screen device (separate participant for tablet)
  useEffect(() => {
    if (!screenDevice) return;
    const quality = QUALITY_MAP[videoQuality];
    const screenPub = screenDevice.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;
    if (screenPub) {
      screenPub.setVideoQuality(quality ?? VideoQuality.HIGH);
    }
  }, [screenDevice, videoQuality]);

  // ── local media ──
  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCamOn = localParticipant.isCameraEnabled;

  // Auto-enable mic + camera on mount
  const autoEnabled = useRef(false);
  useEffect(() => {
    if (autoEnabled.current) return;
    autoEnabled.current = true;
    const enable = async () => {
      try { await localParticipant.setMicrophoneEnabled(true); } catch {}
      try { await localParticipant.setCameraEnabled(true); } catch {}
    };
    // Small delay to ensure connection is established
    setTimeout(enable, 500);
  }, [localParticipant]);

  // ── Toast for media toggle attempts ──
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Media approval request system ──
  // Student sends request → teacher approves/denies → media_control response toggles device
  const [micRequestPending, setMicRequestPending] = useState(false);
  const [camRequestPending, setCamRequestPending] = useState(false);

  // Listen for media_control responses from teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; type: 'mic' | 'camera'; enabled: boolean };
      if (data.target_id !== 'all' && data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.type === 'mic') {
        setMicRequestPending(false);
        localParticipant.setMicrophoneEnabled(data.enabled).catch(() => {});
        showToast(data.enabled ? 'Microphone turned on' : 'Teacher approved — mic turned off');
      } else if (data.type === 'camera') {
        setCamRequestPending(false);
        localParticipant.setCameraEnabled(data.enabled).catch(() => {});
        showToast(data.enabled ? 'Camera turned on' : 'Teacher approved — camera turned off');
      }
    } catch {}
  }, [localParticipant, showToast]);

  const { message: mediaCtrlMsg } = useDataChannel('media_control', onMediaControl);
  useEffect(() => { if (mediaCtrlMsg) onMediaControl(mediaCtrlMsg); }, [mediaCtrlMsg, onMediaControl]);

  // Request mic toggle — sends to teacher for approval
  const requestToggleMic = useCallback(async () => {
    hapticTap();
    if (micRequestPending) return;
    setMicRequestPending(true);
    showToast('Waiting for teacher approval…');
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
          type: 'mic',
          desired: !isMicOn,
        })),
        { topic: 'media_request', reliable: true },
      );
    } catch {}
    setTimeout(() => setMicRequestPending(false), 15000);
  }, [isMicOn, micRequestPending, localParticipant, showToast]);

  // Request camera toggle — sends to teacher for approval
  const requestToggleCam = useCallback(async () => {
    hapticTap();
    if (camRequestPending) return;
    setCamRequestPending(true);
    showToast('Waiting for teacher approval…');
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
          type: 'camera',
          desired: !isCamOn,
        })),
        { topic: 'media_request', reliable: true },
      );
    } catch {}
    setTimeout(() => setCamRequestPending(false), 15000);
  }, [isCamOn, camRequestPending, localParticipant, showToast]);

  // ── Participant join/leave sound ──
  const prevRemoteIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(remotes.map((p) => p.identity));
    if (prevRemoteIds.current.size > 0) {
      for (const id of currentIds) {
        if (!prevRemoteIds.current.has(id)) { sfxParticipantJoin(); break; }
      }
      for (const id of prevRemoteIds.current) {
        if (!currentIds.has(id)) { sfxParticipantLeave(); break; }
      }
    }
    prevRemoteIds.current = currentIds;
  }, [remotes]);

  // ── Warning / expired sound (fire once each) ──
  const warningSounded = useRef(false);
  const expiredSounded = useRef(false);
  useEffect(() => {
    if (isWarning && !warningSounded.current) { warningSounded.current = true; sfxWarning(); }
  }, [isWarning]);
  useEffect(() => {
    if (isExpired && !expiredSounded.current) { expiredSounded.current = true; sfxExpired(); }
  }, [isExpired]);

  const toggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    // Sound + haptic
    if (next) sfxHandRaise(); else sfxHandLower();
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
          /* ── Split layout: Whiteboard LEFT, cameras RIGHT ── */
          <div className="flex h-full w-full">
            {/* Whiteboard — takes most of the space */}
            <div className={cn('h-full overflow-hidden', compact ? 'flex-1' : 'flex-[3]')}>
              <WhiteboardComposite
                teacher={teacher}
                teacherScreenDevice={screenDevice}
                hideOverlay={true}
                className="h-full w-full"
              />
            </div>
            {/* Camera strip — right side */}
            <div className={cn(
              'flex flex-col gap-1.5 bg-[#181818] overflow-hidden',
              compact ? 'w-[90px] p-1' : 'flex-1 max-w-[280px] p-2',
            )}>
              {/* Teacher camera */}
              {hasTeacherCam && teacherCamPub ? (
                <div
                  className={cn(
                    'relative flex-1 min-h-0 overflow-hidden rounded-xl ring-1 ring-white/10 cursor-pointer transition-all hover:ring-[#1a73e8]/60',
                    compact && 'rounded-lg',
                  )}
                  onClick={() => setTeacherPopup(true)}
                >
                  <VideoTrack
                    trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                    <span className={cn('font-medium text-white/90 drop-shadow-sm', compact ? 'text-[8px]' : 'text-[11px]')}>
                      {teacher.name || teacher.identity}
                    </span>
                  </div>
                  {/* Expand hint icon */}
                  {!compact && (
                    <div className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                        <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl bg-[#202124] ring-1 ring-white/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f6368] text-sm font-semibold text-white">
                    {(teacher?.name || teacher?.identity || 'T').charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              {/* Self camera */}
              <div className={cn(
                'relative overflow-hidden rounded-xl ring-1 ring-white/10',
                compact ? 'h-[60px] rounded-lg' : 'flex-1 min-h-0',
              )}>
                {isCamOn ? (
                  <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
                    <VideoTile participant={localParticipant} size="large" mirror={false} showName={false} showMicIndicator={false} className="!w-full !h-full !rounded-none !border-0" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#202124]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f6368] text-sm font-semibold text-white">
                      {(participantName || 'S').charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                  <span className={cn('font-medium text-white/90 drop-shadow-sm', compact ? 'text-[8px]' : 'text-[11px]')}>
                    You {!isMicOn && '\uD83D\uDD07'}
                  </span>
                </div>
              </div>
            </div>
          </div>
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

      {/* === TOAST — media toggle notification === */}
      {toast && (
        <div className="absolute top-12 inset-x-0 z-[70] flex justify-center pointer-events-none">
          <div className="rounded-full bg-[#2d2e30]/95 px-5 py-2 shadow-lg ring-1 ring-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-medium text-[#f9ab00]">{toast}</span>
          </div>
        </div>
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

      {/* -- Teacher camera PIP (only when NO screen share — replaced by right panel when WB is active) -- */}
      {!hasScreenShare && hasTeacherCam && teacher && teacherCamPub && (
        <div
          className={cn(
            'absolute z-40 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 transition-all duration-500 cursor-pointer',
            show ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
            compact ? 'top-2 right-2 w-[100px] h-[68px]' : 'top-14 right-3 w-[160px] h-[100px] sm:w-[200px] sm:h-[126px]',
          )}
          onClick={() => setTeacherPopup(true)}
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

      {/* -- Self-cam PIP (only when NO screen share — in split mode self-cam is in right panel) -- */}
      {!hasScreenShare && isCamOn && (
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
          {/* Mic — request teacher approval to toggle */}
          <OvBtn on={isMicOn} onClick={requestToggleMic}
            title={micRequestPending ? 'Waiting for approval…' : isMicOn ? 'Request mute' : 'Request unmute'}
            onIcon={<MicOnIcon className="w-5 h-5" />} offIcon={<MicOffIcon className="w-5 h-5" />}
            offDanger compact={compact} pending={micRequestPending} />
          {/* Camera — request teacher approval to toggle */}
          <OvBtn on={isCamOn} onClick={requestToggleCam}
            title={camRequestPending ? 'Waiting for approval…' : isCamOn ? 'Request camera off' : 'Request camera on'}
            onIcon={<CameraOnIcon className="w-5 h-5" />} offIcon={<CameraOffIcon className="w-5 h-5" />}
            offDanger compact={compact} pending={camRequestPending} />

          <div className="h-7 w-px bg-white/15" />

          {/* Hand raise */}
          <OvBtn on={handRaised} onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}
            onIcon={<HandRaiseIcon className="w-5 h-5" />} offIcon={<HandRaiseIcon className="w-5 h-5" />}
            onWarn compact={compact} />
          {/* Fullscreen */}
          <OvBtn on={isFullscreen} onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onIcon={<FullscreenExitIcon className="w-5 h-5" />}
            offIcon={<FullscreenIcon className="w-5 h-5" />}
            compact={compact} />
          {/* Video quality */}
          <VideoQualitySelector
            quality={videoQuality}
            onChange={setVideoQuality}
            compact={compact}
            variant="overlay"
          />

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

      {/* Teacher camera enlarged popup */}
      {teacherPopup && teacher && teacherCamPub && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setTeacherPopup(false)}
        >
          <div
            className="relative w-[90vw] max-w-[800px] aspect-video overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoTrack
              trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
              <span className="text-sm font-medium text-white drop-shadow-sm">
                {teacher.name || teacher.identity}
              </span>
            </div>
            {/* Close button */}
            <button
              onClick={() => setTeacherPopup(false)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen icons ─────────────────────────────────────
function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FullscreenExitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

// ─── Overlay round button ─────────────────────────────────
function OvBtn({ on, onClick, title, onIcon, offIcon, offDanger, onWarn, onPrimary, compact, pending }: {
  on: boolean; onClick: () => void; title: string;
  onIcon: React.ReactNode; offIcon: React.ReactNode;
  offDanger?: boolean; onWarn?: boolean; onPrimary?: boolean; compact?: boolean; pending?: boolean;
}) {
  const sz = compact ? 'h-10 w-10' : 'h-12 w-12';
  let clr: string;
  if (pending) {
    clr = 'bg-[#f9ab00]/80 text-[#202124] hover:bg-[#e09c00] animate-pulse';
  } else if (on) {
    if (onWarn)    clr = 'bg-[#f9ab00] text-[#202124] hover:bg-[#e09c00]';
    else if (onPrimary) clr = 'bg-[#1a73e8] text-white hover:bg-[#1557b0]';
    else clr = 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  } else {
    clr = offDanger ? 'bg-[#ea4335] text-white hover:bg-[#c5221f]' : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md';
  }
  return (
    <button onClick={onClick} title={title}
      className={cn('relative flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 shadow-lg', sz, clr)}>
      {on ? onIcon : offIcon}
      {pending && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f9ab00] opacity-75" />
          <span className="inline-flex h-3 w-3 rounded-full bg-[#f9ab00]" />
        </span>
      )}
    </button>
  );
}
