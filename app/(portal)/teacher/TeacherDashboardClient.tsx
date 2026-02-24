// ═══════════════════════════════════════════════════════════════
// Teacher Dashboard — Client Component
// Tabs: Overview · My Classes · My Profile
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtSmartDateIST, fmtTimeIST, fmtDateLongIST } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, RefreshCw, Video, Search, ChevronDown,
  ChevronRight, GraduationCap, Award, Briefcase, Phone, Timer,
  Info, Users, FileText, Send, Loader2 as Spinner,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  notes_for_teacher: string | null;
  max_participants: number;
  student_count: number;
  class_portion: string | null;
  class_remarks: string | null;
}

interface TeacherProfile {
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  date_of_birth: string | null;
  subjects: string[] | null;
  qualification: string | null;
  experience_years: number | null;
  assigned_region: string | null;
  notes: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Constants ───────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { border: string; text: string; bg: string; label: string }> = {
  scheduled: { border: 'border-blue-700',  bg: 'bg-blue-900/40',   text: 'text-blue-300',   label: 'Scheduled' },
  live:      { border: 'border-green-700', bg: 'bg-green-900/40',  text: 'text-green-300',  label: 'Live'      },
  ended:     { border: 'border-border',    bg: 'bg-muted',         text: 'text-muted-foreground', label: 'Ended' },
  cancelled: { border: 'border-red-700',   bg: 'bg-red-900/40',    text: 'text-red-400',    label: 'Cancelled' },
};

// ── Helpers ─────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return fmtSmartDateIST(iso);
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Returns 'ended' when a scheduled class's window (start + duration) has passed. */
function effectiveStatus(room: Room): string {
  if (room.status === 'scheduled') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

// ── Small Reusable Components ────────────────────────────────────

function Avatar({ name, size = 8, color = 'bg-primary' }: { name: string; size?: number; color?: string }) {
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-primary-foreground`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.scheduled;
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase border ${s.border} ${s.text}`}>
      {s.label}
    </span>
  );
}

