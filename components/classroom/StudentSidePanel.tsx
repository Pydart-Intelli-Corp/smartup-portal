'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import ChatPanel, { type ChatPanelProps } from './ChatPanel';

/**
 * StudentSidePanel — Tabbed sidebar for students: Chat | My Attendance | Join Logs.
 * Wraps ChatPanel + fetches attendance data from the API.
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
}

interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

interface StudentSidePanelProps extends ChatPanelProps {
  roomId: string;
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
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

const EVENT_ICONS: Record<string, string> = {
  join: '🟢',
  rejoin: '🔄',
  leave: '🔴',
  late_join: '⏰',
  leave_request: '🚪',
  leave_approved: '✅',
  leave_denied: '❌',
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Present' },
  late: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Late' },
  absent: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Absent' },
  left_early: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Left Early' },
};

export default function StudentSidePanel(props: StudentSidePanelProps) {
  const { roomId, onClose, ...chatProps } = props;
  const [tab, setTab] = useState<'chat' | 'attendance' | 'logs'>('chat');
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [logs, setLogs] = useState<JoinLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/room/${roomId}/attendance`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const att = json.data.attendance as AttendanceRecord[];
        setRecord(att[0] ?? null); // student sees only their own record
        setLogs(json.data.logs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Fetch on tab switch and auto-refresh every 30s when on attendance/logs tab
  useEffect(() => {
    if (tab === 'chat') return;
    if (!fetched.current) {
      fetchData();
      fetched.current = true;
    }
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [tab, fetchData]);

  const tabs = [
    { key: 'chat' as const, label: '💬 Chat' },
    { key: 'attendance' as const, label: '📋 Status' },
    { key: 'logs' as const, label: '📜 Logs' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#202124]">
      {/* Header with close + tabs */}
      <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-1.5">
        <div className="flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                tab === t.key
                  ? 'bg-[#3c4043] text-[#e8eaed]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#292a2d]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#9aa0a6] hover:text-white text-sm ml-2">
            ✕
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'chat' && (
        <ChatPanel
          roomId={roomId}
          onClose={undefined}
          {...chatProps}
          className="flex-1"
        />
      )}

      {tab === 'attendance' && (
        <div className="flex-1 overflow-y-auto p-4">
          {loading && !record ? (
            <div className="text-center text-xs text-[#9aa0a6] mt-8">Loading...</div>
          ) : !record ? (
            <div className="text-center text-xs text-[#9aa0a6] mt-8">
              No attendance data yet
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status card */}
              <div className="rounded-xl bg-[#292a2d] p-4 ring-1 ring-[#3c4043]/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#e8eaed]">My Attendance</span>
                  {(() => {
                    const st = STATUS_STYLE[record.status] || STATUS_STYLE.absent;
                    return (
                      <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', st.bg, st.text)}>
                        {st.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoCell label="Joined at" value={fmtTime(record.first_join_at)} />
                  <InfoCell label="Duration" value={fmtDuration(record.total_duration_sec)} />
                  <InfoCell
                    label="Late?"
                    value={record.late_join ? `Yes (${fmtDuration(record.late_by_sec)})` : 'No'}
                    warn={record.late_join}
                  />
                  <InfoCell label="Rejoins" value={`${record.join_count}×`} />
                </div>

                {record.leave_approved !== null && (
                  <div className="mt-3 text-xs">
                    <span className={record.leave_approved ? 'text-emerald-400' : 'text-red-400'}>
                      {record.leave_approved ? '✅ Leave approved' : '❌ Leave denied'}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full rounded-lg bg-[#3c4043] py-2 text-xs text-[#9aa0a6] hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="text-center text-xs text-[#9aa0a6] mt-8">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-xs text-[#9aa0a6] mt-8">No join logs yet</div>
          ) : (
            <div className="divide-y divide-[#3c4043]/30">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2.5 hover:bg-[#3c4043]/20 transition-colors">
                  <span className="text-sm mt-0.5 shrink-0">{EVENT_ICONS[log.event_type] || '📌'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[#e8eaed]">
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9aa0a6]">{fmtTime(log.event_at)}</span>
                    {log.payload && log.event_type === 'late_join' && (
                      <span className="ml-1.5 text-[10px] text-amber-400">
                        ({fmtDuration(Number((log.payload as Record<string, number>).late_by_sec || 0))} late)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-[#202124] px-3 py-2">
      <div className="text-[10px] text-[#9aa0a6] mb-0.5">{label}</div>
      <div className={cn('text-sm font-medium', warn ? 'text-amber-400' : 'text-[#e8eaed]')}>
        {value}
      </div>
    </div>
  );
}
