// ═══════════════════════════════════════════════════════════════
// Academic Operator Dashboard — Client Component
// Creates rooms, assigns teachers & students, sends notifications.
// Per PDF scope: Academic Operator owns batch creation.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtSmartDateIST, fmtDateTimeIST, toISTDateValue, toISTTimeValue, istToUTCISO } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, PlusCircle, Calendar, Clock, Users, Send,
  Radio, CheckCircle2, XCircle, Search, RefreshCw, Eye,
  UserPlus, Loader2, ChevronDown, ChevronRight, Trash2,
  BookOpen, GraduationCap, Mail, X, Save, AlertTriangle,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  coordinator_email: string;
  teacher_email: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  max_participants: number;
  fee_paise: number;
  notes_for_teacher: string | null;
  open_at: string;
  expires_at: string;
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

interface PortalUser {
  email: string;
  name: string;
  role: string;
}

interface AcademicOperatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string; icon: typeof Radio }> = {
  scheduled: { bg: 'bg-blue-900/40 border-blue-700',  text: 'text-blue-300',  dot: 'bg-blue-500',  icon: Calendar    },
  live:      { bg: 'bg-green-900/40 border-green-700', text: 'text-green-300', dot: 'bg-green-500', icon: Radio       },
  ended:     { bg: 'bg-gray-800 border-gray-600',      text: 'text-gray-400',  dot: 'bg-gray-500',  icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-900/40 border-red-700',     text: 'text-red-400',   dot: 'bg-red-500',   icon: XCircle     },
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

function UserSearchDropdown({
  role,
  placeholder,
  onSelect,
  excludeEmails = [],
}: {
  role: 'teacher' | 'student';
  placeholder: string;
  onSelect: (user: PortalUser) => void;
  excludeEmails?: string[];
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PortalUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (q.length < 1) {
      const timer = setTimeout(async () => {
        if (open) {
          setSearching(true);
          try {
            const res = await fetch(`/api/v1/users/search?role=${role}`);
            const data = await res.json();
            if (data.success) {
              setResults((data.data?.users || []).filter((u: PortalUser) => !excludeEmails.includes(u.email)));
            }
          } finally { setSearching(false); }
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(q)}&role=${role}`);
        const data = await res.json();
        if (data.success) {
          setResults((data.data?.users || []).filter((u: PortalUser) => !excludeEmails.includes(u.email)));
        }
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, role]);

  const handleSelect = (u: PortalUser) => { onSelect(u); setQ(''); setOpen(false); setResults([]); };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input type="text" value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-gray-700 shadow-2xl" style={{ backgroundColor: '#1a1f2e' }}>
          {results.map((u) => (
            <button key={u.email} type="button" onMouseDown={() => handleSelect(u)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-700/50 transition-colors"
            >
              <Avatar name={u.name} size={8} color={role === 'teacher' ? 'bg-emerald-600' : 'bg-violet-600'} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !searching && results.length === 0 && q.length > 1 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-500 shadow-xl" style={{ backgroundColor: '#1a1f2e' }}>
          No {role}s found
        </div>
      )}
    </div>
  );
}

export default function AcademicOperatorDashboardClient({ userName, userEmail, userRole }: AcademicOperatorDashboardClientProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
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
      { label: 'Rooms', href: '/academic-operator', icon: LayoutDashboard, active: true },
    ]}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rooms</h1>
          <p className="text-sm text-gray-400">Create batches, assign teachers &amp; students</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" /> New Room
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',     value: stats.total,     color: 'border-gray-700',   text: 'text-white'     },
          { label: 'Live',      value: stats.live,      color: 'border-green-700',  text: 'text-green-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'border-amber-700',  text: 'text-amber-400' },
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
                filter === f ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >{f}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search rooms, subject, grade..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
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
              {rooms.length === 0 ? 'Click \u201cNew Room\u201d to schedule the first class' : 'Try a different filter or search'}
            </p>
          </div>
        ) : (
          filteredRooms.map((room) => (
            <AOPRoomCard
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

      {showCreate && (
        <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchRooms(); }} />
      )}
    </DashboardShell>
  );
}

function AOPRoomCard({ room, expanded, onToggle, onRefresh, router }: {
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
              className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            ><Eye className="h-3 w-3" /> Observe</button>
          )}
        </div>
        <div className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </div>
      </div>
      {expanded && <AOPRoomDetailPanel room={room} onRefresh={onRefresh} />}
    </div>
  );
}

type AOPTab = 'overview' | 'students' | 'edit';

function AOPRoomDetailPanel({ room, onRefresh }: { room: Room; onRefresh: () => void }) {
  const [tab, setTab] = useState<AOPTab>('overview');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  const handleNotify = async () => {
    setNotifying(true); setMsg('');
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}/notify`, { method: 'POST' });
      const data = await res.json();
      setMsg(data.success ? `\u2713 Sent to ${data.data?.sent ?? 0} participants` : `\u2717 ${data.error}`);
    } catch { setMsg('\u2717 Network error'); }
    finally { setNotifying(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) onRefresh();
      else setMsg(`\u2717 ${data.error}`);
    } catch { setMsg('\u2717 Network error'); }
    finally { setCancelling(false); setCancelConfirm(false); }
  };

  return (
    <div className="border-t border-gray-800 bg-gray-950/50">
      <div className="flex items-center gap-1 border-b border-gray-800 px-4 pt-3">
        {(['overview', 'students', 'edit'] as AOPTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >{t}</button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          {room.status === 'scheduled' && (
            <>
              <button onClick={handleNotify} disabled={notifying || assignments.length === 0}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
              >
                {notifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Notify All
              </button>
              {!cancelConfirm ? (
                <button onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-1 rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/50 transition-colors"
                ><Trash2 className="h-3 w-3" /> Cancel Room</button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-400">Sure?</span>
                  <button onClick={handleCancel} disabled={cancelling}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  >{cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Cancel'}</button>
                  <button onClick={() => setCancelConfirm(false)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white">No</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {msg && (
        <div className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs ${msg.startsWith('\u2713') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>
          {msg}
        </div>
      )}
      <div className="p-4">
        {tab === 'overview' && <AOPOverviewTab room={room} teacher={teacher} students={students} loadingDetails={loadingDetails} />}
        {tab === 'students' && <AOPStudentsTab room={room} students={students} onRefresh={fetchDetails} />}
        {tab === 'edit'     && <AOPEditRoomTab room={room} onSaved={onRefresh} />}
      </div>
    </div>
  );
}

function AOPOverviewTab({ room, teacher, students, loadingDetails }: { room: Room; teacher?: Assignment; students: Assignment[]; loadingDetails: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Room Info</h4>
        {[
          ['Room ID', room.room_id, true],
          ['Subject', room.subject, false],
          ['Grade', `${room.grade}${room.section ? ` \u2014 ${room.section}` : ''}`, false],
          ['Scheduled', fmtDateTimeIST(room.scheduled_start), false],
          ['Duration', `${room.duration_minutes} minutes`, false],
          ['Max Participants', String(room.max_participants), false],
        ].map(([l, v, m]) => (
          <div key={l as string} className="flex items-start gap-2 text-sm">
            <span className="w-28 shrink-0 text-xs text-gray-500">{l as string}</span>
            <span className={`text-gray-200 ${m ? 'font-mono text-xs' : ''}`}>{v as string}</span>
          </div>
        ))}
        {room.notes_for_teacher && (
          <div className="flex items-start gap-2 text-sm">
            <span className="w-28 shrink-0 text-xs text-gray-500">Notes</span>
            <span className="text-gray-200">{room.notes_for_teacher}</span>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assignments</h4>
        {loadingDetails ? (
          <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="mb-2 text-xs text-gray-500">Teacher</p>
              {teacher ? (
                <div className="flex items-center gap-2">
                  <Avatar name={teacher.participant_name} size={7} color="bg-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-white">{teacher.participant_name}</p>
                    <p className="text-xs text-gray-500">{teacher.participant_email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">\u26a0 No teacher assigned \u2014 go to Edit tab</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-800 p-3">
              <p className="mb-1 text-xs text-gray-500">Students</p>
              <p className="text-2xl font-bold text-white">{students.length}</p>
              <p className="text-xs text-gray-500">assigned</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AOPStudentsTab({ room, students, onRefresh }: { room: Room; students: Assignment[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const canEdit = room.status === 'scheduled';

  const handleAdd = async (user: PortalUser) => {
    setAdding(true); setMsg('');
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}/students`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: [{ email: user.email, name: user.name }] }),
      });
      const data = await res.json();
      if (data.success) { setMsg(`\u2713 ${user.name} added`); onRefresh(); }
      else setMsg(`\u2717 ${data.error}`);
    } catch { setMsg('\u2717 Network error'); }
    finally { setAdding(false); }
  };

  const handleRemove = async (email: string) => {
    setRemoving(email); setMsg('');
    try {
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}/students`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) { setMsg('\u2713 Student removed'); onRefresh(); }
      else setMsg(`\u2717 ${data.error}`);
    } catch { setMsg('\u2717 Network error'); }
    finally { setRemoving(null); }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div>
          <p className="mb-2 text-xs flex items-center gap-1 text-gray-400"><UserPlus className="h-3 w-3" /> Add student</p>
          <UserSearchDropdown role="student" placeholder="Search student by name or email..." onSelect={handleAdd} excludeEmails={students.map((s) => s.participant_email)} />
          {adding && <p className="mt-1 text-xs text-gray-500 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Adding...</p>}
        </div>
      )}
      {msg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${msg.startsWith('\u2713') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>{msg}</div>
      )}
      <div>
        <p className="mb-2 text-xs text-gray-500">{students.length} student{students.length !== 1 ? 's' : ''} assigned</p>
        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-8 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-gray-600" />
            <p className="text-sm text-gray-400">No students assigned</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {students.map((s) => (
              <div key={s.participant_email} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2">
                <Avatar name={s.participant_name} size={8} color="bg-violet-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{s.participant_name}</p>
                  <p className="text-xs text-gray-500 truncate">{s.participant_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase ${
                    s.payment_status === 'paid' ? 'text-green-400' : s.payment_status === 'free' ? 'text-blue-400' : s.payment_status === 'exempt' ? 'text-purple-400' : 'text-gray-500'
                  }`}>{s.payment_status}</span>
                  {s.notification_sent_at && <span className="flex items-center gap-1 text-[10px] text-emerald-500"><Mail className="h-2.5 w-2.5" /> Notified</span>}
                  {canEdit && (
                    <button onClick={() => handleRemove(s.participant_email)} disabled={removing === s.participant_email}
                      className="ml-1 rounded p-1 text-gray-600 hover:bg-red-950/50 hover:text-red-400 transition-colors"
                    >
                      {removing === s.participant_email ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AOPEditRoomTab({ room, onSaved }: { room: Room; onSaved: () => void }) {
  const [form, setForm] = useState({
    room_name: room.room_name, subject: room.subject, grade: room.grade,
    section: room.section || '', scheduled_date: toISTDateValue(room.scheduled_start),
    start_time: toISTTimeValue(room.scheduled_start),
    duration_minutes: room.duration_minutes, max_participants: room.max_participants,
    notes_for_teacher: room.notes_for_teacher || '',
    teacher_email: room.teacher_email || '', teacher_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const canEdit = room.status === 'scheduled';
  const subjects = ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Economics', 'Commerce', 'Accountancy', 'History', 'Geography'];
  const grades = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
  const durations = [30, 45, 60, 90, 120];
  const f = (key: string, val: string | number) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const scheduledStart = istToUTCISO(form.scheduled_date, form.start_time);
      const res = await fetch(`/api/v1/coordinator/rooms/${room.room_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: form.room_name, subject: form.subject, grade: form.grade, section: form.section || null, scheduled_start: scheduledStart, duration_minutes: form.duration_minutes, max_participants: form.max_participants, notes_for_teacher: form.notes_for_teacher || null, teacher_email: form.teacher_email || null }),
      });
      const data = await res.json();
      if (data.success) { setMsg('\u2713 Saved'); onSaved(); } else setMsg(`\u2717 ${data.error}`);
    } catch { setMsg('\u2717 Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-xl">
      {!canEdit && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Room is {room.status} \u2014 editing locked
        </div>
      )}
      <div>
        <label className="text-xs text-gray-400">Room Name</label>
        <input type="text" value={form.room_name} disabled={!canEdit} onChange={(e) => f('room_name', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:border-amber-500 focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">Subject</label>
          <select value={form.subject} disabled={!canEdit} onChange={(e) => f('subject', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Grade</label>
          <select value={form.grade} disabled={!canEdit} onChange={(e) => f('grade', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none">
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400">Section</label>
        <input type="text" value={form.section} disabled={!canEdit} placeholder="e.g. A, Morning Batch" onChange={(e) => f('section', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:border-amber-500 focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">Date</label>
          <input type="date" value={form.scheduled_date} disabled={!canEdit} onChange={(e) => f('scheduled_date', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Start Time</label>
          <input type="time" value={form.start_time} disabled={!canEdit} onChange={(e) => f('start_time', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">Duration</label>
          <select value={form.duration_minutes} disabled={!canEdit} onChange={(e) => f('duration_minutes', Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none">
            {durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Max Participants</label>
          <input type="number" min={1} max={500} value={form.max_participants} disabled={!canEdit} onChange={(e) => f('max_participants', Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400">
          Teacher {form.teacher_email && <span className="text-emerald-400">\u2014 {form.teacher_email}</span>}
        </label>
        {canEdit ? (
          <div className="mt-1">
            <UserSearchDropdown role="teacher" placeholder="Search and select teacher..." onSelect={(u) => setForm((p) => ({ ...p, teacher_email: u.email, teacher_name: u.name }))} excludeEmails={[]} />
            {form.teacher_email && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm">
                <span className="text-emerald-300">{form.teacher_name || form.teacher_email}</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, teacher_email: '', teacher_name: '' }))} className="text-gray-500 hover:text-red-400"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-300">{form.teacher_email || '\u2014'}</p>
        )}
      </div>
      <div>
        <label className="text-xs text-gray-400">Notes for Teacher</label>
        <textarea rows={3} value={form.notes_for_teacher} disabled={!canEdit} onChange={(e) => f('notes_for_teacher', e.target.value)}
          placeholder="Any specific instructions..." className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50 focus:border-amber-500 focus:outline-none resize-none" />
      </div>
      {msg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${msg.startsWith('\u2713') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>{msg}</div>
      )}
      {canEdit && (
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
        </button>
      )}
    </div>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    room_name: '', subject: 'Mathematics', grade: 'Class 10', section: '',
    scheduled_date: toISTDateValue(new Date()), start_time: '09:00',
    duration_minutes: 60, max_participants: 50, notes_for_teacher: '',
    teacher_email: '', teacher_name: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const subjects = ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Economics', 'Commerce', 'Accountancy', 'History', 'Geography'];
  const grades = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
  const durations = [30, 45, 60, 90, 120];
  const f = (key: string, val: string | number) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scheduled_date || !form.start_time) { setError('Date and time are required'); return; }
    setError(''); setSubmitting(true);
    try {
      const scheduledStart = istToUTCISO(form.scheduled_date, form.start_time);
      const res = await fetch('/api/v1/coordinator/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: form.room_name, subject: form.subject, grade: form.grade, section: form.section || null, scheduled_start: scheduledStart, duration_minutes: form.duration_minutes, max_participants: form.max_participants, notes_for_teacher: form.notes_for_teacher || null, teacher_email: form.teacher_email || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Failed to create room'); return; }
      onCreated();
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Create New Room</h2>
            <p className="text-xs text-gray-500">Fill in the class details</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2.5 text-sm text-red-400">{error}</div>}
          <div>
            <label className="text-xs font-medium text-gray-400">Room Name <span className="text-red-400">*</span></label>
            <input type="text" required value={form.room_name} onChange={(e) => f('room_name', e.target.value)}
              placeholder="e.g. Grade 10 Maths — Quadratic Equations"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Subject <span className="text-red-400">*</span></label>
              <select value={form.subject} onChange={(e) => f('subject', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none">
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Grade <span className="text-red-400">*</span></label>
              <select value={form.grade} onChange={(e) => f('grade', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none">
                {grades.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Section / Batch <span className="text-gray-600">(optional)</span></label>
            <input type="text" value={form.section} onChange={(e) => f('section', e.target.value)}
              placeholder="e.g. A, Morning Batch, Group 1"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Date <span className="text-red-400">*</span></label>
              <input type="date" required min={toISTDateValue(new Date())} value={form.scheduled_date} onChange={(e) => f('scheduled_date', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Start Time <span className="text-red-400">*</span></label>
              <input type="time" required value={form.start_time} onChange={(e) => f('start_time', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Duration <span className="text-red-400">*</span></label>
              <select value={form.duration_minutes} onChange={(e) => f('duration_minutes', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none">
                {durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Max Students</label>
              <input type="number" min={1} max={500} value={form.max_participants} onChange={(e) => f('max_participants', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Assign Teacher <span className="text-gray-600">(optional)</span></label>
            <div className="mt-1">
              <UserSearchDropdown role="teacher" placeholder="Search teacher..." onSelect={(u) => setForm((p) => ({ ...p, teacher_email: u.email, teacher_name: u.name }))} excludeEmails={[]} />
              {form.teacher_email && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={form.teacher_name} size={7} color="bg-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-300">{form.teacher_name}</p>
                      <p className="text-xs text-gray-500">{form.teacher_email}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, teacher_email: '', teacher_name: '' }))} className="text-gray-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Notes for Teacher <span className="text-gray-600">(optional)</span></label>
            <textarea rows={2} value={form.notes_for_teacher} onChange={(e) => f('notes_for_teacher', e.target.value)}
              placeholder="Any specific instructions..." className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:border-gray-500 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><PlusCircle className="h-4 w-4" /> Create Room</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
