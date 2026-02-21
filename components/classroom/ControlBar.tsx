'use client';

import { useState } from 'react';
import {
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * ControlBar — classroom media controls.
 * Teacher: mic, camera, screen share, whiteboard toggle, end class.
 * Student: mic (starts muted), camera, hand raise, chat toggle, leave.
 * Ghost: no controls (read-only observe).
 */

export interface ControlBarProps {
  role: 'teacher' | 'student' | 'ghost';
  roomId: string;
  /** Whiteboard mode active (teacher only) */
  whiteboardActive?: boolean;
  /** Toggle whiteboard mode (teacher only) */
  onToggleWhiteboard?: () => void;
  /** Toggle chat panel */
  onToggleChat?: () => void;
  /** Hand raise state (student only) */
  handRaised?: boolean;
  /** Toggle hand raise (student only) */
  onToggleHandRaise?: () => void;
  /** End class callback */
  onEndClass?: () => void;
  /** Leave class callback */
  onLeave?: () => void;
  className?: string;
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
}: ControlBarProps) {
  const { localParticipant } = useLocalParticipant();
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Ghost has no controls
  if (role === 'ghost') return null;

  const isMicOn = localParticipant.isMicrophoneEnabled;
  const isCameraOn = localParticipant.isCameraEnabled;
  const isScreenShareOn = localParticipant.isScreenShareEnabled;

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicOn);
  };

  const toggleCamera = async () => {
    await localParticipant.setCameraEnabled(!isCameraOn);
  };

  const toggleScreenShare = async () => {
    await localParticipant.setScreenShareEnabled(!isScreenShareOn);
  };

  const handleEndClass = async () => {
    setIsEnding(true);
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        onEndClass?.();
      } else {
        console.error('Failed to end class');
      }
    } catch (err) {
      console.error('Error ending class:', err);
    } finally {
      setIsEnding(false);
      setShowEndConfirm(false);
    }
  };

  return (
    <div className={cn('relative flex h-16 items-center justify-center gap-3 border-t border-gray-800 bg-gray-900 px-4', className)}>
      {/* Microphone */}
      <ControlButton
        active={isMicOn}
        onClick={toggleMic}
        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        activeIcon="🎤"
        inactiveIcon="🔇"
        activeColor="bg-gray-700"
        inactiveColor="bg-red-600"
      />

      {/* Camera */}
      <ControlButton
        active={isCameraOn}
        onClick={toggleCamera}
        title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        activeIcon="📷"
        inactiveIcon="🚫"
        activeColor="bg-gray-700"
        inactiveColor="bg-red-600"
      />

      {/* Teacher-only: Screen share */}
      {role === 'teacher' && (
        <ControlButton
          active={isScreenShareOn}
          onClick={toggleScreenShare}
          title={isScreenShareOn ? 'Stop screen share' : 'Start screen share'}
          activeIcon="🖥️"
          inactiveIcon="🖥️"
          activeColor="bg-green-600"
          inactiveColor="bg-gray-700"
        />
      )}

      {/* Teacher-only: Whiteboard mode */}
      {role === 'teacher' && onToggleWhiteboard && (
        <ControlButton
          active={whiteboardActive}
          onClick={() => {
            if (!isScreenShareOn && !whiteboardActive) {
              // Reminder: need screen share first
              alert('Start screen share first — share your tablet screen');
              return;
            }
            onToggleWhiteboard();
          }}
          title={whiteboardActive ? 'Exit whiteboard mode' : 'Whiteboard mode'}
          activeIcon="📋"
          inactiveIcon="📋"
          activeColor="bg-green-600"
          inactiveColor="bg-gray-700"
        />
      )}

      {/* Student-only: Hand raise */}
      {role === 'student' && onToggleHandRaise && (
        <ControlButton
          active={handRaised}
          onClick={onToggleHandRaise}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          activeIcon="🖐"
          inactiveIcon="✋"
          activeColor="bg-yellow-500"
          inactiveColor="bg-gray-700"
        />
      )}

      {/* Chat toggle */}
      {onToggleChat && (
        <ControlButton
          active={false}
          onClick={onToggleChat}
          title="Toggle chat"
          activeIcon="💬"
          inactiveIcon="💬"
          activeColor="bg-gray-700"
          inactiveColor="bg-gray-700"
        />
      )}

      {/* Teacher: End Class */}
      {role === 'teacher' && (
        <button
          onClick={() => setShowEndConfirm(true)}
          className="ml-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          ⏹ End Class
        </button>
      )}

      {/* Student: Leave */}
      {role === 'student' && (
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="ml-4 rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
        >
          ✕ Leave
        </button>
      )}

      {/* End class confirmation dialog */}
      {showEndConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl bg-gray-800 p-6 text-center shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-white">End class for everyone?</h3>
            <p className="mb-4 text-sm text-gray-400">This will disconnect all students.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEndClass}
                disabled={isEnding}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isEnding ? 'Ending...' : 'End Class Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
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
    </div>
  );
}

// ── Internal button component ────────────────────────────────
function ControlButton({
  active,
  onClick,
  title,
  activeIcon,
  inactiveIcon,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  activeIcon: string;
  inactiveIcon: string;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full text-lg transition-colors',
        active ? activeColor : inactiveColor,
        'hover:opacity-80'
      )}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
