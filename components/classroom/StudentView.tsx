'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useDataChannel,
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
 * StudentView — Student classroom layout.
 *
 * Layout:
 *   ┌──────────────────────────────┬──────┐
 *   │         Header Bar           │      │
 *   ├──────────────────────────────┤ Side │
 *   │                              │  bar │
 *   │   Whiteboard / Video         │      │
 *   │   (full area, clean)         │ 📷🎤 │
 *   │                              │ ✋💬 │
 *   │                              │ Leave│
 *   └──────────────────────────────┴──────┘
 *
 * Right sidebar contains: teacher camera, student self-cam,
 * mic/camera/hand-raise/chat/leave buttons.
 * Whiteboard gets full space without any overlapping elements.
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

function isTeacherPrimary(p: RemoteParticipant): boolean {
  try {
    const meta = JSON.parse(p.metadata || '{}');
    const role = meta.effective_role || meta.portal_role;
    const device = meta.device;
    if (role === 'teacher' && device !== 'screen') return true;
  } catch { /* fallback */ }
  return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
}

function isTeacherScreen(p: RemoteParticipant): boolean {
  try {
    const meta = JSON.parse(p.metadata || '{}');
    return meta.device === 'screen' && (meta.portal_role === 'teacher' || meta.effective_role === 'teacher_screen');
  } catch { /* fallback */ }
  return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
}

