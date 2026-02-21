// ═══════════════════════════════════════════════════════════════
// Coordinator Dashboard — Client Component
// Monitoring-only: view rooms, attendance, observe live classes,
// send reminders. NO room creation / editing / deleting.
// Per PDF scope: Batch Coordinator monitors, does not manage.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtSmartDateIST, fmtDateTimeIST } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Clock, Users, Send, Radio, CheckCircle2,
  XCircle, Search, RefreshCw, Eye, Loader2, ChevronDown, ChevronRight,
  BookOpen, GraduationCap, Mail, UserCheck, UserX, AlertCircle,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  teacher_email: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  max_participants: number;
  notes_for_teacher: string | null;
  livekit_room_id: string | null;
  created_at: string;
  student_count?: number;
}

interface Assignment {
  id: string;
  participant_type: string;
  participant_email: string;
  participant_name: string;
  payment_status: string;
  notification_sent_at: string | null;
  joined_at: string | null;
}

interface CoordinatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string; icon: typeof Radio }> = {
  scheduled: { bg: 'bg-blue-900/40 border-blue-700',  text: 'text-blue-300',  dot: 'bg-blue-500',  icon: Calendar     },
  live:      { bg: 'bg-green-900/40 border-green-700', text: 'text-green-300', dot: 'bg-green-500', icon: Radio        },
  ended:     { bg: 'bg-gray-800 border-gray-600',      text: 'text-gray-400',  dot: 'bg-gray-500',  icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-900/40 border-red-700',     text: 'text-red-400',   dot: 'bg-red-500',   icon: XCircle      },
};

function fmtDate(iso: string) {
  return fmtSmartDateIST(iso);
}

function Avatar({ name, size = 7, color = 'bg-blue-600' }: { name: string; size?: number; color?: string }) {
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function CoordinatorDashboardClient({ userName, userEmail, userRole }: CoordinatorDashboardClientProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const router = useRouter();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/coordinator/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) { console.error('Failed to fetch rooms:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filteredRooms = rooms
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !search ||
      r.room_name.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.grade.toLowerCase().includes(search.toLowerCase())
    );

  const stats = {
    total: rooms.length,
    live: rooms.filter((r) => r.status === 'live').length,
    scheduled: rooms.filter((r) => r.status === 'scheduled').length,
    ended: rooms.filter((r) => r.status === 'ended').length,
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={[
      { label: 'Monitor', href: '/coordinator', icon: LayoutDashboard, active: true },
    ]}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Room Monitor</h1>
        <p className="text-sm text-gray-400">Track attendance, observe live classes, send reminders</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',     value: stats.total,     color: 'border-gray-700',   text: 'text-white'     },
          { label: 'Live',      value: stats.live,      color: 'border-green-700',  text: 'text-green-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'border-cyan-700',   text: 'text-cyan-400'  },
          { label: 'Ended',     value: stats.ended,     color: 'border-gray-600',   text: 'text-gray-400'  },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.color} bg-gray-900/60 p-4`}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'live', 'scheduled', 'ended', 'cancelled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? 'bg-cyan-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >{f}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search rooms, subject, grade..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <button onClick={fetchRooms}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <Calendar className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-gray-300 font-medium">No rooms found</p>
            <p className="mt-1 text-sm text-gray-500">
              {rooms.length === 0 ? 'No classes have been scheduled yet' : 'Try a different filter or search'}
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <MonitorRoomCard
              key={room.room_id}
              room={room}
              expanded={expandedRoom === room.room_id}
              onToggle={() => setExpandedRoom(expandedRoom === room.room_id ? null : room.room_id)}
              onRefresh={fetchRooms}
              router={router}
            />
          ))
        )}
      </div>
    </DashboardShell>
  );
}

function MonitorRoomCard({ room, expanded, onToggle, onRefresh, router }: {
  room: Room; expanded: boolean; onToggle: () => void; onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const badge = STATUS_BADGE[room.status] ?? STATUS_BADGE.scheduled;
  const BadgeIcon = badge.icon;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={onToggle}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${badge.bg}`}>
          <BadgeIcon className={`h-5 w-5 ${badge.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{room.room_name}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border ${badge.bg} ${badge.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />{room.status}
            </span>
            {!room.teacher_email && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <AlertCircle className="h-2.5 w-2.5" /> No teacher
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{room.subject}</span>
            <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{room.grade}{room.section ? ` \u2014 ${room.section}` : ''}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(room.scheduled_start)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{room.duration_minutes}m</span>
            {(room.student_count ?? 0) > 0 && (
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.student_count} student{room.student_count !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {room.status === 'live' && (
            <button onClick={() => router.push(`/classroom/${room.room_id}?mode=observe`)}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            ><Eye className="h-3 w-3" /> Observe</button>
          )}
        </div>
        <div className="shrink-0 text-gray-500">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
      </div>
      {expanded && <MonitorDetailPanel room={room} onRefresh={onRefresh} />}
    </div>
  );
}

function MonitorDetailPanel({ room, onRefresh }: { room: Room; onRefresh: () => void }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchDetails = useCallback(async () => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}`);
      const data = await res.json();
      if (data.success) setAssignments(data.data?.assignments || []);
    } finally { setLoadingDetails(false); }
  }, [room.room_id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const teacher = assignments.find((a) => a.participant_type === 'teacher');
  const students = assignments.filter((a) => a.participant_type === 'student');
  const joined = students.filter((s) => !!s.joined_at);
  const notJoined = students.filter((s) => !s.joined_at);
  const notNotified = students.filter((s) => !s.notification_sent_at);

  const handleRemind = async () => {
    setNotifying(true); setMsg('');
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}/notify`, { method: 'POST' });
      const data = await res.json();
      setMsg(data.success ? `\u2713 Reminder sent to ${data.data?.sent ?? 0} participants` : `\u2717 ${data.error}`);
      if (data.success) { fetchDetails(); onRefresh(); }
    } catch { setMsg('\u2717 Network error'); }
    finally { setNotifying(false); }
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950/50 p-4">
      {msg && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-xs ${msg.startsWith('\u2713') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Room Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Room Details</h4>
          {[
            ['Room ID', room.room_id, true],
            ['Subject', room.subject, false],
            ['Grade', `${room.grade}${room.section ? ` \u2014 ${room.section}` : ''}`, false],
            ['Scheduled', fmtDateTimeIST(room.scheduled_start), false],
            ['Duration', `${room.duration_minutes} minutes`, false],
          ].map(([l, v, m]) => (
            <div key={l as string} className="flex items-start gap-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-gray-500">{l as string}</span>
              <span className={`text-gray-200 ${m ? 'font-mono text-xs' : ''}`}>{v as string}</span>
            </div>
          ))}

          {/* Teacher */}
          <div className="mt-3 rounded-lg border border-gray-800 p-3">
            <p className="mb-2 text-xs text-gray-500">Assigned Teacher</p>
            {loadingDetails ? (
              <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
            ) : teacher ? (
              <div className="flex items-center gap-2">
                <Avatar name={teacher.participant_name} size={7} color="bg-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-white">{teacher.participant_name}</p>
                  <p className="text-xs text-gray-500">{teacher.participant_email}</p>
                  {teacher.notification_sent_at && (
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-500"><Mail className="h-2.5 w-2.5" /> Notified {fmtDateTimeIST(teacher.notification_sent_at)}</p>
                  )}
                  {teacher.joined_at && (
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-green-400"><UserCheck className="h-2.5 w-2.5" /> Joined {fmtDateTimeIST(teacher.joined_at)}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> No teacher assigned</p>
            )}
          </div>
        </div>

        {/* Attendance */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Attendance</h4>
            {room.status === 'scheduled' && students.length > 0 && (
              <button onClick={handleRemind} disabled={notifying}
                className="flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800 disabled:opacity-50 transition-colors"
              >
                {notifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send Reminder
              </button>
            )}
          </div>

          {loadingDetails ? (
            <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 py-6 text-center">
              <Users className="mx-auto mb-2 h-5 w-5 text-gray-600" />
              <p className="text-xs text-gray-500">No students assigned</p>
            </div>
          ) : (
            <>
              <div className="flex gap-3 text-sm">
                <div className="rounded-lg border border-green-800 bg-green-950/30 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-green-400">{joined.length}</p>
                  <p className="text-xs text-gray-400">Joined</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-gray-300">{notJoined.length}</p>
                  <p className="text-xs text-gray-400">Not joined</p>
                </div>
                <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-amber-400">{notNotified.length}</p>
                  <p className="text-xs text-gray-400">Unnotified</p>
                </div>
              </div>

              <div className="max-h-52 overflow-auto space-y-1.5">
                {students.map((s) => (
                  <div key={s.participant_email} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${s.joined_at ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <Avatar name={s.participant_name} size={7} color="bg-violet-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{s.participant_name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{s.participant_email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.joined_at ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-400"><UserCheck className="h-2.5 w-2.5" /> Joined</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500"><UserX className="h-2.5 w-2.5" /> Absent</span>
                      )}
                      {s.notification_sent_at ? (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> Sent</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">No notif</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
