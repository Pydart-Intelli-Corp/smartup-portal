'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useLocalParticipant,
  useRemoteParticipants,
  useDataChannel,
} from '@livekit/components-react';
import { Track, VideoQuality, type Participant, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import HeaderBar from './HeaderBar';
import ControlBar from './ControlBar';
import VideoTile from './VideoTile';
import VideoQualitySelector, { type VideoQualityOption, QUALITY_MAP } from './VideoQualitySelector';
import ChatPanel from './ChatPanel';
import ParticipantList from './ParticipantList';
import WhiteboardComposite from './WhiteboardComposite';
import { cn } from '@/lib/utils';
import { sfxHandRaise, sfxHandLower, sfxParticipantJoin, sfxParticipantLeave, sfxMediaRequest, sfxMediaControl, hapticTap } from '@/lib/sounds';

/**
 * TeacherView — Google Meet-style teacher classroom.
 *
 * Professional layout:
 *   ┌──────────────────────────────────────────┬──────────┐
 *   │  Header  (room • LIVE • timer • count)   │          │
 *   ├──────────────────────────────────────────┤ Sidebar  │
 *   │                                          │ Chat /   │
 *   │  MAIN CONTENT                            │ Users    │
 *   │  (student grid OR whiteboard + strip)    │ (320px)  │
 *   │                                          │          │
 *   │  [Self PIP]                              │          │
 *   │                                          │          │
 *   ├──────────────────────────────────────────┴──────────┤
 *   │  🎤  📷  🖥️  📋  💬           [End Class]          │
 *   └─────────────────────────────────────────────────────┘
 *
 * Features:
 *   - Responsive student grid (auto-cols, object-fit cover, no rotation)
 *   - Whiteboard mode: fullscreen whiteboard + student thumbnail strip
 *   - Self-cam floating PIP (top-left, mirrored)
 *   - Collapsible sidebar with chat/participant tabs
 *   - Professional Go Live setup banner
 *   - Tablet connection status indicator
 *   - Google Meet dark theme (#202124 base)
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

  // ── Hand-raise tracking ──
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const processedHandIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      // Simple dedup
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      // Trim old dedup keys
      if (processedHandIds.current.size > 200) {
        const arr = Array.from(processedHandIds.current);
        processedHandIds.current = new Set(arr.slice(-100));
      }

      // Play sound + haptic for hand raise/lower
      if (data.action === 'raise') sfxHandRaise(); else sfxHandLower();

      setRaisedHands((prev) => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
        } else {
          next.delete(data.student_id);
        }
        return next;
      });
    } catch {}
  }, []);

  const { message: handMsg } = useDataChannel('hand_raise', onHandRaise);

  // Fallback: also process via message observable
  useEffect(() => {
    if (!handMsg) return;
    onHandRaise(handMsg);
  }, [handMsg, onHandRaise]);

  // Clean up hands for students who left
  useEffect(() => {
    setRaisedHands((prev) => {
      const activeIds = new Set(remoteParticipants.map((p) => p.identity));
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [remoteParticipants]);

  // Dismiss individual hand or all
  const dismissHand = useCallback((studentId: string) => {
    hapticTap();
    setRaisedHands((prev) => { const n = new Map(prev); n.delete(studentId); return n; });
  }, []);

  const dismissAllHands = useCallback(() => {
    hapticTap();
    setRaisedHands(new Map());
  }, []);

  const handCount = raisedHands.size;
  const sortedHands = useMemo(() => {
    return Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);
  }, [raisedHands]);

  // ── Media request tracking ──
  interface MediaRequest {
    student_id: string;
    student_name: string;
    type: 'mic' | 'camera';
    desired: boolean;
    time: number;
  }
  const [mediaRequests, setMediaRequests] = useState<MediaRequest[]>([]);
  const processedRequestIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMediaRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; type: 'mic' | 'camera'; desired: boolean };
      const key = `${data.student_id}_${data.type}_${Math.floor(Date.now() / 500)}`;
      if (processedRequestIds.current.has(key)) return;
      processedRequestIds.current.add(key);
      if (processedRequestIds.current.size > 200) {
        const arr = Array.from(processedRequestIds.current);
        processedRequestIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setMediaRequests((prev) => [
        ...prev.filter((r) => !(r.student_id === data.student_id && r.type === data.type)),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: mediaReqMsg } = useDataChannel('media_request', onMediaRequest);
  useEffect(() => { if (mediaReqMsg) onMediaRequest(mediaReqMsg); }, [mediaReqMsg, onMediaRequest]);

  // Dismiss a media notification (info-only, no action on student)
  const dismissRequest = useCallback((req: MediaRequest) => {
    hapticTap();
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === req.student_id && r.type === req.type)));
  }, []);

  // Send media_control command to a student (approve their request)
  const sendMediaControl = useCallback(async (targetId: string, type: 'mic' | 'camera', enabled: boolean) => {
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: targetId,
          type,
          enabled,
        })),
        { topic: 'media_control', reliable: true },
      );
    } catch {}
    // Remove matching pending request
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === targetId && r.type === type)));
  }, [localParticipant]);

  // Approve a media request — sends control command to toggle student device
  const approveRequest = useCallback((req: MediaRequest) => {
    sendMediaControl(req.student_id, req.type, req.desired);
  }, [sendMediaControl]);

  // Deny a media request — just dismiss, no command sent
  const denyRequest = useCallback((req: MediaRequest) => {
    hapticTap();
    setMediaRequests((prev) => prev.filter((r) => !(r.student_id === req.student_id && r.type === req.type)));
  }, []);

  // Clean up requests for students who left
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setMediaRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
    setLeaveRequests((prev) => prev.filter((r) => activeIds.has(r.student_id)));
  }, [remoteParticipants]);

  // ── Leave request tracking ──
  interface LeaveRequest {
    student_id: string;
    student_name: string;
    time: number;
  }
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const processedLeaveIds = useRef(new Set<string>());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLeaveRequest = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string };
      const key = `${data.student_id}_${Math.floor(Date.now() / 500)}`;
      if (processedLeaveIds.current.has(key)) return;
      processedLeaveIds.current.add(key);
      if (processedLeaveIds.current.size > 200) {
        const arr = Array.from(processedLeaveIds.current);
        processedLeaveIds.current = new Set(arr.slice(-100));
      }
      sfxMediaRequest();
      setLeaveRequests((prev) => [
        ...prev.filter((r) => r.student_id !== data.student_id),
        { ...data, time: Date.now() },
      ]);
    } catch {}
  }, []);

  const { message: leaveReqMsg } = useDataChannel('leave_request', onLeaveRequest);
  useEffect(() => { if (leaveReqMsg) onLeaveRequest(leaveReqMsg); }, [leaveReqMsg, onLeaveRequest]);

  // Send leave_control command to student
  const sendLeaveControl = useCallback(async (targetId: string, approved: boolean) => {
    hapticTap();
    sfxMediaControl();
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          target_id: targetId,
          approved,
        })),
        { topic: 'leave_control', reliable: true },
      );
    } catch {}
    setLeaveRequests((prev) => prev.filter((r) => r.student_id !== targetId));
  }, [localParticipant]);

  const approveLeave = useCallback((req: LeaveRequest) => {
    sendLeaveControl(req.student_id, true);
  }, [sendLeaveControl]);

  const denyLeave = useCallback((req: LeaveRequest) => {
    sendLeaveControl(req.student_id, false);
  }, [sendLeaveControl]);

  // ── Student join/leave sound ──
  const prevStudentIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(remoteParticipants.filter((p) => {
      try { const m = JSON.parse(p.metadata || '{}'); return (m.effective_role || m.portal_role) === 'student'; }
      catch { return p.identity.startsWith('student'); }
    }).map((p) => p.identity));
    if (prevStudentIds.current.size > 0) {
      for (const id of currentIds) {
        if (!prevStudentIds.current.has(id)) { sfxParticipantJoin(); break; }
      }
      for (const id of prevStudentIds.current) {
        if (!currentIds.has(id)) { sfxParticipantLeave(); break; }
      }
    }
    prevStudentIds.current = currentIds;
  }, [remoteParticipants]);

  // ── Teacher screen device (tablet) ──
  const teacherScreenDevice = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        return m.device === 'screen' && m.portal_role === 'teacher';
      } catch {
        return p.identity.endsWith('_screen') && p.identity.startsWith('teacher');
      }
    }) ?? null;
  }, [remoteParticipants]);

  // ── Students (filter out ghost/screen device participants) ──
  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const m = JSON.parse(p.metadata || '{}');
        return (m.effective_role || m.portal_role) === 'student';
      } catch {
        return p.identity.startsWith('student');
      }
    });
  }, [remoteParticipants]);

  // ── Local mute tracking (teacher-side only, does NOT affect student devices) ──
  // All students start muted — teacher unmutes individually as needed
  const [mutedStudents, setMutedStudents] = useState<Set<string>>(new Set());

  // Auto-mute new joiners + clean up departed students
  useEffect(() => {
    setMutedStudents((prev) => {
      const activeIds = new Set(students.map((s) => s.identity));
      const next = new Set(prev);
      let changed = false;
      // Add any new students as muted by default
      for (const id of activeIds) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      // Remove departed students
      for (const id of next) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [students]);

  const toggleStudentMute = useCallback((studentId: string) => {
    hapticTap();
    setMutedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }, []);



  // (Local mute is handled by default in mutedStudents state — no data channel needed)

  // ── Screen share detection ──
  const isLocalScreenShare = localParticipant.isScreenShareEnabled;
  const isTabletScreenShare = !!teacherScreenDevice?.getTrackPublication(Track.Source.ScreenShare)?.track;
  const hasScreenShare = isLocalScreenShare || isTabletScreenShare;

  // ── Go Live ──
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

  // ── Student grid columns ──
  const gridCols =
    students.length <= 1 ? 'grid-cols-1'
    : students.length <= 2 ? 'grid-cols-2'
    : students.length <= 4 ? 'grid-cols-2'
    : students.length <= 6 ? 'grid-cols-3'
    : students.length <= 9 ? 'grid-cols-3'
    : 'grid-cols-4';

  // ── Video quality for student feeds ──
  const [videoQuality, setVideoQuality] = useState<VideoQualityOption>('auto');

  // Apply quality to all student camera tracks
  // Uses setVideoQuality() to directly select simulcast layer (LOW/MEDIUM/HIGH)
  useEffect(() => {
    const quality = QUALITY_MAP[videoQuality];
    for (const student of students) {
      const camPub = student.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
      if (camPub) {
        camPub.setVideoQuality(quality ?? VideoQuality.HIGH);
      }
    }
  }, [students, videoQuality]);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] flex-col bg-[#202124] text-[#e8eaed]">

      {/* ── Header ──────────────────────────────────────── */}
      <HeaderBar
        roomName={roomName}
        role="teacher"
        scheduledStart={scheduledStart}
        durationMinutes={durationMinutes}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onTimeExpired={onTimeExpired}
      />

      {/* ── Go Live Setup Banner ────────────────────────── */}
      {!isLive && (
        <div className="border-b border-[#3c4043] bg-[#292a2d]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            {/* Connection status indicators */}
            <div className="flex items-center gap-5 text-xs">
              <StatusDot active label="💻 Laptop" />
              <StatusDot active={!!teacherScreenDevice} label="📱 Tablet" pendingLabel="📱 Waiting…" />
              <span className="text-[#9aa0a6]">
                👥 {students.length} student{students.length !== 1 ? 's' : ''} waiting
              </span>
            </div>

            {/* Go Live button + error */}
            <div className="flex items-center gap-3">
              {goLiveError && (
                <span className="text-xs text-[#ea4335]">{goLiveError}</span>
              )}
              {!teacherScreenDevice && (
                <span className="hidden text-xs text-[#9aa0a6] sm:inline">
                  Tablet optional
                </span>
              )}
              <button
                onClick={handleGoLive}
                disabled={goingLive}
                className={cn(
                  'flex items-center gap-2 rounded-full bg-[#ea4335] px-6 py-2.5',
                  'text-sm font-bold text-white shadow-lg shadow-red-900/20',
                  'transition-all hover:bg-[#c5221f] active:scale-95 disabled:opacity-50',
                )}
              >
                {goingLive ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Going live…
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

      {/* ── Body (main + sidebar) ───────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main content area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-2">

            {/* === Whiteboard mode: whiteboard + student strip === */}
            {whiteboardActive && hasScreenShare ? (
              <div className="flex h-full flex-col gap-2">
                {/* Whiteboard */}
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
                  <WhiteboardComposite
                    teacher={localParticipant as unknown as Participant}
                    teacherScreenDevice={teacherScreenDevice}
                    className="h-full w-full"
                  />
                </div>
                {/* Student thumbnail strip (scrollable) */}
                {students.length > 0 && (
                  <div className="flex h-[100px] gap-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                    {students.map((s) => (
                      <div
                        key={s.identity}
                        className="relative group h-full w-[130px] flex-shrink-0 overflow-hidden rounded-lg"
                      >
                        <VideoTile
                          participant={s}
                          size="small"
                          showName={true}
                          showMicIndicator={true}
                          playAudio={!mutedStudents.has(s.identity)}
                          handRaised={raisedHands.has(s.identity)}
                          className="!w-full !h-full !rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            /* === No students: waiting state === */
            ) : students.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c4043]">
                    <svg className="h-10 w-10 text-[#9aa0a6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium text-[#e8eaed]">Waiting for students…</h2>
                  <p className="mt-2 text-sm text-[#9aa0a6]">
                    {isLive ? 'Room is live — students can join now' : 'Go live to let students join'}
                  </p>
                </div>
              </div>

            /* === Student grid (responsive, no rotation) === */
            ) : (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-[#9aa0a6]">
                    {students.length} student{students.length !== 1 ? 's' : ''}
                  </span>
                  <VideoQualitySelector
                    quality={videoQuality}
                    onChange={setVideoQuality}
                    variant="panel"
                  />
                </div>
                {/* Grid */}
                <div className={cn('grid flex-1 w-full gap-2 auto-rows-fr', gridCols)}>
                  {students.map((s) => (
                    <div
                      key={s.identity}
                      className="relative group min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d]"
                    >
                      <VideoTile
                        participant={s}
                        size="large"
                        showName={true}
                        showMicIndicator={true}
                        playAudio={!mutedStudents.has(s.identity)}
                        handRaised={raisedHands.has(s.identity)}
                        className="!rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Self-cam floating PIP (top-left) */}
          <div className="absolute top-4 left-4 z-30 overflow-hidden rounded-xl shadow-xl ring-1 ring-white/[0.08] transition-shadow hover:ring-white/20">
            <VideoTile
              participant={localParticipant}
              size="small"
              mirror={true}
              showName={false}
              showMicIndicator={true}
              className="!w-[140px] !h-[105px] !rounded-xl"
            />
          </div>

          {/* ── Media approval requests (floating bottom-left) ── */}
          {mediaRequests.length > 0 && (
            <div className="absolute bottom-3 left-3 z-40 w-[300px] rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#1a73e8]/10 border-b border-[#3c4043]">
                <div className="flex items-center gap-2">
                  <span className="text-sm">✋</span>
                  <span className="text-xs font-semibold text-[#8ab4f8]">
                    {mediaRequests.length} request{mediaRequests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setMediaRequests([])}
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                {mediaRequests.map((req) => (
                  <div
                    key={`${req.student_id}_${req.type}`}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 transition-colors border-b border-[#3c4043]/30 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs">{req.type === 'mic' ? (req.desired ? '🔇' : '🎙️') : (req.desired ? '📷' : '🚫')}</span>
                      <span className="truncate text-xs text-[#e8eaed]">
                        <strong>{req.student_name}</strong>{' '}
                        wants to {req.desired ? 'turn on' : 'turn off'} {req.type}
                      </span>
                    </div>
                    <div className="flex gap-1.5 ml-2 shrink-0">
                      <button
                        onClick={() => approveRequest(req)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => denyRequest(req)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Leave requests (floating bottom-left, stacked below media requests) ── */}
          {leaveRequests.length > 0 && (
            <div className={cn(
              'absolute left-3 z-40 w-[300px] rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/[0.08] overflow-hidden',
              mediaRequests.length > 0 ? 'bottom-[calc(0.75rem+280px)]' : 'bottom-3',
            )}>
              <div className="flex items-center justify-between px-3 py-2 bg-[#ea4335]/10 border-b border-[#3c4043]">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚪</span>
                  <span className="text-xs font-semibold text-[#f28b82]">
                    {leaveRequests.length} leave request{leaveRequests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setLeaveRequests([])}
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                {leaveRequests.map((req) => (
                  <div
                    key={req.student_id}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[#3c4043]/40 transition-colors border-b border-[#3c4043]/30 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs">🚪</span>
                      <span className="truncate text-xs text-[#e8eaed]">
                        <strong>{req.student_name}</strong> wants to leave
                      </span>
                    </div>
                    <div className="flex gap-1.5 ml-2 shrink-0">
                      <button
                        onClick={() => approveLeave(req)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/30 transition-colors"
                      >
                        Allow
                      </button>
                      <button
                        onClick={() => denyLeave(req)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/30 transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Hand-raise queue (floating bottom-right) ── */}
          {handCount > 0 && (
            <div className="absolute bottom-3 right-3 z-40 w-[260px] rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/[0.08] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#f9ab00]/10 border-b border-[#3c4043]">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🖐</span>
                  <span className="text-xs font-semibold text-[#f9ab00]">
                    {handCount} hand{handCount !== 1 ? 's' : ''} raised
                  </span>
                </div>
                <button
                  onClick={dismissAllHands}
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[#9aa0a6] hover:text-white hover:bg-[#3c4043] transition-colors"
                >
                  Lower all
                </button>
              </div>
              {/* List — max 4 visible, scrollable */}
              <div className="max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
                {sortedHands.map(([id, info]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#3c4043]/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f9ab00]/20 text-xs">🖐</span>
                      <span className="truncate text-xs font-medium text-[#e8eaed]">{info.name}</span>
                    </div>
                    <button
                      onClick={() => dismissHand(id)}
                      title="Lower hand"
                      className="ml-2 flex h-6 w-6 items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tablet connection badge */}
          {teacherScreenDevice && isLive && (
            <div className="mx-2 mb-1 flex items-center gap-2 rounded-lg bg-[#34a853]/10 px-3 py-1.5 text-xs text-[#34a853]">
              <span className="h-2 w-2 rounded-full bg-[#34a853] animate-pulse" />
              Tablet connected — screen share from {teacherScreenDevice.name || 'tablet'}
            </div>
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────── */}
        {sidebarOpen && (
          <div className="flex w-[320px] flex-col border-l border-[#3c4043] bg-[#202124]">
            {/* Tab buttons */}
            <div className="flex border-b border-[#3c4043]">
              {(['chat', 'participants'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
                    sidebarTab === tab
                      ? 'bg-[#3c4043] text-[#e8eaed]'
                      : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
                  )}
                >
                  {tab === 'chat' ? '💬 Chat' : '👥 Participants'}
                </button>
              ))}
            </div>

            {/* Tab content */}
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
                  mutedStudents={mutedStudents}
                  onToggleMute={toggleStudentMute}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Control Bar ─────────────────────────────────── */}
      <ControlBar
        role="teacher"
        roomId={roomId}
        whiteboardActive={whiteboardActive}
        onToggleWhiteboard={() => setWhiteboardActive(!whiteboardActive)}
        onEndClass={onEndClass}
      />
    </div>
  );
}

// ─── Helper sub-component ─────────────────────────────────

/** Status indicator dot + label for the Go Live banner */
function StatusDot({
  active,
  label,
  pendingLabel,
}: {
  active: boolean;
  label: string;
  pendingLabel?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          active ? 'bg-[#34a853] animate-pulse' : 'bg-[#5f6368]',
        )}
      />
      <span className={active ? 'text-[#e8eaed]' : 'text-[#9aa0a6]'}>
        {active ? label : (pendingLabel ?? label)}
      </span>
    </span>
  );
}