function Countdown({ scheduledStart, durationMinutes }: { scheduledStart: string; durationMinutes?: number }) {
  const [diff, setDiff] = useState('');
  useEffect(() => {
    const update = () => {
      const startMs = new Date(scheduledStart).getTime();
      const ms      = startMs - Date.now();
      if (ms <= 0) {
        // Class already started — show how long ago
        const elapsed = Math.floor((Date.now() - startMs) / 60_000);
        if (durationMinutes && elapsed >= durationMinutes) {
          setDiff(`Ended ${elapsed - durationMinutes}m ago`);
        } else {
          setDiff(elapsed < 1 ? 'Just started' : `Started ${elapsed}m ago`);
        }
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      if (h > 0) setDiff(`${h}h ${m}m`);
      else if (m > 0) setDiff(`${m}m ${s}s`);
      else setDiff(`${s}s`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [scheduledStart, durationMinutes]);
  return <span>{diff}</span>;
}

// ── Overview Tab ─────────────────────────────────────────────────

function OverviewTab({ rooms, userName }: { rooms: Room[]; userName: string }) {
  const now      = new Date();
  const todayStr = now.toDateString();
  const weekAgo  = new Date(); weekAgo.setDate(now.getDate() - 7);

  const liveRooms     = rooms.filter((r) => effectiveStatus(r) === 'live');
  const todayRooms    = rooms.filter((r) => new Date(r.scheduled_start).toDateString() === todayStr && effectiveStatus(r) !== 'cancelled');
  const upcomingRooms = rooms.filter((r) => effectiveStatus(r) === 'scheduled');
  const doneThisWeek  = rooms.filter((r) => effectiveStatus(r) === 'ended' && new Date(r.scheduled_start) >= weekAgo);

  const nextClass = [...upcomingRooms]
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Live Alert Banner */}
      {liveRooms.length > 0 && (
        <div className="rounded-2xl border-2 border-green-500 bg-gradient-to-r from-green-950/60 to-emerald-950/40 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-green-400" />
            <h2 className="text-lg font-bold text-green-300">
              {liveRooms.length === 1 ? 'A class is Live right now!' : `${liveRooms.length} classes are Live right now!`}
            </h2>
          </div>
          <div className="space-y-3">
            {liveRooms.map((room) => (
              <div key={room.room_id} className="flex items-center justify-between gap-4 rounded-xl bg-black/30 px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{room.room_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {room.subject} · {room.grade}{room.section ? ` · ${room.section}` : ''} · {room.student_count} students
                  </p>
                </div>
                <a
                  href={`/classroom/${room.room_id}`}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-green-400 transition-colors"
                >
                  <Video className="h-4 w-4" /> Enter Class
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Live Now',         value: liveRooms.length,     border: 'border-green-700', bg: 'bg-green-950/30',  text: 'text-green-400' },
          { label: "Today's Classes",  value: todayRooms.length,    border: 'border-blue-700',  bg: 'bg-blue-950/30',   text: 'text-blue-400'  },
          { label: 'Upcoming',         value: upcomingRooms.length, border: 'border-amber-700', bg: 'bg-amber-950/30',  text: 'text-amber-400' },
          { label: 'Done This Week',   value: doneThisWeek.length,  border: 'border-border',  bg: 'bg-card',      text: 'text-foreground'  },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Next Class Card */}
      {nextClass && (
        <div className="rounded-xl border border-blue-800 bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-300">
            <Timer className="h-4 w-4" /> Next Class
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-700 bg-blue-900/40">
              <Calendar className="h-7 w-7 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{nextClass.room_name}</p>
              <p className="text-sm text-muted-foreground">
                {nextClass.subject} · {nextClass.grade}{nextClass.section ? ` · ${nextClass.section}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(nextClass.scheduled_start)}</span>
                <span>{fmtDuration(nextClass.duration_minutes)}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{nextClass.student_count} enrolled</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-1 text-xs text-muted-foreground">
                {new Date(nextClass.scheduled_start) > new Date() ? 'Starts in' : 'Status'}
              </p>
              <p className="font-mono text-lg font-bold text-blue-400">
                <Countdown scheduledStart={nextClass.scheduled_start} durationMinutes={nextClass.duration_minutes} />
              </p>
            </div>
          </div>
          {nextClass.notes_for_teacher && (
            <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2">
              <p className="mb-0.5 text-xs font-medium text-amber-400">Notes from coordinator:</p>
              <p className="text-sm text-foreground">{nextClass.notes_for_teacher}</p>
            </div>
          )}
        </div>
      )}

      {/* Today's Schedule Timeline */}
      {todayRooms.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-4 w-4" /> Today&apos;s Schedule
          </h3>
          <div className="space-y-2">
            {[...todayRooms]
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .map((room) => {
                const es = effectiveStatus(room);
                const s  = STATUS_BADGE[es] ?? STATUS_BADGE.scheduled;
                return (
                  <div key={room.room_id} className={`flex items-center gap-4 rounded-xl border p-4 ${s.border} ${s.bg}`}>
                    <div className="w-14 shrink-0 text-center">
                      <p className={`text-sm font-bold ${s.text}`}>
                        {fmtTimeIST(room.scheduled_start)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDuration(room.duration_minutes)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{room.room_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {room.subject} · {room.grade} · {room.student_count} students
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {es === 'live' && (
                        <a href={`/classroom/${room.room_id}`}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                          Enter
                        </a>
                      )}
                      <StatusBadge status={es} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rooms.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No classes assigned yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Contact your coordinator to get classes assigned</p>
        </div>
      )}
    </div>
  );
}

// ── My Classes Tab ────────────────────────────────────────────────

type FilterKey = 'all' | 'live' | 'scheduled' | 'ended' | 'cancelled';

function MyClassesTab({ rooms }: { rooms: Room[] }) {
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [search,     setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localPortions, setLocalPortions] = useState<Record<string, { portion: string; remarks: string }>>({});

  const counts: Record<FilterKey, number> = {
    all:       rooms.length,
    live:      rooms.filter((r) => effectiveStatus(r) === 'live').length,
    scheduled: rooms.filter((r) => effectiveStatus(r) === 'scheduled').length,
    ended:     rooms.filter((r) => effectiveStatus(r) === 'ended').length,
    cancelled: rooms.filter((r) => effectiveStatus(r) === 'cancelled').length,
  };

  const filtered = rooms
    .filter((r) => filter === 'all' || effectiveStatus(r) === filter)
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.room_name.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q)   ||
        r.grade.toLowerCase().includes(q)     ||
        (r.section ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime());

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by class name, subject, grade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-muted py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as FilterKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {s === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === s ? 'bg-white/20' : 'bg-background'}`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Room List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No classes match your search' : 'No classes in this category'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((room) => {
            const es         = effectiveStatus(room);
            const s          = STATUS_BADGE[es] ?? STATUS_BADGE.scheduled;
            const isExpanded = expandedId === room.room_id;
            return (
              <div
                key={room.room_id}
                className={`rounded-xl border transition-colors ${
                  isExpanded ? `${s.border} ${s.bg}` : 'border-border bg-card hover:border-border'
                }`}
              >
                {/* Clickable row header */}
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : room.room_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${s.border} ${s.bg}`}>
                    {es === 'live'      && <Radio        className={`h-5 w-5 ${s.text}`} />}
                    {es === 'ended'     && <CheckCircle2 className={`h-5 w-5 ${s.text}`} />}
                    {es === 'cancelled' && <XCircle      className={`h-5 w-5 ${s.text}`} />}
                    {es === 'scheduled' && <Calendar     className={`h-5 w-5 ${s.text}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{room.room_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{room.subject} · {room.grade}{room.section ? ` · ${room.section}` : ''}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(room.scheduled_start)}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.student_count}/{room.max_participants}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden text-right sm:block">
                      <p className={`text-xs font-semibold ${s.text}`}>{s.label}</p>
                      <p className="text-xs text-muted-foreground">{fmtDuration(room.duration_minutes)}</p>
                    </div>
                    {es === 'live' && (
                      <a
                        href={`/classroom/${room.room_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Enter
                      </a>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="mb-0.5 text-xs text-muted-foreground">Date &amp; Time</p>
                        <p className="text-foreground">{fmtDate(room.scheduled_start)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-muted-foreground">Duration</p>
                        <p className="text-foreground">{fmtDuration(room.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-muted-foreground">Students</p>
                        <p className="text-foreground">{room.student_count} enrolled / {room.max_participants} max</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-muted-foreground">Status</p>
                        <StatusBadge status={es} />
                      </div>
                    </div>

                    {room.notes_for_teacher && (
                      <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-400">
                          <Info className="h-3.5 w-3.5" /> Notes from coordinator
                        </p>
                        <p className="text-sm text-foreground">{room.notes_for_teacher}</p>
                      </div>
                    )}

                    {es === 'scheduled' && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-800/50 bg-blue-950/20 px-3 py-2 text-sm text-blue-300">
                        <Timer className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold">
                          <Countdown scheduledStart={room.scheduled_start} durationMinutes={room.duration_minutes} />
                        </span>
                      </div>
                    )}

                    {/* Class Portion & Remarks Form (for ended classes) */}
                    {es === 'ended' && (
                      <ClassPortionForm
                        roomId={room.room_id}
                        currentPortion={localPortions[room.room_id]?.portion ?? room.class_portion}
                        currentRemarks={localPortions[room.room_id]?.remarks ?? room.class_remarks}
                        onSaved={(portion, remarks) => {
                          setLocalPortions(prev => ({ ...prev, [room.room_id]: { portion, remarks } }));
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Class Portion & Remarks Form ──────────────────────────────────

function ClassPortionForm({
  roomId,
  currentPortion,
  currentRemarks,
  onSaved,
}: {
  roomId: string;
  currentPortion: string | null;
  currentRemarks: string | null;
  onSaved: (portion: string, remarks: string) => void;
}) {
  const [portion, setPortion] = useState(currentPortion || '');
  const [remarks, setRemarks] = useState(currentRemarks || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!portion.trim() && !remarks.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/room/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_portion: portion, class_remarks: remarks }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved(portion, remarks);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-800/40 bg-indigo-950/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-indigo-400">
        <FileText className="h-3.5 w-3.5" /> Class Portion &amp; Remarks
      </p>
      <div className="space-y-2">
        <div>
          <label className="mb-0.5 block text-xs text-muted-foreground">Topics Covered</label>
          <input
            type="text"
            value={portion}
            onChange={e => setPortion(e.target.value)}
            placeholder="e.g. Chapter 5 — Quadratic Equations (completed)"
            className="w-full rounded border border-border bg-muted px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-muted-foreground">Remarks</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Post-class notes, observations, homework assigned..."
            rows={2}
            className="w-full rounded border border-border bg-muted px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || (!portion.trim() && !remarks.trim())}
            className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Spinner className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Save
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────

function ProfileTab({ profile, loading }: { profile: TeacherProfile | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Profile not found</p>
        <p className="mt-1 text-sm text-muted-foreground">Your profile will appear here once HR has filled in your details.</p>
      </div>
    );
  }

  const Field = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value?: string | number | null;
    icon: React.ElementType;
  }) => (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm ${value != null && value !== '' ? 'text-foreground' : 'italic text-muted-foreground'}`}>
          {value != null && value !== '' ? String(value) : 'Not set'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header Card */}
      <div className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-950/40 to-card p-6">
        <div className="flex items-center gap-5">
          <Avatar name={profile.name} size={16} color="bg-primary" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">{profile.name}</h2>
            <p className="mt-0.5 text-sm text-emerald-400">Teacher</p>
            <p className="mt-1 text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        {profile.subjects && profile.subjects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.subjects.map((s) => (
              <span key={s} className="rounded-full border border-emerald-700 bg-emerald-900/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detail Fields */}
      <div className="rounded-xl border border-border bg-card px-5">
        <Field label="Phone"        value={profile.phone}          icon={Phone}        />
        <Field label="WhatsApp"     value={profile.whatsapp}       icon={Phone}        />
        <Field
          label="Date of Birth"
          value={
            profile.date_of_birth
              ? fmtDateLongIST(profile.date_of_birth)
              : null
          }
          icon={Calendar}
        />
        <Field label="Qualification" value={profile.qualification}   icon={GraduationCap} />
        <Field
          label="Experience"
          value={
            profile.experience_years != null
              ? `${profile.experience_years} year${profile.experience_years !== 1 ? 's' : ''}`
              : null
          }
          icon={Briefcase}
        />
        <Field label="Region"        value={profile.assigned_region} icon={Award}         />
        {profile.notes && <Field label="Notes" value={profile.notes} icon={Info} />}
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──────────────────────────────────────

export default function TeacherDashboardClient({ userName, userEmail, userRole }: Props) {
  const [rooms,          setRooms]          = useState<Room[]>([]);
  const [profile,        setProfile]        = useState<TeacherProfile | null>(null);
  const [payslips,       setPayslips]       = useState<{id:string;period_label:string;period_start:string;period_end:string;classes_conducted:number;classes_cancelled:number;classes_missed:number;base_pay_paise:number;incentive_paise:number;lop_paise:number;total_paise:number;status:string}[]>([]);
  const [loadingRooms,   setLoadingRooms]   = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPay,     setLoadingPay]     = useState(false);
  const [activeTab,      setActiveTab]      = useState<'overview' | 'classes' | 'profile' | 'salary'>('overview');

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res  = await fetch('/api/v1/teacher/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms ?? []);
    } catch (err) {
      console.error('[Teacher] rooms fetch failed:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res  = await fetch('/api/v1/teacher/profile');
      const text = await res.text();
      if (!text) { console.error('[Teacher] profile: empty response'); return; }
      const data = JSON.parse(text);
      if (data.success) setProfile(data.data);
      else console.error('[Teacher] profile error:', data.error);
    } catch (err) {
      console.error('[Teacher] profile fetch failed:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const fetchPayslips = useCallback(async () => {
    setLoadingPay(true);
    try {
      const res = await fetch('/api/v1/payroll?resource=payslips');
      const data = await res.json();
      if (data.success) setPayslips(data.data?.payslips || []);
    } catch (e) { console.error('[Teacher] payslips fetch failed:', e); }
    setLoadingPay(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Lazy-load profile only when tab first opened
  useEffect(() => {
    if (activeTab === 'profile' && !profile) fetchProfile();
  }, [activeTab, profile, fetchProfile]);

  useEffect(() => {
    if (activeTab === 'salary' && payslips.length === 0) fetchPayslips();
  }, [activeTab, payslips.length, fetchPayslips]);

  // Auto-refresh rooms every 60 s (picks up live status changes)
  useEffect(() => {
    const id = setInterval(fetchRooms, 60_000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  const liveCount = rooms.filter((r) => r.status === 'live').length;

  const navItems = [
    { label: 'Dashboard',  href: '/teacher',         icon: LayoutDashboard, active: true },
    { label: 'My Classes', href: '/teacher#classes',  icon: BookOpen },
    { label: 'Exams',      href: '/teacher/exams',   icon: Award },
    { label: 'Salary',     href: '/teacher#salary',  icon: Briefcase },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {activeTab === 'overview' ? 'Teacher Dashboard'
              : activeTab === 'classes' ? 'My Classes'
              : 'My Profile'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeTab === 'overview'
              ? `Welcome back, ${userName.split(' ')[0]}`
              : activeTab === 'classes'
              ? `${rooms.length} class${rooms.length !== 1 ? 'es' : ''} assigned to you`
              : 'Your account & profile information'}
          </p>
        </div>
        <button
          onClick={fetchRooms}
          disabled={loadingRooms}
          title="Refresh"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card/60 p-1">
        {(
          [
            { key: 'overview' as const, label: 'Overview',   icon: LayoutDashboard },
            {
              key:   'classes' as const,
              label: liveCount > 0 ? `My Classes  •  ${liveCount} Live` : 'My Classes',
              icon:  BookOpen,
            },
            { key: 'salary'  as const, label: 'Salary',      icon: Briefcase },
            { key: 'profile' as const, label: 'My Profile',  icon: User },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            {key === 'classes' && liveCount > 0 && activeTab !== key && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400 sm:hidden" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab rooms={rooms}  userName={userName} />}
      {activeTab === 'classes'  && <MyClassesTab rooms={rooms} />}
      {activeTab === 'salary'   && (
        <div className="space-y-4">
          {loadingPay ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : payslips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">No payslips available yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payslips.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-foreground">{s.period_label || 'Payslip'}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                      s.status === 'finalized' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{s.status}</span>
                  </div>
                  {s.period_start && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {new Date(s.period_start).toLocaleDateString('en-IN')} — {new Date(s.period_end).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><p className="text-[10px] text-muted-foreground">Classes</p><p className="text-sm text-foreground font-semibold">{s.classes_conducted}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Base Pay</p><p className="text-sm text-green-400 font-semibold">₹{(s.base_pay_paise/100).toLocaleString('en-IN')}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Incentive</p><p className="text-sm text-blue-400 font-semibold">₹{(s.incentive_paise/100).toLocaleString('en-IN')}</p></div>
                    <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm text-foreground font-bold">₹{(s.total_paise/100).toLocaleString('en-IN')}</p></div>
                  </div>
                  {(s.classes_cancelled > 0 || s.classes_missed > 0) && (
                    <div className="flex gap-4 mt-2 text-xs">
                      {s.classes_cancelled > 0 && <span className="text-yellow-400">{s.classes_cancelled} cancelled</span>}
                      {s.classes_missed > 0 && <span className="text-red-400">{s.classes_missed} missed (LOP: ₹{(s.lop_paise/100).toLocaleString('en-IN')})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'profile'  && <ProfileTab   profile={profile} loading={loadingProfile} />}
    </DashboardShell>
  );
}