export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  onLeave,
  onTimeExpired,
}: StudentViewProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showCameraWarning, setShowCameraWarning] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Detect portrait orientation for CSS-based landscape rotation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Try Screen Orientation API lock (works on some Android browsers)
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation = screen?.orientation as any;
        if (orientation?.lock) {
          await orientation.lock('landscape');
        }
      } catch { /* Not supported — ignore */ }
    };
    lockLandscape();
    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen?.orientation as any)?.unlock?.();
      } catch { /* ignore */ }
    };
  }, []);

  // Detect virtual keyboard opening via visualViewport API
  // In CSS-rotated mode the keyboard appears from the physical bottom
  // (which is the visual right) — we shrink the view width to compensate
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      // Keyboard open = viewport height shrinks relative to window height
      const diff = window.innerHeight - vv.height;
      setKeyboardHeight(diff > 50 ? diff : 0);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const teacher = useMemo(() => remoteParticipants.find(isTeacherPrimary) || null, [remoteParticipants]);
  const teacherScreenDevice = useMemo(() => remoteParticipants.find(isTeacherScreen) || null, [remoteParticipants]);

  const hasScreenShare = useMemo(() => {
    if (teacherScreenDevice) {
      const pub = teacherScreenDevice.getTrackPublication(Track.Source.ScreenShare);
      if (pub && !pub.isMuted) return true;
    }
    if (teacher) {
      const pub = teacher.getTrackPublication(Track.Source.ScreenShare);
      if (pub && !pub.isMuted) return true;
    }
    return false;
  }, [teacher, teacherScreenDevice]);

  const hasTeacherCamera = useMemo(() => {
    if (!teacher) return false;
    const pub = teacher.getTrackPublication(Track.Source.Camera);
    return !!pub && !pub.isMuted;
  }, [teacher]);

  // Teacher camera track ref for sidebar PIP
  const teacherCameraPub = useMemo(() => {
    if (!teacher) return null;
    const pub = teacher.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
    return (pub && !pub.isMuted && pub.track) ? pub : null;
  }, [teacher]);

  const toggleHandRaise = useCallback(async () => {
    const newState = !handRaised;
    setHandRaised(newState);
    const msg = {
      student_id: localParticipant.identity,
      student_name: localParticipant.name || localParticipant.identity,
      action: newState ? 'raise' : 'lower',
    };
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(msg));
      await localParticipant.publishData(bytes, { topic: 'hand_raise', reliable: true });
    } catch (err) {
      console.error('Failed to send hand raise:', err);
    }
  }, [handRaised, localParticipant]);

  const toggleMic = async () => {
    try { await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled); }
    catch (err) { console.error('[Student] Mic toggle failed:', err); }
  };

  const toggleCamera = async () => {
    try { await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled); }
    catch (err) { console.error('[Student] Camera toggle failed:', err); }
  };

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;

  // When screen share is active and device is portrait, force landscape via CSS transform
  const forceRotate = hasScreenShare && isPortrait;

  return (
    <div
      className="bg-gray-950"
      style={
        forceRotate
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: `calc(100vh - ${keyboardHeight}px)`,
              height: '100vw',
              transform: 'rotate(90deg)',
              transformOrigin: 'top left',
              marginLeft: '100vw',
              overflow: 'hidden',
            }
          : { display: 'flex', flexDirection: 'column', height: '100vh' }
      }
    >
      {/* Header — hidden when rotated to maximize whiteboard space */}
      {!forceRotate && (
        <HeaderBar roomName={roomName} role="student" scheduledStart={scheduledStart} durationMinutes={durationMinutes} onTimeExpired={onTimeExpired} />
      )}

      {/* Main body: content + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main content area (whiteboard / video) ── */}
        <div className="relative flex-1 overflow-hidden">
          <div className="h-full p-1">
            {hasScreenShare && teacher ? (
              <WhiteboardComposite
                teacher={teacher}
                teacherScreenDevice={teacherScreenDevice}
                hideOverlay={true}
                className="h-full w-full rounded-lg"
              />
            ) : hasTeacherCamera && teacher ? (
              <div className="flex h-full items-center justify-center">
                <VideoTile
                  participant={teacher}
                  size="large"
                  showName={true}
                  showMicIndicator={true}
                  playAudio={true}
                  className="max-h-full max-w-full rounded-lg"
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-3 text-4xl">📚</div>
                  <h2 className="text-lg font-semibold text-white">
                    {teacher ? 'Class in progress — audio only' : 'Waiting for teacher to start...'}
                  </h2>
                  {teacher && (
                    <p className="mt-1 text-sm text-gray-400">
                      {teacher.name || teacher.identity}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Teacher audio (always play if teacher exists) */}
            {teacher && teacher.getTrackPublication(Track.Source.Microphone)?.track && (
              <AudioTrack
                trackRef={{
                  participant: teacher,
                  publication: teacher.getTrackPublication(Track.Source.Microphone)!,
                  source: Track.Source.Microphone,
                } as TrackReference}
              />
            )}
          </div>

          {/* Hand raised indicator — bottom-left of main area */}
          {handRaised && (
            <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-yellow-500/90 px-3 py-1.5 text-sm font-medium text-black">
              🖐 Your hand is raised
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div className={cn(
          'flex flex-col items-center gap-2 border-l border-gray-800 bg-gray-900/80',
          forceRotate ? 'w-14 py-1' : 'w-16 py-2'
        )}>
          {/* Teacher camera PIP */}
          {hasTeacherCamera && teacher && teacherCameraPub && (
            <div className="w-12 h-12 rounded-md overflow-hidden ring-1 ring-blue-500/50 flex-shrink-0" title="Teacher">
              <VideoTrack
                trackRef={{
                  participant: teacher,
                  publication: teacherCameraPub,
                  source: Track.Source.Camera,
                } as TrackReference}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Student self-cam PIP — rotated -90° to correct for CSS landscape rotation */}
          {isCameraOn && (
            <div className="w-12 h-12 rounded-md overflow-hidden ring-1 ring-green-500/50 flex-shrink-0" title="You">
              <div style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <VideoTile
                  participant={localParticipant}
                  size="small"
                  mirror={true}
                  showName={false}
                  showMicIndicator={false}
                  className="h-full w-full !rounded-none"
                />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="w-8 border-t border-gray-600/40" />

          {/* Mic toggle */}
          <SidebarMeetButton
            on={isMicOn}
            onClick={toggleMic}
            title={isMicOn ? 'Mute' : 'Unmute'}
            onIcon={<MicOnIcon className="h-4 w-4" />}
            offIcon={<MicOffIcon className="h-4 w-4" />}
            offColor="bg-[#ea4335]"
          />

          {/* Camera toggle */}
          <SidebarMeetButton
            on={isCameraOn}
            onClick={toggleCamera}
            title={isCameraOn ? 'Camera off' : 'Camera on'}
            onIcon={<CameraOnIcon className="h-4 w-4" />}
            offIcon={<CameraOffIcon className="h-4 w-4" />}
            offColor="bg-[#ea4335]"
          />

          {/* Hand raise */}
          <SidebarMeetButton
            on={handRaised}
            onClick={toggleHandRaise}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
            onIcon={<HandRaiseIcon className="h-4 w-4" />}
            offIcon={<HandRaiseIcon className="h-4 w-4" />}
            onColor="bg-[#fbbf24]"
            onTextColor="text-black"
          />

          {/* Chat toggle */}
          <SidebarMeetButton
            on={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            title="Chat"
            onIcon={<ChatIcon className="h-4 w-4" />}
            offIcon={<ChatIcon className="h-4 w-4" />}
            onColor="bg-[#1a73e8]"
          />

          {/* Spacer to push leave to bottom */}
          <div className="flex-1" />

          {/* Leave button */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            title="Leave class"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ea4335] text-white transition-all hover:bg-[#d33426] active:scale-90 flex-shrink-0"
          >
            <LeaveIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Chat panel (slides in from right of content area, before sidebar) */}
        {chatOpen && (
          <div className="w-[280px] border-l border-gray-800">
            <ChatPanel
              participantName={participantName}
              participantRole="student"
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl bg-gray-800 p-6 text-center shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-white">Leave this class?</h3>
            <p className="mb-4 text-sm text-gray-400">You can rejoin while the class is active.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
              >
                Stay
              </button>
              <button
                onClick={onLeave}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Leave Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera warning dialog */}
      {showCameraWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-w-sm rounded-xl bg-gray-800 p-6 text-center shadow-xl">
            <div className="mb-3 text-3xl">📷</div>
            <h3 className="mb-2 text-lg font-semibold text-white">Camera Required</h3>
            <p className="mb-4 text-sm text-gray-400">
              Your camera needs to be on during class for attendance. Your teacher has been
              notified if you keep it off.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCameraWarning(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white"
              >
                Keep Camera Off
              </button>
              <button
                onClick={async () => {
                  await localParticipant.setCameraEnabled(true);
                  setShowCameraWarning(false);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Turn Camera On
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Google Meet-style sidebar button ───────────────────────
function SidebarMeetButton({
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
        'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 active:scale-90 flex-shrink-0',
        on ? `${onColor} ${onTextColor}` : `${offColor} ${offTextColor}`,
        on ? 'hover:bg-[#4a4d51]' : (offColor === 'bg-[#ea4335]' ? 'hover:bg-[#d33426]' : 'hover:bg-[#4a4d51]'),
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
