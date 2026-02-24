'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';
import { cn } from '@/lib/utils';

/**
 * AttendancePanel — Live attendance tracker in teacher sidebar.
 *
 * Features:
 *   - Real-time presence (green dot = connected, gray = disconnected)
 *   - Join time, duration, rejoin count per student
 *   - Late join indicator with seconds late
 *   - Leave-approved badge
 *   - Summary stats bar (present / late / left early)
 *   - Auto-refreshes from DB every 15s + on-demand refresh
 *   - Tabs: Live View | Join Logs
 */

interface AttendanceRecord {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  status: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  late_join: boolean;
  late_by_sec: number;
  leave_approved: boolean | null;
  teacher_remarks: string | null;
}

interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

interface AttendanceSummary {
  total_students: number;
  present: number;
  late: number;
  absent: number;
  left_early: number;
  avg_duration_sec: number;
}

export interface AttendancePanelProps {
  roomId: string;
  className?: string;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch { return '—'; }
}

const EVENT_ICONS: Record<string, string> = {
  join: '🟢',
  rejoin: '🔄',
  leave: '🔴',
  late_join: '⏰',
  leave_request: '🚪',
  leave_approved: '✅',
  leave_denied: '❌',
  kicked: '⛔',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  present:    { bg: 'bg-[#34a853]/15', text: 'text-[#34a853]', label: 'Present' },
  late:       { bg: 'bg-[#f9ab00]/15', text: 'text-[#f9ab00]', label: 'Late' },
  absent:     { bg: 'bg-[#ea4335]/15', text: 'text-[#ea4335]', label: 'Absent' },
  left_early: { bg: 'bg-[#8ab4f8]/15', text: 'text-[#8ab4f8]', label: 'Left Early' },
  excused:    { bg: 'bg-[#9aa0a6]/15', text: 'text-[#9aa0a6]', label: 'Excused' },
};

export default function AttendancePanel({ roomId, className }: AttendancePanelProps) {
  const [tab, setTab] = useState<'live' | 'logs'>('live');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<JoinLogEntry[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remotes = useRemoteParticipants();

  // Set of currently connected participant identities
  const connectedIds = useMemo(
    () => new Set(remotes.map((p) => p.identity)),
    [remotes],
  );

  // Fetch attendance data from API
  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/room/${roomId}/attendance`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setAttendance(json.data.attendance || []);
        setLogs(json.data.logs || []);
        setSummary(json.data.summary || null);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    fetchAttendance();
    intervalRef.current = setInterval(fetchAttendance, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAttendance]);

  // Filter students only for the live tab
  const studentRecords = useMemo(
    () => attendance.filter((a) => a.participant_role === 'student'),
    [attendance],
  );

  const teacherRecord = useMemo(
    () => attendance.find((a) => a.participant_role === 'teacher') ?? null,
    [attendance],
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-[#3c4043] bg-[#292a2d]">
          <StatBadge label="Present" count={summary.present} color="text-[#34a853]" />
          <StatBadge label="Late" count={summary.late} color="text-[#f9ab00]" />
          <StatBadge label="Absent" count={summary.absent} color="text-[#ea4335]" />
          <StatBadge label="Left" count={summary.left_early} color="text-[#8ab4f8]" />
          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] text-[#9aa0a6] hover:bg-[#3c4043] hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex border-b border-[#3c4043]">
        {(['live', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-[11px] font-medium capitalize transition-colors',
              tab === t
                ? 'bg-[#3c4043] text-[#e8eaed]'
                : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
            )}
          >
            {t === 'live' ? '📋 Attendance' : '📜 Join Logs'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#3c4043]">
        {tab === 'live' ? (
          studentRecords.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-[#9aa0a6]">
              No attendance data yet
            </div>
          ) : (
            <div className="divide-y divide-[#3c4043]/30">
              {/* Teacher row (if exists) */}
              {teacherRecord && (
                <AttendanceRow
                  record={teacherRecord}
                  isConnected={connectedIds.has(teacherRecord.participant_email)}
                  isTeacher
                />
              )}
              {/* Student rows */}
              {studentRecords.map((rec) => (
                <AttendanceRow
                  key={rec.participant_email}
                  record={rec}
                  isConnected={connectedIds.has(rec.participant_email)}
                />
              ))}
            </div>
          )
        ) : (
          logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-[#9aa0a6]">
              No join logs yet
            </div>
          ) : (
            <div className="divide-y divide-[#3c4043]/30">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-[#3c4043]/20 transition-colors">
                  <span className="text-sm mt-0.5 shrink-0">{EVENT_ICONS[log.event_type] || '📌'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[#e8eaed] truncate">
                        {log.participant_name || log.participant_email}
                      </span>
                      <span className="text-[10px] text-[#9aa0a6]">
                        {log.event_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9aa0a6]">{fmtTime(log.event_at)}</span>
                    {log.payload && log.event_type === 'late_join' && (
                      <span className="ml-1.5 text-[10px] text-[#f9ab00]">
                        ({fmtDuration(Number((log.payload as Record<string, number>).late_by_sec || 0))} late)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function AttendanceRow({
  record: r,
  isConnected,
  isTeacher,
}: {
  record: AttendanceRecord;
  isConnected: boolean;
  isTeacher?: boolean;
}) {
  const st = STATUS_COLORS[r.status] || STATUS_COLORS.absent;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#3c4043]/20 transition-colors">
      {/* Avatar + connection indicator */}
      <div className="relative shrink-0">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
          isTeacher ? 'bg-[#1a73e8]/20 text-[#8ab4f8]' : 'bg-[#5f6368]/30 text-[#e8eaed]',
        )}>
          {(r.participant_name || '?').charAt(0).toUpperCase()}
        </div>
        {/* Connection dot */}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#202124]',
            isConnected ? 'bg-[#34a853]' : 'bg-[#5f6368]',
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#e8eaed] truncate">
            {r.participant_name}
          </span>
          {isTeacher && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#1a73e8]/15 text-[#8ab4f8]">
              TEACHER
            </span>
          )}
          {/* Status badge */}
          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold', st.bg, st.text)}>
            {st.label}
          </span>
          {/* Late badge */}
          {r.late_join && (
            <span className="text-[9px] text-[#f9ab00]">
              ⏰ {fmtDuration(r.late_by_sec)} late
            </span>
          )}
        </div>
        {/* Second row: timing details */}
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-[#9aa0a6]">
            In: {fmtTime(r.first_join_at)}
          </span>
          {r.last_leave_at && (
            <span className="text-[10px] text-[#9aa0a6]">
              Out: {fmtTime(r.last_leave_at)}
            </span>
          )}
          <span className="text-[10px] text-[#9aa0a6]">
            ⏱ {fmtDuration(r.total_duration_sec)}
          </span>
          {r.join_count > 1 && (
            <span className="text-[10px] text-[#f9ab00]">
              🔄 {r.join_count}x
            </span>
          )}
          {r.leave_approved && (
            <span className="text-[10px] text-[#34a853]">✅ Excused</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn('text-sm font-bold', color)}>{count}</span>
      <span className="text-[9px] text-[#9aa0a6]">{label}</span>
    </div>
  );
}
