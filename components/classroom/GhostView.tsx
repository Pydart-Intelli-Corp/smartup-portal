'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  useRemoteParticipants,
  useDataChannel,
  AudioTrack,
  VideoTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { RemoteParticipant } from 'livekit-client';
import VideoTile from './VideoTile';
import WhiteboardComposite from './WhiteboardComposite';
import ChatPanel from './ChatPanel';
import AttendancePanel from './AttendancePanel';
import ParticipantList from './ParticipantList';
import { cn, fmtDateLongIST } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   GhostView — Full-featured silent observation view
   Features: AI attention monitoring, click-to-enlarge students,
   hand-raise tracking, sidebar (Chat/People/Attendance/AI), toasts,
   notes, student audio, monitoring alerts
   ═══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────
interface StudentAttentionState {
  email: string;
  name: string;
  attentionScore: number;
  isAttentive: boolean;
  faceDetected: boolean;
  monitorState?: string;
  lastUpdate: number;
}

interface AIToast {
  id: string;
  message: string;
  severity: 'warning' | 'danger';
  time: number;
}

interface MonitoringAlert {
  id: string;
  title: string;
  message: string;
  severity: string;
  alert_type: string;
  created_at: string;
}

export interface GhostViewProps {
  roomId: string;
  roomName: string;
  observerName: string;
  observerRole: string;
  scheduledStart?: string;
  durationMinutes?: number;
  onLeave: () => void;
}

// ── Grid cols helper ───────────────────────────────────────────
const gridCols = (n: number) =>
  n <= 1 ? 'grid-cols-1'
  : n <= 4 ? 'grid-cols-2'
  : n <= 9 ? 'grid-cols-3'
  : 'grid-cols-4';

