'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Room, RoomEvent, DisconnectReason } from 'livekit-client';
import { useRouter } from 'next/navigation';
import TeacherView from './TeacherView';
import StudentView from './StudentView';
import GhostView from './GhostView';
import ScreenDeviceView from './ScreenDeviceView';

/**
 * ClassroomWrapper — Main LiveKit room provider + role-based view router.
 *
 * Reads session data from sessionStorage (set during join flow):
 *   - lk_token: LiveKit access token
 *   - lk_url: LiveKit WebSocket URL
 *   - room_id: Room identifier
 *   - room_name: Display name
 *   - participant_name: User display name
 *   - participant_role: Portal role
 *
 * Mounts <LiveKitRoom> with the token, then renders
 * TeacherView / StudentView / GhostView based on role.
 */

export interface ClassroomWrapperProps {
  roomId: string;
}

// Ghost roles that use the GhostView
const GHOST_ROLES = ['ghost', 'owner', 'coordinator', 'academic_operator', 'academic', 'parent'];

export default function ClassroomWrapper({ roomId }: ClassroomWrapperProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [scheduledStart, setScheduledStart] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [device, setDevice] = useState<string>('primary');
  const [roomStatus, setRoomStatus] = useState<string>('scheduled');
  const [error, setError] = useState<string | null>(null);
  const [room] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    // Performance: only subscribe to needed tracks
    videoCaptureDefaults: {
      resolution: { width: 640, height: 480, frameRate: 24 },
    },
  }));

  // Read session data on mount
  useEffect(() => {
    try {
      let lkToken = sessionStorage.getItem('lk_token');
      let lkUrl = sessionStorage.getItem('lk_url');
      let storedRoomName = sessionStorage.getItem('room_name');
      let storedRole = sessionStorage.getItem('participant_role');
      let storedName = sessionStorage.getItem('participant_name');
      let storedScheduledStart = sessionStorage.getItem('scheduled_start');
      let storedDuration = sessionStorage.getItem('duration_minutes');
      let storedDevice = sessionStorage.getItem('device');

      // Dev mode bridge: check localStorage if sessionStorage is empty
      if (!lkToken && localStorage.getItem('dev_bridge_ready')) {
        lkToken = localStorage.getItem('dev_lk_token');
        lkUrl = localStorage.getItem('dev_lk_url');
        storedRoomName = localStorage.getItem('dev_room_name');
        storedRole = localStorage.getItem('dev_participant_role');
        storedName = localStorage.getItem('dev_participant_name');
        storedScheduledStart = localStorage.getItem('dev_scheduled_start');
        storedDuration = localStorage.getItem('dev_duration_minutes');
        const devRoomStatus = localStorage.getItem('dev_room_status');

        // Copy to sessionStorage and clear localStorage bridge
        if (lkToken) {
          sessionStorage.setItem('lk_token', lkToken);
          sessionStorage.setItem('lk_url', lkUrl || '');
          sessionStorage.setItem('room_name', storedRoomName || '');
          sessionStorage.setItem('participant_role', storedRole || '');
          sessionStorage.setItem('participant_name', storedName || '');
          sessionStorage.setItem('scheduled_start', storedScheduledStart || '');
          sessionStorage.setItem('duration_minutes', storedDuration || '60');
          sessionStorage.setItem('room_status', devRoomStatus || 'scheduled');
        }
        // Clear bridge data
        localStorage.removeItem('dev_lk_token');
        localStorage.removeItem('dev_lk_url');
        localStorage.removeItem('dev_room_name');
        localStorage.removeItem('dev_participant_role');
        localStorage.removeItem('dev_participant_name');
        localStorage.removeItem('dev_scheduled_start');
        localStorage.removeItem('dev_duration_minutes');
        localStorage.removeItem('dev_room_status');
        localStorage.removeItem('dev_bridge_ready');
      }

      if (!lkToken || !lkUrl) {
        setError('Missing session data. Please rejoin the room.');
        return;
      }

      setToken(lkToken);
      setLivekitUrl(lkUrl);
      setRoomName(storedRoomName || roomId);
      setRole(storedRole || 'student');
      setParticipantName(storedName || 'Participant');
      setScheduledStart(storedScheduledStart || new Date().toISOString());
      setDurationMinutes(parseInt(storedDuration || '60', 10) || 60);
      setDevice(storedDevice || 'primary');
      setRoomStatus(sessionStorage.getItem('room_status') || 'scheduled');
    } catch {
      setError('Failed to read session data.');
    }
  }, [roomId]);

  // Handle room disconnection — only redirect for intentional/server-side disconnects
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      console.log('[ClassroomWrapper] Disconnected, reason:', reason);

      // Reasons that should redirect to the "ended" page:
      // CLIENT_INITIATED = user clicked leave / teacher ended class
      // SERVER_SHUTDOWN = LiveKit server stopped the room
      // ROOM_DELETED = room was destroyed server-side
      // PARTICIPANT_REMOVED = kicked from room
      const endReasons: (DisconnectReason | undefined)[] = [
        DisconnectReason.CLIENT_INITIATED,
        DisconnectReason.SERVER_SHUTDOWN,
        DisconnectReason.ROOM_DELETED,
        DisconnectReason.PARTICIPANT_REMOVED,
      ];

      if (endReasons.includes(reason)) {
        router.push(`/classroom/${roomId}/ended`);
        return;
      }

      // For unexpected disconnects (UNKNOWN, SIGNAL_DISCONNECTED, media errors, etc.)
      // Log a warning but do NOT redirect — LiveKit SDK will attempt reconnection automatically.
      console.warn('[ClassroomWrapper] Unexpected disconnect (not redirecting). Reason:', reason);
    },
    [router, roomId]
  );

  // Handle end class (teacher) — navigate directly, disconnect fires CLIENT_INITIATED
  const handleEndClass = useCallback(() => {
    room.disconnect();
    router.push(`/classroom/${roomId}/ended`);
  }, [room, router, roomId]);

  // Handle leave (student) — navigate directly, suppress the onDisconnected handler
  const handleLeave = useCallback(() => {
    // Navigate first, then disconnect. The onDisconnected callback will fire
    // with CLIENT_INITIATED but router.push is already called, so it's safe.
    router.push(`/classroom/${roomId}/ended`);
    room.disconnect();
  }, [room, router, roomId]);

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-white">{error}</h2>
          <button
            onClick={() => router.push(`/join/${roomId}`)}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Rejoin Room
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!token || !livekitUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white mx-auto" />
          <p className="mt-2 text-sm text-gray-400">Connecting to classroom...</p>
        </div>
      </div>
    );
  }

  const isGhost = GHOST_ROLES.includes(role);
  const isScreenDevice = device === 'screen';
  // navigator.mediaDevices is undefined on insecure (HTTP) contexts
  const isSecure = typeof window !== 'undefined' && (window.isSecureContext ?? location.protocol === 'https:');

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      room={room}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={handleDisconnected}
      onError={(err) => {
        console.error('[LiveKitRoom] Error:', err);
        // Don't disconnect/error for permission-denied — user just needs to click mic button
        if (err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) {
          console.warn('[ClassroomWrapper] Media permission denied — user can enable mic/camera manually');
          return;
        }
        // Don't show fatal error for getUserMedia failures on HTTP
        if (err?.message?.includes('getUserMedia') || err?.message?.includes('mediaDevices')) {
          console.warn('[ClassroomWrapper] Media not available (HTTP context) — continuing without local tracks');
          return;
        }
        // Don't show fatal error for client-initiated disconnects
        if (err?.message?.includes('Client initiated disconnect')) return;
        setError(`Connection error: ${err.message}`);
      }}
      className="h-screen"
    >
      {/* Global audio renderer for remote audio tracks */}
      <RoomAudioRenderer />

      {/* HTTP warning banner */}
      {!isSecure && !isGhost && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 px-3 py-1.5 text-center text-xs font-medium text-white">
          ⚠ HTTP mode — camera/mic unavailable. Use <strong>https://</strong> or <strong>localhost</strong> for full media.
        </div>
      )}

      {/* Role-based view */}
      {isScreenDevice ? (
        <ScreenDeviceView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
        />
      ) : role === 'teacher' ? (
        <TeacherView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          roomStatus={roomStatus}
          onEndClass={handleEndClass}
        />
      ) : isGhost ? (
        <GhostView
          roomId={roomId}
          roomName={roomName}
          observerName={participantName}
          observerRole={role}
          onLeave={handleLeave}
        />
      ) : (
        <StudentView
          roomId={roomId}
          roomName={roomName}
          participantName={participantName}
          scheduledStart={scheduledStart}
          durationMinutes={durationMinutes}
          onLeave={handleLeave}
        />
      )}
    </LiveKitRoom>
  );
}
