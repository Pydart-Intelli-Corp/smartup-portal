'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track, type RemoteParticipant, type Participant } from 'livekit-client';
import HeaderBar from './HeaderBar';
import ControlBar from './ControlBar';
import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import ParticipantList from './ParticipantList';
import WhiteboardComposite from './WhiteboardComposite';
import { cn } from '@/lib/utils';

/**
 * TeacherView — Full teacher classroom layout.
 *
 * Supports dual-device: teacher can see the composite preview (what students
 * see) when screen sharing from either their primary device or tablet.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────┬───────────┐
 * │  HEADER BAR — room name | timer | participants     │           │
 * ├─────────────────────────────────────────────────────┤  SIDEBAR  │
 * │                                                     │  Chat /   │
 * │   MAIN CONTENT AREA                                 │  Partici- │
 * │   (Whiteboard composite or teacher self-cam)        │  pants    │
 * │                                                     │           │
 * │  STUDENT STRIP (scrollable row)                     │           │
 * │  [S1] [S2] [S3] [S4] [S5] ...                      │           │
 * ├─────────────────────────────────────────────────────┴───────────┤
 * │  CONTROL BAR — mic | cam | screen | whiteboard | end           │
 * └─────────────────────────────────────────────────────────────────┘
 */

export interface TeacherViewProps {
  roomId: string;
  roomName: string;
  participantName: string;
  scheduledStart: string;
  durationMinutes: number;
  roomStatus: string;
  onEndClass: () => void;
  onTimeExpired?: () => void;
}

