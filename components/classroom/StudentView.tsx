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
import { Track, type RemoteParticipant } from 'livekit-client';
import HeaderBar from './HeaderBar';
import ControlBar from './ControlBar';
import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import WhiteboardComposite from './WhiteboardComposite';
import { cn } from '@/lib/utils';

/**
 * StudentView — Student classroom layout.
 *
 * Forces landscape orientation on mobile/tablet devices.
 *
 * Supports dual-device teacher setup:
 *   - Primary teacher (laptop): camera + mic → overlay with bg removal
 *   - Screen device (tablet): screen share → whiteboard background
 *
 * When whiteboard (screen share) is active:
 *   Tablet screen fills main area + teacher camera as AI-cutout overlay (via WhiteboardComposite)
 * When no screen share:
 *   Teacher camera fills main area as standard video tile.
 */

export interface StudentViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart: string;
  durationMinutes: number;
  onLeave: () => void;
}

/**
 * Determine if a participant is the primary teacher.
 * Checks metadata first, then identity prefix.
 */
function isTeacherPrimary(p: RemoteParticipant): boolean {
  try {
    const meta = JSON.parse(p.metadata || '{}');
    const role = meta.effective_role || meta.portal_role;
    const device = meta.device;
    if (role === 'teacher' && device !== 'screen') return true;
  } catch {
    // fallback: identity based
  }
  // Identity: teacher_xxx (no _screen suffix)
  return p.identity.startsWith('teacher') && !p.identity.endsWith('_screen');
}

/**
 * Determine if a participant is the teacher's screen device.
 */
function isTeacherScreen(p: RemoteParticipant): boolean {
  try {
    const meta = JSON.parse(p.metadata || '{}');
    return meta.device === 'screen' && (meta.portal_role === 'teacher' || meta.effective_role === 'teacher_screen');
  } catch {
    // fallback
  }
  return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
}

export default function StudentView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  onLeave,
}: StudentViewProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showCameraWarning, setShowCameraWarning] = useState(false);

  // Lock to landscape on mobile/tablet
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation = screen?.orientation as any;
        if (orientation?.lock) {
          await orientation.lock('landscape');
        }
      } catch {
        // Not supported on desktop browsers or user denied — ignore
      }
    };
    lockLandscape();
    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (screen?.orientation as any)?.unlock?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Find primary teacher (laptop — camera + mic)
  const teacher = useMemo(() => {
    return remoteParticipants.find(isTeacherPrimary) || null;
  }, [remoteParticipants]);

  // Find teacher's screen device (tablet — screen share only)
  const teacherScreenDevice = useMemo(() => {
    return remoteParticipants.find(isTeacherScreen) || null;
  }, [remoteParticipants]);

  // Determine screen share availability — check both teacher devices
  const hasScreenShare = useMemo(() => {
    // Check screen device first (dual-device mode)
    if (teacherScreenDevice) {
      const pub = teacherScreenDevice.getTrackPublication(Track.Source.ScreenShare);
      if (pub && !pub.isMuted) return true;
    }
    // Check primary teacher (single-device screen share)
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

  // Hand raise toggle via data channel
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

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Minimal header */}
      <HeaderBar roomName={roomName} role="student" scheduledStart={scheduledStart} durationMinutes={durationMinutes} />

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Main content */}
          <div className="h-full p-2">
            {hasScreenShare && teacher ? (
              /* Priority 1: WhiteboardComposite — screen share + AI teacher overlay */
              <WhiteboardComposite
                teacher={teacher}
                teacherScreenDevice={teacherScreenDevice}
                className="h-full w-full rounded-lg"
              />
            ) : hasTeacherCamera && teacher ? (
              /* Priority 2: Teacher camera large */
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
              /* Priority 3: Waiting placeholder */
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

          {/* PiP self-view — bottom-left */}
          {localParticipant.isCameraEnabled && (
            <div className="absolute bottom-20 left-4 z-10">
              <VideoTile
                participant={localParticipant}
                size="small"
                mirror={true}
                showName={false}
                showMicIndicator={false}
                className="border-2 border-white shadow-lg"
              />
            </div>
          )}

          {/* Hand raised indicator */}
          {handRaised && (
            <div className="absolute bottom-20 left-40 z-10 rounded-lg bg-yellow-500/90 px-3 py-1.5 text-sm font-medium text-black">
              🖐 Your hand is raised
            </div>
          )}
        </div>

        {/* Chat panel (slides in from right) */}
        {chatOpen && (
          <div className="w-[300px] border-l border-gray-800">
            <ChatPanel
              participantName={participantName}
              participantRole="student"
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        role="student"
        roomId={roomId}
        handRaised={handRaised}
        onToggleHandRaise={toggleHandRaise}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onLeave={onLeave}
      />

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
