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
import ChatPanel from './ChatPanel';
import StudentSidePanel from './StudentSidePanel';
import FeedbackDialog from './FeedbackDialog';
import TimeWarningDialog from './TimeWarningDialog';
import { cn } from '@/lib/utils';
import {
  MicOnIcon, MicOffIcon,
  CameraOnIcon, CameraOffIcon,
  HandRaiseIcon,
  HandRaisedIcon,
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
  isRejoin?: boolean;
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
import { useAttentionMonitor, ATTENTION_TOPIC, type AttentionMessage, type AttentionData, type MonitorConfig } from '@/hooks/useAttentionMonitor';

// ─── component ────────────────────────────────────────────
export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  isRejoin = false,
  onLeave,
  onTimeExpired,
}: StudentViewProps) {
  // ── overlay visibility ──
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveRequestPending, setLeaveRequestPending] = useState(false);
  const [leaveDenied, setLeaveDenied] = useState(false);
  const [teacherPopup, setTeacherPopup] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('auto');
  const [chatOpen, setChatOpen] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Rejoin gating ──
  const [rejoinBlocked, setRejoinBlocked] = useState(isRejoin);
  const [rejoinDenied, setRejoinDenied] = useState(false);
  const rejoinRequestSent = useRef(false);

  // ── Student feedback ──
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackShownRef = useRef(false);

  // ── 5-minute warning dialog ──
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const timeWarningShown = useRef(false);

  // ── attendance badge (computed once on mount) ──
  const joinedAt = useRef(new Date());
  const lateInfo = useMemo(() => {
    if (!scheduledStart) return null;
    const start = new Date(scheduledStart);
    const diff = Math.floor((joinedAt.current.getTime() - start.getTime()) / 1000);
    if (diff > 120) { // More than 2 minutes late
      const mins = Math.floor(diff / 60);
      return { late: true, minutes: mins };
    }
    return { late: false, minutes: 0 };
  }, [scheduledStart]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── timer state ──
  const [now, setNow] = useState(Date.now());
  const expiredFired = useRef(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // ── orientation / device ──
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [vpHeight, setVpHeight] = useState(0);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);

  // ── detect mobile & iOS & PWA standalone ──
  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const ua = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(touch && ua);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const standalone = (navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
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

  // ── viewport height tracking (for iOS dynamic toolbar) ──
  useEffect(() => {
    const update = () => setVpHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (vv) vv.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (vv) vv.removeEventListener('resize', update);
    };
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

  // ── Lock body scroll on mount (prevents iOS rubber-banding & pull-to-refresh) ──
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('classroom-active');
    // Prevent pinch-zoom on the document
    const preventPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchmove', preventPinch, { passive: false });
    return () => {
      html.classList.remove('classroom-active');
      html.classList.remove('classroom-fullscreen');
      document.removeEventListener('touchmove', preventPinch);
    };
  }, []);

  // ── Wake Lock — prevent screen from sleeping during class ──
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    // Re-acquire when tab becomes visible (browser releases on hide)
    const onVis = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    };
  }, []);

  // ── fullscreen state (native + pseudo for iOS) ──
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const effectiveFullscreen = isFullscreen || pseudoFs;

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
    // don't auto-hide while dialog or chat is open
    if (!showLeaveDialog && !chatOpen) {
      hideRef.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY);
    }
  }, [showLeaveDialog, chatOpen]);

  // ── fullscreen toggle (native → iOS pseudo-fullscreen fallback) ──
  const toggleFullscreen = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;

      if (!fsEl && !pseudoFs) {
        // ── ENTER fullscreen ──
        const el = document.documentElement;
        let nativeOk = false;
        // Try native Fullscreen API (Chrome, Android, Desktop)
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          nativeOk = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if ((el as any).webkitRequestFullscreen) {
          (el as any).webkitRequestFullscreen();
          nativeOk = true;
        }

        if (nativeOk) {
          if (isMobile) await lockLandscape();
        } else {
          // iOS Safari / non-supporting browsers — pseudo-fullscreen
          setPseudoFs(true);
          document.documentElement.classList.add('classroom-fullscreen');

          if (isIOS) {
            // Scroll trick: temporarily allow scrolling to trigger Safari toolbar collapse
            document.documentElement.classList.add('classroom-scroll-trick');
            await new Promise(r => setTimeout(r, 60));
            window.scrollTo({ top: 60, behavior: 'instant' as ScrollBehavior });
            await new Promise(r => setTimeout(r, 400));
            document.documentElement.classList.remove('classroom-scroll-trick');
            window.scrollTo(0, 0);

            // Show home-screen tip (only in Safari, not in PWA standalone)
            if (!isStandalone) {
              setShowIOSTip(true);
              setTimeout(() => setShowIOSTip(false), 8000);
            }
          } else {
            window.scrollTo(0, 1);
          }
        }
      } else {
        // ── EXIT fullscreen ──
        if (pseudoFs) {
          setPseudoFs(false);
          document.documentElement.classList.remove('classroom-fullscreen');
          setShowIOSTip(false);
        } else {
          if (isMobile) unlockOrientation();
          if (document.exitFullscreen) await document.exitFullscreen();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        }
      }
    } catch {}
    showOverlay();
  }, [showOverlay, isMobile, isIOS, isStandalone, pseudoFs, lockLandscape, unlockOrientation]);

  // keep overlays visible while dialog or chat is open
  useEffect(() => {
    if (showLeaveDialog || chatOpen) {
      setOverlayVisible(true);
      if (hideRef.current) clearTimeout(hideRef.current);
    } else {
      // restart auto-hide
      showOverlay();
    }
  }, [showLeaveDialog, chatOpen, showOverlay]);

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

  // ── AI Attention Monitoring (MediaPipe) ──
  // Get the student's local video element for face detection
  const [localVideoEl, setLocalVideoEl] = useState<HTMLVideoElement | null>(null);
  const selfVideoContainerRef = useRef<HTMLDivElement>(null);

  // Resolve the <video> element from the self-cam container
  useEffect(() => {
    if (!isCamOn) { setLocalVideoEl(null); return; }
    // Short delay to allow VideoTrack to mount
    const timer = setTimeout(() => {
      const container = selfVideoContainerRef.current;
      if (container) {
        const video = container.querySelector('video');
        if (video) setLocalVideoEl(video);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isCamOn]);

  // Monitor config — sends batched events to server every 30s
  const monitorConfig: MonitorConfig | undefined = useMemo(() => ({
    roomId: roomId,
  }), [roomId]);

  // Attention monitoring — broadcasts via data channel + sends to server API
  const { attentionScore: selfAttentionScore, isAttentive: selfIsAttentive } = useAttentionMonitor(
    localVideoEl,
    useCallback((data: AttentionData) => {
      // Broadcast attention data via LiveKit data channel for teacher view
      try {
        const msg: AttentionMessage = {
          type: 'attention_update',
          studentEmail: localParticipant.identity,
          studentName: localParticipant.name || localParticipant.identity,
          attentionScore: data.attentionScore,
          isAttentive: data.isAttentive,
          faceDetected: data.faceDetected,
          monitorState: data.monitorState,
          timestamp: Date.now(),
        };
        localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(msg)),
          { topic: ATTENTION_TOPIC, reliable: false },
        ).catch(() => {});
      } catch {}
    }, [localParticipant]),
    isCamOn,
    monitorConfig,
  );

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

  useDataChannel('media_control', onMediaControl);

  // ── Leave approval system ──
  // Student sends leave_request → teacher approves/denies → leave_control response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; approved: boolean };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.approved) {
        showToast('Teacher approved — please rate your session');
        setShowLeaveDialog(false);
        setLeaveRequestPending(false);
        if (!feedbackShownRef.current) {
          feedbackShownRef.current = true;
          setShowFeedback(true); // Show feedback dialog before leaving
        }
      } else {
        setLeaveRequestPending(false);
        setLeaveDenied(true);
        showToast('Teacher denied your leave request');
        setTimeout(() => setLeaveDenied(false), 4000);
      }
    } catch {}
  }, [localParticipant, showToast]);

  useDataChannel('leave_control', onLeaveControl);

  // ── Rejoin approval system ──
  // When student is rejoining (isRejoin=true), they are blocked until teacher approves.
  // Auto-sends rejoin_request on connect → teacher approve/deny → rejoin_control response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onRejoinControl = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { target_id: string; approved: boolean };
      if (data.target_id !== localParticipant.identity) return;
      sfxMediaControl();
      hapticToggle();
      if (data.approved) {
        setRejoinBlocked(false);
        setRejoinDenied(false);
        showToast('Teacher approved your rejoin');
      } else {
        setRejoinDenied(true);
        showToast('Teacher denied your rejoin request');
        setTimeout(() => onLeave(), 3000);
      }
    } catch {}
  }, [localParticipant, showToast, onLeave]);

  useDataChannel('rejoin_control', onRejoinControl);

  // Auto-send rejoin_request once connected
  useEffect(() => {
    if (!isRejoin || rejoinRequestSent.current) return;
    rejoinRequestSent.current = true;
    const sendRequest = async () => {
      try {
        // Small delay to ensure data channel is ready
        await new Promise((r) => setTimeout(r, 1500));
        await localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            student_id: localParticipant.identity,
            student_name: localParticipant.name || localParticipant.identity,
          })),
          { topic: 'rejoin_request', reliable: true },
        );
      } catch {}
    };
    sendRequest();
  }, [isRejoin, localParticipant, showToast]);

  const requestLeave = useCallback(async () => {
    hapticTap();
    if (leaveRequestPending) return;
    setLeaveRequestPending(true);
    setLeaveDenied(false);
    showToast('Waiting for teacher approval…');
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          student_id: localParticipant.identity,
          student_name: localParticipant.name || localParticipant.identity,
        })),
        { topic: 'leave_request', reliable: true },
      );
    } catch {}
    // Auto-cancel after 30 seconds if no response
    setTimeout(() => {
      setLeaveRequestPending((prev) => {
        if (prev) showToast('Leave request timed out — try again');
        return false;
      });
    }, 30000);
  }, [leaveRequestPending, localParticipant, showToast]);

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
    if (isWarning && !warningSounded.current) {
      warningSounded.current = true;
      sfxWarning();
      // Show the warning dialog once
      if (!timeWarningShown.current) {
        timeWarningShown.current = true;
        setShowTimeWarning(true);
      }
    }
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

  // Use computed viewport height for iOS (100vh lies when Safari toolbar is visible)
  const safeVpH = vpHeight > 0 ? `${vpHeight}px` : '100dvh';

  const wrapStyle: React.CSSProperties = forceRotate
    ? {
        position: 'fixed', top: 0, left: 0,
        width: vpHeight > 0 ? `${vpHeight - kbHeight}px` : `calc(100dvh - ${kbHeight}px)`,
        height: '100vw',
        transform: 'rotate(90deg)', transformOrigin: 'top left',
        marginLeft: '100vw', overflow: 'hidden',
      }
    : { position: 'fixed', inset: 0, height: safeVpH };

  const show = overlayVisible;       // shorthand
  const compact = forceRotate;        // smaller elements when rotated

  // ─────── RENDER ─────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="bg-black text-white select-none classroom-root"
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
            <div className={cn('h-full overflow-hidden', compact ? 'flex-1' : 'flex-3')}>
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
              compact ? 'w-22.5 p-1' : 'flex-1 max-w-70 p-2',
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
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1">
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
              {/* Self camera — monitored by AI attention tracker */}
              <div ref={selfVideoContainerRef} className={cn(
                'relative overflow-hidden rounded-xl ring-1 ring-white/10',
                compact ? 'h-15 rounded-lg' : 'flex-1 min-h-0',
              )}>
                {isCamOn ? (
                  <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
                    <VideoTile participant={localParticipant} size="large" mirror={false} showName={false} showMicIndicator={false} className="w-full! h-full! rounded-none! border-0!" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#202124]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f6368] text-sm font-semibold text-white">
                      {(participantName || 'S').charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                {/* Attention score indicator */}
                {isCamOn && selfAttentionScore < 60 && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-amber-500/80 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    {selfAttentionScore}%
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1">
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
              className="h-full w-full border-0! rounded-none!"
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
                {teacher ? 'Session in progress' : 'Waiting for teacher\u2026'}
              </h2>
              <p className="mt-2 text-sm text-[#9aa0a6]">
                {teacher
                  ? `${teacher.name || teacher.identity} \u2014 audio only`
                  : 'The session will begin when the teacher starts sharing'}
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

      {/* Other participants audio — only plays if their mic is enabled by teacher */}
      {remotes.filter(p => p !== teacher && !isTeacherScreen(p) && p.identity !== localParticipant.identity).map(p => {
        const micPub = p.getTrackPublication(Track.Source.Microphone);
        if (!micPub?.track || micPub.isMuted) return null;
        return (
          <AudioTrack
            key={p.identity}
            trackRef={{ participant: p, publication: micPub, source: Track.Source.Microphone } as TrackReference}
          />
        );
      })}

      {/* === TOAST — media toggle notification === */}
      {toast && (
        <div className="absolute top-12 inset-x-0 z-70 flex justify-center pointer-events-none">
          <div className="rounded-full bg-[#2d2e30]/95 px-5 py-2 shadow-lg ring-1 ring-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-medium text-[#f9ab00]">{toast}</span>
          </div>
        </div>
      )}

      {/* === LAYER 1 — Warning / expired banner (always visible) === */}
      {showTimeWarning && remaining !== null && (
        <TimeWarningDialog
          remainingSeconds={remaining}
          role="student"
          onDismiss={() => setShowTimeWarning(false)}
        />
      )}
      {isWarning && !warningDismissed && (
        <div className="absolute top-0 inset-x-0 z-60 flex items-center justify-center gap-3 bg-[#f9ab00] px-4 py-1.5">
          <span className="text-xs font-bold text-[#202124]">
            {'\u26A0'} Session ends in {Math.ceil((remaining ?? 0) / 60)} min
          </span>
          <button onClick={() => setWarningDismissed(true)} className="rounded bg-black/15 px-2 py-0.5 text-[10px] font-medium text-[#202124] hover:bg-black/25">
            Dismiss
          </button>
        </div>
      )}
      {isExpired && (
        <div className="absolute top-0 inset-x-0 z-60 flex items-center justify-center bg-[#ea4335] px-4 py-1.5 animate-pulse">
          <span className="text-xs font-bold text-white">{'\u23F0'} Session ended — disconnecting\u2026</span>
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
          'flex items-center justify-between bg-linear-to-b from-black/70 via-black/40 to-transparent',
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
            {/* Attendance badge */}
            {lateInfo && (
              <span className={cn(
                'rounded px-1.5 py-0.5 font-medium',
                compact ? 'text-[9px]' : 'text-[10px]',
                lateInfo.late ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300',
              )}>
                {lateInfo.late ? `⏰ Late ${lateInfo.minutes}m` : '✓ On Time'}
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
            compact ? 'top-2 right-2 w-25 h-17' : 'top-14 right-3 w-40 h-25 sm:w-50 sm:h-31.5',
          )}
          onClick={() => setTeacherPopup(true)}
        >
          <VideoTrack
            trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-2 py-0.5">
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
            compact ? 'bottom-14 left-2 w-12 h-12' : 'bottom-24 left-3 w-22 h-22 sm:w-25 sm:h-25',
          )}
        >
          <div className="h-full w-full" style={forceRotate ? { transform: 'rotate(-90deg) scaleX(-1)' } : { transform: 'scaleX(-1)' }}>
            <VideoTile participant={localParticipant} size="small" mirror={false} showName={false} showMicIndicator={false} className="w-full! h-full! rounded-none! border-0!" />
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
          'flex items-center justify-center bg-linear-to-t from-black/70 via-black/40 to-transparent',
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
            onIcon={<HandRaisedIcon className="w-5 h-5" />} offIcon={<HandRaiseIcon className="w-5 h-5" />}
            onWarn compact={compact} />
          {/* Chat */}
          <OvBtn on={chatOpen} onClick={() => setChatOpen(!chatOpen)} title={chatOpen ? 'Close chat' : 'Chat'}
            onIcon={<ChatIcon className="w-5 h-5" />} offIcon={<ChatIcon className="w-5 h-5" />}
            onPrimary compact={compact} />
          {/* Fullscreen */}
          <OvBtn on={effectiveFullscreen} onClick={toggleFullscreen}
            title={effectiveFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
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

      {/* iOS fullscreen tip — shown when pseudo-fullscreen is active in Safari */}
      {showIOSTip && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999]"
          style={{ animation: 'fadeInUp .3s ease-out' }}>
          <div className="bg-white/95 text-gray-800 rounded-2xl px-4 py-3 shadow-xl text-center max-w-[280px] backdrop-blur-sm">
            <p className="font-semibold text-xs mb-1">📱 Full Screen Tip</p>
            <p className="text-[11px] text-gray-500 leading-tight">
              Tap <span className="text-blue-500 font-medium">⬆ Share</span> → <span className="font-medium">&quot;Add to Home Screen&quot;</span> for true fullscreen
            </p>
            <button onClick={() => setShowIOSTip(false)}
              className="mt-2 text-[10px] text-blue-500 font-medium active:text-blue-700">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* === LAYER 3 — Panels & dialogs === */}

      {/* Chat/Attendance panel — slides from right */}
      <div
        className={cn(
          'fixed top-0 right-0 z-80 h-full w-80 max-w-[85vw] bg-[#202124] shadow-2xl ring-1 ring-white/8 transition-transform duration-300 ease-out',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <StudentSidePanel
          roomId={roomId}
          participantName={participantName}
          participantRole="student"
          onClose={() => setChatOpen(false)}
          className="h-full"
        />
      </div>

      {/* Student feedback dialog — shown after leave approval, before actual leave */}
      {showFeedback && (
        <FeedbackDialog
          roomId={roomId}
          studentEmail={localParticipant.identity}
          studentName={participantName}
          onComplete={() => {
            setShowFeedback(false);
            onLeave();
          }}
        />
      )}

      {/* Rejoin blocked overlay — shown when student is rejoining and awaiting teacher approval */}
      {rejoinBlocked && (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/6">
            {rejoinDenied ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ea4335]/10">
                  <svg className="h-7 w-7 text-[#ea4335]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Rejoin Denied</h3>
                <p className="mt-2 text-sm text-muted-foreground">Teacher denied your rejoin request. Leaving…</p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f9ab00]/10">
                  <svg className="h-7 w-7 text-[#f9ab00] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Waiting for Teacher Approval</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  You left the session earlier. Your rejoin request has been sent to the teacher.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Please wait…</p>
                <button
                  onClick={onLeave}
                  className="mt-6 rounded-xl bg-[#3c4043] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4a4e52]"
                >
                  Cancel & Leave
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leave dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { if (!leaveRequestPending) setShowLeaveDialog(false); }}>
          <div className="mx-4 w-full max-w-sm rounded-3xl bg-[#2d2e30] p-8 text-center shadow-2xl ring-1 ring-white/6" onClick={(e) => e.stopPropagation()}>
            <div className={cn('mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full', leaveRequestPending ? 'bg-[#f9ab00]/10' : leaveDenied ? 'bg-[#ea4335]/10' : 'bg-[#ea4335]/10')}>
              {leaveRequestPending ? (
                <svg className="h-7 w-7 text-[#f9ab00] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <LeaveIcon className={cn('h-7 w-7', leaveDenied ? 'text-[#ea4335]' : 'text-[#ea4335]')} />
              )}
            </div>
            <h3 className="text-lg font-semibold text-[#e8eaed]">
              {leaveRequestPending ? 'Waiting for teacher…' : leaveDenied ? 'Request denied' : 'Leave this session?'}
            </h3>
            <p className="mt-1 text-sm text-[#9aa0a6]">
              {leaveRequestPending
                ? 'Your leave request has been sent to the teacher.'
                : leaveDenied
                  ? 'The teacher denied your leave request. Try again later.'
                  : 'Teacher will be notified and must approve.'}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowLeaveDialog(false); setLeaveRequestPending(false); setLeaveDenied(false); }}
                className="flex-1 rounded-full bg-[#3c4043] py-2.5 text-sm font-medium text-[#e8eaed] hover:bg-[#4a4d51]"
              >
                {leaveRequestPending ? 'Cancel' : leaveDenied ? 'OK' : 'Cancel'}
              </button>
              {!leaveRequestPending && !leaveDenied && (
                <button
                  onClick={requestLeave}
                  className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white hover:bg-[#c5221f]"
                >
                  Request Leave
                </button>
              )}
              {leaveDenied && (
                <button
                  onClick={() => { setLeaveDenied(false); requestLeave(); }}
                  className="flex-1 rounded-full bg-[#ea4335] py-2.5 text-sm font-medium text-white hover:bg-[#c5221f]"
                >
                  Request Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teacher camera enlarged popup */}
      {teacherPopup && teacher && teacherCamPub && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setTeacherPopup(false)}
        >
          <div
            className="relative w-[90vw] max-w-200 aspect-video overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <VideoTrack
              trackRef={{ participant: teacher, publication: teacherCamPub, source: Track.Source.Camera } as TrackReference}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-4 py-3">
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