export default function TeacherView({
  roomId,
  roomName,
  participantName,
  scheduledStart,
  durationMinutes,
  roomStatus,
  onEndClass,
  onTimeExpired,
}: TeacherViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants'>('chat');
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [isLive, setIsLive] = useState(roomStatus === 'live');
  const [goingLive, setGoingLive] = useState(false);
  const [goLiveError, setGoLiveError] = useState('');

  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  // Find the teacher's screen device (tablet) if it's connected
  const teacherScreenDevice = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        return meta.device === 'screen' && meta.portal_role === 'teacher';
      } catch {
        return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
      }
    }) || null;
  }, [remoteParticipants]);

  // Separate students from others (filter out ghost and screen device participants)
  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        const role = meta.effective_role || meta.portal_role || '';
        return role === 'student';
      } catch {
        return p.identity.startsWith('student');
      }
    });
  }, [remoteParticipants]);

  // Check if screen sharing is active (from this device or tablet)
  const isLocalScreenSharing = localParticipant.isScreenShareEnabled;
  const isTabletScreenSharing = !!teacherScreenDevice?.getTrackPublication(Track.Source.ScreenShare)?.track;
  const hasAnyScreenShare = isLocalScreenSharing || isTabletScreenSharing;

  // ── Go Live handler ────────────────────────────────────────
  const handleGoLive = useCallback(async () => {
    setGoingLive(true);
    setGoLiveError('');
    try {
      const res = await fetch(`/api/v1/room/${roomId}/go-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setGoLiveError(data.error || 'Failed to go live');
        return;
      }
      setIsLive(true);
    } catch {
      setGoLiveError('Network error — please try again');
    } finally {
      setGoingLive(false);
    }
  }, [roomId]);

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Header */}
      <HeaderBar
        roomName={roomName}
        role="teacher"
        scheduledStart={scheduledStart}
        durationMinutes={durationMinutes}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onTimeExpired={onTimeExpired}
      />

      {/* ── Go Live Setup Banner ──────────────────────────────── */}
      {!isLive && (
        <div className="border-b border-amber-800/50 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            {/* Status indicators */}
            <div className="flex flex-1 items-center gap-6">
              {/* Laptop status */}
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-green-400">💻 Laptop connected</span>
              </div>

              {/* Tablet status */}
              <div className="flex items-center gap-2">
                {teacherScreenDevice ? (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-medium text-green-400">📱 Tablet connected</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-gray-500" />
                    <span className="text-xs font-medium text-gray-400">📱 Waiting for tablet...</span>
                  </>
                )}
              </div>

              {/* Student count */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  👥 {students.length} student{students.length !== 1 ? 's' : ''} waiting
                </span>
              </div>
            </div>

            {/* Go Live button */}
            <div className="flex items-center gap-3">
              {goLiveError && (
                <span className="text-xs text-red-400">{goLiveError}</span>
              )}
              {!teacherScreenDevice && (
                <span className="text-xs text-amber-400/70">
                  Tablet optional — you can go live without it
                </span>
              )}
              <button
                onClick={handleGoLive}
                disabled={goingLive}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 hover:shadow-red-500/40 disabled:opacity-50"
              >
                {goingLive ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Starting...
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    GO LIVE
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main body: content + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Main content area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 overflow-hidden p-2">
            {whiteboardActive && hasAnyScreenShare ? (
              /* Whiteboard mode: show composite with screen share + teacher overlay */
              <WhiteboardComposite
                teacher={localParticipant as unknown as Participant}
                teacherScreenDevice={teacherScreenDevice}
                className="h-full w-full"
              />
            ) : students.length === 0 ? (
              /* No students yet: show waiting message */
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-2 text-4xl">👥</div>
                  <p className="text-gray-400 text-sm">Waiting for students to join...</p>
                  <p className="text-gray-600 text-xs mt-1">{isLive ? 'Room is live' : 'Room not live yet'}</p>
                </div>
              </div>
            ) : (
              /* Student grid: fills main area, auto-sizing squares */
              <div
                className={cn(
                  'grid h-full w-full gap-2 auto-rows-fr',
                  students.length === 1 && 'grid-cols-1',
                  students.length === 2 && 'grid-cols-2',
                  students.length >= 3 && students.length <= 4 && 'grid-cols-2',
                  students.length >= 5 && students.length <= 6 && 'grid-cols-3',
                  students.length >= 7 && students.length <= 9 && 'grid-cols-3',
                  students.length >= 10 && 'grid-cols-4',
                )}
              >
                {students.map((student) => (
                  <div key={student.identity} className="relative min-h-0 min-w-0 overflow-hidden">
                    {/* Rotate 90° CW: student phone is portrait but CSS-forced landscape */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div style={{ transform: 'rotate(90deg)', width: '140%', height: '140%' }}>
                        <VideoTile
                          participant={student}
                          size="large"
                          showName={true}
                          showMicIndicator={true}
                          playAudio={true}
                          className="!rounded-none border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher self-preview: small floating overlay in top-left */}
          <div className="absolute top-3 left-3 z-30 shadow-lg ring-1 ring-white/20">
            <VideoTile
              participant={localParticipant}
              size="small"
              mirror={true}
              showName={false}
              showMicIndicator={true}
              className="!rounded-none !w-[120px] !h-[90px]"
            />
          </div>

          {/* Tablet connection status banner */}
          {teacherScreenDevice && (
            <div className="mx-2 mb-1 flex items-center gap-2 bg-green-900/40 px-3 py-1.5 text-xs text-green-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Tablet connected — screen share available from {teacherScreenDevice.name || 'tablet'}
            </div>
          )}
        </div>

        {/* Right: Sidebar (Chat / Participants) */}
        {sidebarOpen && (
          <div className="flex w-[300px] flex-col border-l border-gray-800">
            {/* Sidebar tab buttons */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setSidebarTab('chat')}
                className={cn(
                  'flex-1 py-2 text-xs font-medium transition-colors',
                  sidebarTab === 'chat'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                💬 Chat
              </button>
              <button
                onClick={() => setSidebarTab('participants')}
                className={cn(
                  'flex-1 py-2 text-xs font-medium transition-colors',
                  sidebarTab === 'participants'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                👥 Participants
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'chat' ? (
                <ChatPanel
                  participantName={participantName}
                  participantRole="teacher"
                />
              ) : (
                <ParticipantList
                  role="teacher"
                  roomId={roomId}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        role="teacher"
        roomId={roomId}
        whiteboardActive={whiteboardActive}
        onToggleWhiteboard={() => setWhiteboardActive(!whiteboardActive)}
        onToggleChat={() => {
          setSidebarOpen(true);
          setSidebarTab('chat');
        }}
        onEndClass={onEndClass}
      />
    </div>
  );
}