// ── Format elapsed time ────────────────────────────────────────
function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export default function GhostView({
  roomId,
  roomName,
  observerName,
  observerRole,
  scheduledStart,
  durationMinutes,
  onLeave,
}: GhostViewProps) {
  // ── Basic state ────────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | 'attendance' | 'monitoring'>('monitoring');
  const [focusedParticipant, setFocusedParticipant] = useState<RemoteParticipant | null>(null);
  const remoteParticipants = useRemoteParticipants();

  // ── AI state ────────────────────────────────────────────────
  const [studentAttention, setStudentAttention] = useState<Map<string, StudentAttentionState>>(new Map());
  const [aiToasts, setAiToasts] = useState<AIToast[]>([]);
  const lastAlertedRef = useRef<Map<string, number>>(new Map());
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringAlert[]>([]);

  // ── Hand raise state ────────────────────────────────────────
  const [raisedHands, setRaisedHands] = useState<Map<string, { name: string; time: number }>>(new Map());
  const processedHandIds = useRef(new Set<string>());

  // ── Timer ───────────────────────────────────────────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const elapsedSec = useMemo(() => {
    if (!scheduledStart) return 0;
    const start = new Date(scheduledStart).getTime();
    if (isNaN(start)) return 0;
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [scheduledStart, now]);

  const remainingSec = useMemo(() => {
    if (!scheduledStart || !durationMinutes) return null;
    const end = new Date(scheduledStart).getTime() + durationMinutes * 60_000;
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [scheduledStart, durationMinutes, now]);

  // ── Participants ────────────────────────────────────────────
  const teacher = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        return (meta.effective_role || meta.portal_role) === 'teacher';
      } catch {
        return p.identity.startsWith('teacher');
      }
    });
  }, [remoteParticipants]);

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

  // ── Track publications ──────────────────────────────────────
  const teacherScreen = teacher?.getTrackPublication(Track.Source.ScreenShare);
  const hasScreenShare = !!teacherScreen && !teacherScreen.isMuted;
  const teacherCamera = teacher?.getTrackPublication(Track.Source.Camera);
  const hasTeacherCamera = !!teacherCamera && !teacherCamera.isMuted;

  // ── AI Attention data channel ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAttentionUpdate = useCallback((msg: any) => {
    try {
      const text = new TextDecoder().decode(msg?.payload);
      const data = JSON.parse(text) as {
        studentEmail: string;
        studentName: string;
        attentionScore: number;
        isAttentive: boolean;
        faceDetected: boolean;
        monitorState?: string;
      };
      setStudentAttention((prev) => {
        const next = new Map(prev);
        next.set(data.studentEmail, {
          email: data.studentEmail,
          name: data.studentName,
          attentionScore: data.attentionScore,
          isAttentive: data.isAttentive,
          faceDetected: data.faceDetected,
          monitorState: data.monitorState,
          lastUpdate: Date.now(),
        });
        return next;
      });

      // AI toast alerts for critical states
      const alertNow = Date.now();
      const lastAlert = lastAlertedRef.current.get(data.studentEmail) ?? 0;
      if (alertNow - lastAlert > 15_000) {
        const state = data.monitorState?.toLowerCase() ?? '';
        const score = data.attentionScore;
        let toastMsg = '';
        let severity: 'warning' | 'danger' = 'warning';

        if (state === 'eyes_closed' || state === 'sleeping') {
          toastMsg = `${data.studentName} appears to be sleeping`;
          severity = 'danger';
        } else if (!data.faceDetected) {
          toastMsg = `${data.studentName} is not in frame`;
          severity = 'danger';
        } else if (score < 30) {
          toastMsg = `${data.studentName} has low attention (${Math.round(score)}%)`;
          severity = 'warning';
        }

        if (toastMsg) {
          lastAlertedRef.current.set(data.studentEmail, alertNow);
          setAiToasts(prev => [
            ...prev.slice(-4),
            { id: `${data.studentEmail}-${alertNow}`, message: toastMsg, severity, time: alertNow },
          ]);
        }
      }
    } catch { /* silent — ghost is read-only */ }
  }, []);

  useDataChannel('attention_update', onAttentionUpdate);

  // Auto-dismiss toasts
  useEffect(() => {
    if (aiToasts.length === 0) return;
    const timer = setTimeout(() => {
      setAiToasts(prev => prev.filter(t => Date.now() - t.time < 5000));
    }, 5000);
    return () => clearTimeout(timer);
  }, [aiToasts]);

  // Clean up departed students from attention map
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setStudentAttention((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!activeIds.has(key)) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [remoteParticipants]);

  // ── Hand raise data channel ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHandRaise = useCallback((msg: any) => {
    try {
      const payload = msg?.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text) as { student_id: string; student_name: string; action: 'raise' | 'lower' };
      const key = `${data.student_id}_${data.action}_${Math.floor(Date.now() / 500)}`;
      if (processedHandIds.current.has(key)) return;
      processedHandIds.current.add(key);
      if (processedHandIds.current.size > 200) {
        const arr = Array.from(processedHandIds.current);
        processedHandIds.current = new Set(arr.slice(-100));
      }
      setRaisedHands((prev) => {
        const next = new Map(prev);
        if (data.action === 'raise') {
          next.set(data.student_id, { name: data.student_name, time: Date.now() });
        } else {
          next.delete(data.student_id);
        }
        return next;
      });
    } catch { /* silent */ }
  }, []);

  useDataChannel('hand_raise', onHandRaise);

  // Clean departed students from hand-raise map
  useEffect(() => {
    const activeIds = new Set(remoteParticipants.map((p) => p.identity));
    setRaisedHands((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!activeIds.has(id)) { next.delete(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [remoteParticipants]);

  const handCount = raisedHands.size;
  const sortedHands = useMemo(() => {
    return Array.from(raisedHands.entries()).sort((a, b) => a[1].time - b[1].time);
  }, [raisedHands]);

  // ── Server monitoring alerts polling ───────────────────────
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/v1/monitoring/session/${roomId}`);
        const data = await res.json();
        if (data.success && data.data?.alerts) {
          setMonitoringAlerts(data.data.alerts.slice(0, 5));
        }
      } catch { /* silent */ }
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(iv);
  }, [roomId]);

  // ── Notes download ─────────────────────────────────────────
  const downloadNotes = () => {
    const content = `SmartUp Observation Notes
Batch: ${roomName} (${roomId})
Observer: ${observerName} (${observerRole})
Date: ${fmtDateLongIST(new Date())}
──────────────────────────────────────────
${notes}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartup_notes_${roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Avg engagement score ───────────────────────────────────
  const avgEngagement = useMemo(() => {
    const scores = Array.from(studentAttention.values());
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((s, a) => s + a.attentionScore, 0) / scores.length);
  }, [studentAttention]);

  // ── Camera-on count ────────────────────────────────────────
  const camerasOn = useMemo(() => {
    return students.filter((s) => {
      const cam = s.getTrackPublication(Track.Source.Camera);
      return cam && !cam.isMuted;
    }).length;
  }, [students]);

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen flex-col bg-[#1a1a1d] text-white select-none">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex h-12 items-center justify-between border-b border-[#3c4043] bg-[#202124] px-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm">👻</span>
          <span className="text-sm font-semibold text-[#e8eaed]">{roomName}</span>
          <span className="text-xs text-[#9aa0a6]">— Observing as {observerName}</span>
          {/* Timer */}
          {scheduledStart && (
            <div className="flex items-center gap-2 ml-3 text-xs text-[#9aa0a6]">
              <span>⏱ {fmtElapsed(elapsedSec)}</span>
              {remainingSec !== null && (
                <span className={cn('font-mono', remainingSec <= 300 ? 'text-red-400 font-bold' : '')}>
                  ({fmtElapsed(remainingSec)} left)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Stats chips */}
          <span className="flex items-center gap-1.5 rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6]">
            👥 {students.length}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6]">
            📷 {camerasOn}
          </span>
          {handCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-600/20 px-2.5 py-1 text-xs text-amber-400">
              ✋ {handCount}
            </span>
          )}
          {/* Engagement badge */}
          {studentAttention.size > 0 && (
            <span className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
              avgEngagement >= 70 ? 'bg-green-600/20 text-green-400' :
              avgEngagement >= 40 ? 'bg-amber-600/20 text-amber-400' :
              'bg-red-600/20 text-red-400',
            )}>
              🧠 {avgEngagement}%
            </span>
          )}
          <div className="h-5 w-px bg-[#3c4043]" />
          <span className="flex items-center gap-1 rounded-full bg-emerald-600/20 px-2.5 py-1 text-xs text-emerald-400">
            👁 Invisible
          </span>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs transition-colors',
              audioEnabled ? 'bg-blue-600/20 text-blue-400' : 'bg-[#292a2d] text-[#9aa0a6]'
            )}
          >
            {audioEnabled ? '🔊 Audio' : '🔇 Muted'}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-full bg-[#292a2d] px-2.5 py-1 text-xs text-[#9aa0a6] hover:text-white"
          >
            {sidebarOpen ? '→ Hide' : '← Panel'}
          </button>
          <button
            onClick={onLeave}
            className="rounded-full bg-[#ea4335] px-3 py-1 text-xs font-medium text-white hover:bg-[#c5221f]"
          >
            Leave
          </button>
        </div>
      </div>

      {/* ── MAIN BODY ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Content area ───────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Focus overlay — enlarged participant */}
          {focusedParticipant ? (
            <div className="relative flex-1 flex items-center justify-center bg-black p-4">
              <button
                onClick={() => setFocusedParticipant(null)}
                className="absolute top-4 right-4 z-10 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80 backdrop-blur-sm"
              >
                ✕ Close
              </button>
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                <span>{focusedParticipant.name || focusedParticipant.identity}</span>
                {(() => {
                  const att = studentAttention.get(focusedParticipant.identity);
                  if (!att) return null;
                  return (
                    <span className={cn(
                      'font-bold',
                      att.attentionScore >= 70 ? 'text-green-400' :
                      att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400',
                    )}>
                      🧠 {att.attentionScore}%
                    </span>
                  );
                })()}
              </div>
              {(() => {
                const cam = focusedParticipant.getTrackPublication(Track.Source.Camera);
                if (cam && !cam.isMuted && cam.track) {
                  return (
                    <VideoTrack
                      trackRef={{
                        participant: focusedParticipant,
                        publication: cam,
                        source: Track.Source.Camera,
                      } as TrackReference}
                      className="max-h-full max-w-full rounded-xl object-contain"
                    />
                  );
                }
                return (
                  <div className="flex flex-col items-center justify-center text-[#9aa0a6] gap-3">
                    <div className="h-32 w-32 rounded-full bg-[#3c4043] flex items-center justify-center text-4xl">
                      {(focusedParticipant.name || focusedParticipant.identity).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">Camera off</span>
                  </div>
                );
              })()}
              {/* Audio for focused participant */}
              {audioEnabled && (() => {
                const mic = focusedParticipant.getTrackPublication(Track.Source.Microphone);
                if (mic && !mic.isMuted && mic.track) {
                  return (
                    <AudioTrack
                      trackRef={{
                        participant: focusedParticipant,
                        publication: mic,
                        source: Track.Source.Microphone,
                      } as TrackReference}
                    />
                  );
                }
                return null;
              })()}
              {/* Prev/Next navigation dots */}
              {students.length > 1 && (
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                  {students.map((s) => (
                    <button
                      key={s.identity}
                      onClick={() => setFocusedParticipant(s)}
                      className={cn(
                        'h-2 w-2 rounded-full transition-all',
                        s.identity === focusedParticipant.identity ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60',
                      )}
                      title={s.name || s.identity}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : hasScreenShare && teacher ? (
            /* ── Whiteboard / Screen share ─────────────────── */
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-hidden p-2">
                <WhiteboardComposite
                  teacher={teacher}
                  className="h-full w-full rounded-lg"
                />
              </div>
              {/* Student strip on right when whiteboard active */}
              <div className="w-[160px] shrink-0 border-l border-[#3c4043] overflow-y-auto p-1.5 space-y-1.5">
                {teacher && (
                  <div className="relative rounded-lg overflow-hidden bg-[#292a2d]" style={{ aspectRatio: '16/10' }}>
                    <VideoTile participant={teacher} size="small" showName showMicIndicator className="w-full! h-full!" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-0.5">
                      <span className="text-[9px] text-white/90">🎓 Teacher</span>
                    </div>
                  </div>
                )}
                {students.map((s) => {
                  const att = studentAttention.get(s.identity);
                  return (
                    <div
                      key={s.identity}
                      className={cn(
                        'relative rounded-lg overflow-hidden bg-[#292a2d] cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all',
                        att?.monitorState === 'eyes_closed' && 'ring-1 ring-red-500/60',
                        raisedHands.has(s.identity) && 'ring-1 ring-amber-500/60',
                      )}
                      style={{ aspectRatio: '16/10' }}
                      onClick={() => setFocusedParticipant(s)}
                    >
                      <VideoTile participant={s} size="small" showName showMicIndicator playAudio={audioEnabled} className="w-full! h-full!" />
                      {att && (
                        <div className={cn(
                          'absolute top-0.5 right-0.5 z-10 rounded-full px-1 py-0.5 text-[8px] font-bold backdrop-blur-sm',
                          att.monitorState === 'eyes_closed' ? 'bg-red-600/80 text-white' :
                          att.attentionScore < 50 ? 'bg-amber-500/80 text-white' :
                          'bg-green-600/70 text-white'
                        )}>
                          {att.attentionScore}%
                        </div>
                      )}
                      {raisedHands.has(s.identity) && (
                        <div className="absolute top-0.5 left-0.5 z-10 text-[10px]">🖐</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Camera-only mode: Full student grid ───────── */
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              {/* Teacher tile at top if available */}
              {hasTeacherCamera && teacher ? (
                <div className="shrink-0 mb-3 flex justify-center">
                  <div className="relative rounded-xl overflow-hidden bg-[#292a2d] cursor-pointer hover:ring-2 hover:ring-blue-500/50"
                    style={{ width: 320, height: 200 }}
                    onClick={() => teacher && setFocusedParticipant(teacher)}>
                    <VideoTile participant={teacher} size="large" showName showMicIndicator playAudio={audioEnabled} className="w-full! h-full!" />
                    <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-blue-600/80 px-2 py-0.5 text-[9px] text-white font-semibold">
                      🎓 Teacher
                    </div>
                  </div>
                </div>
              ) : (
                <div className="shrink-0 mb-3 flex items-center justify-center py-8 text-[#9aa0a6]">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📚</div>
                    <span className="text-sm">{teacher ? 'Audio only — no camera' : 'Waiting for teacher...'}</span>
                  </div>
                </div>
              )}

              {/* Student grid */}
              <div className={cn('grid flex-1 w-full gap-2 auto-rows-fr', gridCols(students.length))}>
                {students.map((s) => {
                  const att = studentAttention.get(s.identity);
                  const attScore = att?.attentionScore ?? 100;
                  const isSleeping = att?.monitorState === 'eyes_closed';
                  const isNotLooking = att?.monitorState === 'looking_away';
                  const isLowAtt = attScore < 50;

                  return (
                    <div
                      key={s.identity}
                      className={cn(
                        'relative group min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#292a2d] cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all',
                        isSleeping && 'ring-2 ring-red-500/60',
                        isNotLooking && !isSleeping && 'ring-2 ring-amber-500/60',
                      )}
                      onClick={() => setFocusedParticipant(s)}
                    >
                      <VideoTile
                        participant={s}
                        size="large"
                        showName
                        showMicIndicator
                        playAudio={audioEnabled}
                        handRaised={raisedHands.has(s.identity)}
                        className="rounded-xl!"
                      />
                      {/* AI Attention badge */}
                      {att && (
                        <div className={cn(
                          'absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm shadow-sm',
                          isSleeping ? 'bg-red-600/80 text-white' :
                          isLowAtt ? 'bg-amber-500/80 text-white' :
                          'bg-green-600/70 text-white'
                        )}>
                          {isSleeping ? '💤' : isNotLooking ? '👀' : attScore >= 75 ? '✓' : '⚠'}
                          <span>{attScore}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {students.length === 0 && (
                  <div className="col-span-full flex items-center justify-center text-[#9aa0a6] py-16">
                    No students have joined yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teacher audio (always render if enabled) */}
          {audioEnabled && teacher && teacher.getTrackPublication(Track.Source.Microphone)?.track && (
            <AudioTrack
              trackRef={{
                participant: teacher,
                publication: teacher.getTrackPublication(Track.Source.Microphone)!,
                source: Track.Source.Microphone,
              } as TrackReference}
            />
          )}
          {/* Student audio tracks when not in focused mode (focused has its own audio) */}
          {audioEnabled && !focusedParticipant && students.map((s) => {
            const mic = s.getTrackPublication(Track.Source.Microphone);
            if (!mic || mic.isMuted || !mic.track) return null;
            return (
              <AudioTrack
                key={`audio-${s.identity}`}
                trackRef={{
                  participant: s,
                  publication: mic,
                  source: Track.Source.Microphone,
                } as TrackReference}
              />
            );
          })}
        </div>

        {/* ── RIGHT: Sidebar ───────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-[340px] shrink-0 flex flex-col border-l border-[#3c4043] bg-[#202124]">
            {/* Sidebar tabs */}
            <div className="flex border-b border-[#3c4043] shrink-0">
              {(['chat', 'participants', 'attendance', 'monitoring'] as const).map((tab) => (
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
                  {tab === 'chat' ? '💬 Chat'
                    : tab === 'participants' ? '👥 People'
                    : tab === 'attendance' ? '📋 Attend.'
                    : `🧠 AI${monitoringAlerts.length > 0 ? ` (${monitoringAlerts.length})` : ''}`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'chat' ? (
                <ChatPanel roomId={roomId} participantName={observerName} participantRole="ghost" />
              ) : sidebarTab === 'participants' ? (
                <ParticipantList role="ghost" roomId={roomId} />
              ) : sidebarTab === 'attendance' ? (
                <AttendancePanel roomId={roomId} />
              ) : (
                /* ── AI Monitoring Panel ─────────────────────── */
                <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                  <div className="text-xs font-semibold text-[#8ab4f8]">🧠 AI Session Monitor</div>

                  {/* Class engagement score */}
                  <div className="rounded-lg bg-[#292a2d] p-3">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Session Engagement</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 rounded-full bg-[#3c4043] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', avgEngagement >= 70 ? 'bg-green-500' : avgEngagement >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${avgEngagement}%` }}
                        />
                      </div>
                      <span className={cn('text-sm font-bold', avgEngagement >= 70 ? 'text-green-400' : avgEngagement >= 40 ? 'text-amber-400' : 'text-red-400')}>
                        {avgEngagement}%
                      </span>
                    </div>
                  </div>

                  {/* Raised hands */}
                  {handCount > 0 && (
                    <div className="rounded-lg bg-amber-950/30 border border-amber-600/30 p-2.5 space-y-1.5">
                      <div className="text-[10px] text-amber-400 uppercase tracking-wide">✋ Hands Raised ({handCount})</div>
                      {sortedHands.map(([id, h]) => (
                        <div key={id} className="flex items-center justify-between text-xs text-[#e8eaed]">
                          <span className="truncate">{h.name}</span>
                          <span className="text-[10px] text-[#9aa0a6]">{fmtElapsed(Math.floor((now - h.time) / 1000))} ago</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Per-student attention cards */}
                  {Array.from(studentAttention.values())
                    .sort((a, b) => a.attentionScore - b.attentionScore)
                    .map((att) => (
                      <div key={att.email} className={cn(
                        'rounded-lg border p-2.5',
                        att.monitorState === 'eyes_closed' ? 'border-red-600/50 bg-red-950/30' :
                        att.attentionScore < 50 ? 'border-amber-600/50 bg-amber-950/30' :
                        'border-[#3c4043] bg-[#292a2d]',
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[#e8eaed] truncate">{att.name}</span>
                          <span className={cn('text-xs font-bold',
                            att.attentionScore >= 70 ? 'text-green-400' :
                            att.attentionScore >= 40 ? 'text-amber-400' : 'text-red-400',
                          )}>
                            {att.attentionScore}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#9aa0a6]">
                          {att.monitorState === 'eyes_closed' && <span className="text-red-400">😴 Sleeping</span>}
                          {att.monitorState === 'looking_away' && <span className="text-amber-400">👀 Looking Away</span>}
                          {att.monitorState === 'not_in_frame' && <span className="text-amber-400">🚫 Not in Frame</span>}
                          {att.monitorState === 'distracted' && <span className="text-amber-400">😵 Distracted</span>}
                          {att.monitorState === 'low_engagement' && <span className="text-amber-400">📉 Low Engagement</span>}
                          {(att.monitorState === 'attentive' || !att.monitorState) && <span className="text-green-400">✅ Attentive</span>}
                          {!att.faceDetected && <span className="text-red-400 ml-1">• No face</span>}
                        </div>
                      </div>
                    ))}

                  {studentAttention.size === 0 && (
                    <div className="text-center py-8 text-xs text-[#9aa0a6]">Waiting for student attention data...</div>
                  )}

                  {/* Server alerts */}
                  {monitoringAlerts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide">Server Alerts</div>
                      {monitoringAlerts.map((alert) => (
                        <div key={alert.id} className={cn(
                          'rounded-lg border p-2 text-[11px]',
                          alert.severity === 'critical' ? 'border-red-600/50 bg-red-950/30 text-red-300' :
                          'border-amber-600/50 bg-amber-950/30 text-amber-300',
                        )}>
                          <div className="font-semibold">{alert.title}</div>
                          <div className="text-[10px] mt-0.5 opacity-80">{alert.message}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes section in AI tab */}
                  <div className="mt-3 pt-3 border-t border-[#3c4043]">
                    <div className="text-[10px] text-[#9aa0a6] uppercase tracking-wide mb-2">📝 Private Notes</div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
                      placeholder="Type observation notes..."
                      className="h-24 w-full rounded-lg bg-[#292a2d] p-2 text-sm text-[#e8eaed] placeholder:text-[#5f6368] outline-none focus:ring-1 focus:ring-[#8ab4f8] resize-none"
                      maxLength={5000}
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-[#5f6368]">{notes.length}/5000</span>
                      <button
                        onClick={downloadNotes}
                        disabled={!notes.trim()}
                        className="text-xs text-[#8ab4f8] hover:text-blue-300 disabled:opacity-30"
                      >
                        💾 Save .txt
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Toast Notifications ─────────────────────────── */}
      {aiToasts.length > 0 && (
        <div className="fixed top-16 right-3 z-[100] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 340 }}>
          {aiToasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-lg px-4 py-2.5 shadow-lg text-sm font-medium flex items-center gap-2',
                toast.severity === 'danger'
                  ? 'bg-red-600/90 text-white border border-red-500/50'
                  : 'bg-amber-600/90 text-white border border-amber-500/50'
              )}
            >
              <span className="text-base">{toast.severity === 'danger' ? '🚨' : '⚠️'}</span>
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => setAiToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-2 text-white/70 hover:text-white text-lg leading-none pointer-events-auto"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
