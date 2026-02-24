// ═══════════════════════════════════════════════════════════════
// Student Dashboard — Client Component
// Tabs: Overview · My Classes · My Profile
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtSmartDateIST, fmtTimeIST, fmtDateLongIST } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, RefreshCw, Video, Search, ChevronDown,
  ChevronRight, GraduationCap, Phone, Timer, Users,
  CreditCard, AlertCircle, Info, BookMarked, School,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface Assignment {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  max_participants: number;
  teacher_email: string | null;
  teacher_name: string | null;
  payment_status: string;
  join_token: string | null;
}

interface StudentProfile {
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  date_of_birth: string | null;
  grade: string | null;
  section: string | null;
  board: string | null;
  parent_email: string | null;
  admission_date: string | null;
  notes: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Constants ──────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { border: string; text: string; bg: string; label: string }> = {
  scheduled: { border: 'border-violet-700', bg: 'bg-violet-900/40', text: 'text-violet-300', label: 'Scheduled' },
  live:      { border: 'border-green-700',  bg: 'bg-green-900/40',  text: 'text-green-300',  label: 'Live'      },
  ended:     { border: 'border-gray-600',   bg: 'bg-gray-800',      text: 'text-gray-400',   label: 'Ended'     },
  cancelled: { border: 'border-red-700',    bg: 'bg-red-900/40',    text: 'text-red-400',    label: 'Cancelled' },
};

const PAYMENT_BADGE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  paid:    { bg: 'bg-green-900/40',  border: 'border-green-700',  text: 'text-green-400',  label: 'Paid'    },
  exempt:  { bg: 'bg-blue-900/40',   border: 'border-blue-700',   text: 'text-blue-400',   label: 'Free'    },
  pending: { bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-400', label: 'Pending' },
};

// ── Helpers ────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return fmtSmartDateIST(iso);
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Returns 'ended' when a scheduled class's time window has passed. */
function effectiveStatus(a: Assignment): string {
  if (a.status === 'scheduled') {
    const endMs = new Date(a.scheduled_start).getTime() + a.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return a.status;
}

// ── Small Components ───────────────────────────────────────────

function Avatar({ name, size = 8, color = 'bg-violet-600' }: { name: string; size?: number; color?: string }) {
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
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

function PaymentBadge({ status }: { status: string }) {
  const p = PAYMENT_BADGE[status] ?? PAYMENT_BADGE.pending;
  return (
    <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold border ${p.border} ${p.text} ${p.bg}`}>
      {status === 'pending' && <CreditCard className="h-3 w-3" />}
      {status === 'paid'    && <CheckCircle2 className="h-3 w-3" />}
      {p.label}
    </span>
  );
}

function Countdown({ scheduledStart, durationMinutes }: { scheduledStart: string; durationMinutes: number }) {
  const [diff, setDiff] = useState('');
  useEffect(() => {
    const update = () => {
      const startMs = new Date(scheduledStart).getTime();
      const ms      = startMs - Date.now();
      if (ms <= 0) {
        const elapsed = Math.floor((Date.now() - startMs) / 60_000);
        if (elapsed >= durationMinutes) setDiff(`Ended ${elapsed - durationMinutes}m ago`);
        else setDiff(elapsed < 1 ? 'Just started' : `Started ${elapsed}m ago`);
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

// ── Overview Tab ───────────────────────────────────────────────

function OverviewTab({ assignments, userName }: { assignments: Assignment[]; userName: string }) {
  const now      = new Date();
  const todayStr = now.toDateString();
  const weekAgo  = new Date(); weekAgo.setDate(now.getDate() - 7);

  const liveRooms     = assignments.filter((a) => effectiveStatus(a) === 'live');
  const todayClasses  = assignments.filter((a) => new Date(a.scheduled_start).toDateString() === todayStr && effectiveStatus(a) !== 'cancelled');
  const upcoming      = assignments.filter((a) => effectiveStatus(a) === 'scheduled');
  const doneThisWeek  = assignments.filter((a) => effectiveStatus(a) === 'ended' && new Date(a.scheduled_start) >= weekAgo);
  const pendingPay    = assignments.filter((a) => a.payment_status === 'pending' && effectiveStatus(a) === 'scheduled');

  const nextClass = [...upcoming].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
  )[0];

  return (
    <div className="space-y-6">
      {/* Live Join Banner */}
      {liveRooms.length > 0 && (
        <div className="rounded-2xl border-2 border-green-500 bg-gradient-to-r from-green-950/60 to-emerald-950/40 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-green-400" />
            <h2 className="text-lg font-bold text-green-300">
              {liveRooms.length === 1 ? 'A class is Live — Join now!' : `${liveRooms.length} classes are Live!`}
            </h2>
          </div>
          <div className="space-y-3">
            {liveRooms.map((a) => (
              <div key={a.room_id} className="flex items-center justify-between gap-4 rounded-xl bg-black/30 px-4 py-3">
                <div>
                  <p className="font-semibold text-white">{a.room_name}</p>
                  <p className="text-sm text-gray-400">
                    {a.subject} · {a.grade}
                    {a.section ? ` · ${a.section}` : ''}
                    {a.teacher_name ? ` · ${a.teacher_name}` : ''}
                  </p>
                </div>
                <a
                  href={`/join/${a.room_id}`}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-green-400 transition-colors"
                >
                  <Video className="h-4 w-4" /> Join Class
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Alert */}
      {pendingPay.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-700/60 bg-yellow-950/30 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
          <p className="text-sm text-yellow-300">
            <span className="font-semibold">{pendingPay.length} class{pendingPay.length > 1 ? 'es have' : ' has'} pending payment.</span>{' '}
            Please complete payment to secure your seat.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Live Now',        value: liveRooms.length,    border: 'border-green-700',  bg: 'bg-green-950/30',  text: 'text-green-400'  },
          { label: "Today's Classes", value: todayClasses.length, border: 'border-violet-700', bg: 'bg-violet-950/30', text: 'text-violet-400' },
          { label: 'Upcoming',        value: upcoming.length,     border: 'border-blue-700',   bg: 'bg-blue-950/30',   text: 'text-blue-400'   },
          { label: 'Done This Week',  value: doneThisWeek.length, border: 'border-gray-700',   bg: 'bg-gray-900',      text: 'text-gray-300'   },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Next Class Card */}
      {nextClass && (
        <div className="rounded-xl border border-violet-800 bg-gray-900 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300">
            <Timer className="h-4 w-4" /> Next Class
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-violet-700 bg-violet-900/40">
              <Calendar className="h-7 w-7 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{nextClass.room_name}</p>
              <p className="text-sm text-gray-400">
                {nextClass.subject} · {nextClass.grade}
                {nextClass.section ? ` · ${nextClass.section}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(nextClass.scheduled_start)}</span>
                <span>{fmtDuration(nextClass.duration_minutes)}</span>
                {nextClass.teacher_name && (
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{nextClass.teacher_name}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-1 text-xs text-gray-500">
                {new Date(nextClass.scheduled_start) > new Date() ? 'Starts in' : 'Status'}
              </p>
              <p className="font-mono text-lg font-bold text-violet-400">
                <Countdown scheduledStart={nextClass.scheduled_start} durationMinutes={nextClass.duration_minutes} />
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PaymentBadge status={nextClass.payment_status} />
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      {todayClasses.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
            <Calendar className="h-4 w-4" /> Today&apos;s Schedule
          </h3>
          <div className="space-y-2">
            {[...todayClasses]
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .map((a) => {
                const es = effectiveStatus(a);
                const s  = STATUS_BADGE[es] ?? STATUS_BADGE.scheduled;
                return (
                  <div key={a.room_id} className={`flex items-center gap-4 rounded-xl border p-4 ${s.border} ${s.bg}`}>
                    <div className="w-14 shrink-0 text-center">
                      <p className={`text-sm font-bold ${s.text}`}>
                        {fmtTimeIST(a.scheduled_start)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">{fmtDuration(a.duration_minutes)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{a.room_name}</p>
                      <p className="text-xs text-gray-400">
                        {a.subject} · {a.grade}
                        {a.teacher_name ? ` · ${a.teacher_name}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {es === 'live' && (
                        <a href={`/join/${a.room_id}`}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                          Join
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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <a href="/student/exams"
          className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-violet-600 hover:bg-gray-800 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-900/40">
            <GraduationCap className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Exams</p>
            <p className="text-xs text-gray-500">View & take exams</p>
          </div>
        </a>
        <a href="/student"
          className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-blue-600 hover:bg-gray-800 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/40">
            <CreditCard className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Payments</p>
            <p className="text-xs text-gray-500">Fee history</p>
          </div>
        </a>
        <a href="/student"
          className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-green-600 hover:bg-gray-800 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/40">
            <Video className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Recordings</p>
            <p className="text-xs text-gray-500">Class recordings</p>
          </div>
        </a>
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-gray-400">No classes assigned yet</p>
          <p className="mt-1 text-sm text-gray-600">Your coordinator will add you to classes soon</p>
        </div>
      )}
    </div>
  );
}

// ── My Classes Tab ─────────────────────────────────────────────

type FilterKey = 'all' | 'live' | 'scheduled' | 'ended' | 'cancelled';

function MyClassesTab({ assignments }: { assignments: Assignment[] }) {
  const [filter,     setFilter]     = useState<FilterKey>('all');
  const [search,     setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts: Record<FilterKey, number> = {
    all:       assignments.length,
    live:      assignments.filter((a) => effectiveStatus(a) === 'live').length,
    scheduled: assignments.filter((a) => effectiveStatus(a) === 'scheduled').length,
    ended:     assignments.filter((a) => effectiveStatus(a) === 'ended').length,
    cancelled: assignments.filter((a) => effectiveStatus(a) === 'cancelled').length,
  };

  const filtered = assignments
    .filter((a) => filter === 'all' || effectiveStatus(a) === filter)
    .filter((a) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.room_name.toLowerCase().includes(q)          ||
        a.subject.toLowerCase().includes(q)            ||
        a.grade.toLowerCase().includes(q)              ||
        (a.section ?? '').toLowerCase().includes(q)    ||
        (a.teacher_name ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime());

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search by class name, subject, teacher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-700 bg-gray-800/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${filter === f ? 'bg-white/20' : 'bg-gray-700'}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Class list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-600" />
          <p className="text-sm text-gray-400">
            {search ? 'No classes match your search' : 'No classes in this category'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const es         = effectiveStatus(a);
            const s          = STATUS_BADGE[es] ?? STATUS_BADGE.scheduled;
            const isExpanded = expandedId === a.room_id;
            return (
              <div
                key={a.room_id}
                className={`rounded-xl border transition-colors ${
                  isExpanded ? `${s.border} ${s.bg}` : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                }`}
              >
                {/* Clickable row */}
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : a.room_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${s.border} ${s.bg}`}>
                    {es === 'live'      && <Radio        className={`h-5 w-5 ${s.text}`} />}
                    {es === 'ended'     && <CheckCircle2 className={`h-5 w-5 ${s.text}`} />}
                    {es === 'cancelled' && <XCircle      className={`h-5 w-5 ${s.text}`} />}
                    {es === 'scheduled' && <Calendar     className={`h-5 w-5 ${s.text}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{a.room_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{a.subject} · {a.grade}{a.section ? ` · ${a.section}` : ''}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(a.scheduled_start)}</span>
                      {a.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{a.teacher_name}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden text-right sm:block">
                      <p className={`text-xs font-semibold ${s.text}`}>{s.label}</p>
                      <p className="text-xs text-gray-500">{fmtDuration(a.duration_minutes)}</p>
                    </div>
                    {es === 'live' && (
                      <a
                        href={`/join/${a.room_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Join
                      </a>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-800 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-500">Date &amp; Time</p>
                        <p className="text-white">{fmtDate(a.scheduled_start)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-500">Duration</p>
                        <p className="text-white">{fmtDuration(a.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-500">Teacher</p>
                        <p className="text-white">{a.teacher_name ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-500">Payment</p>
                        <PaymentBadge status={a.payment_status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-500">Status</p>
                        <StatusBadge status={es} />
                      </div>
                    </div>

                    {es === 'scheduled' && (
                      <div className="flex items-center gap-2 rounded-lg border border-violet-800/50 bg-violet-950/20 px-3 py-2 text-sm text-violet-300">
                        <Timer className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold">
                          <Countdown scheduledStart={a.scheduled_start} durationMinutes={a.duration_minutes} />
                        </span>
                      </div>
                    )}

                    {a.payment_status === 'pending' && es === 'scheduled' && (
                      <div className="flex items-center gap-2 rounded-lg border border-yellow-800/50 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Payment pending — contact your coordinator to complete payment.
                      </div>
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

// ── Profile Tab ────────────────────────────────────────────────

function ProfileTab({ profile, loading }: { profile: StudentProfile | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
        <User className="mx-auto mb-3 h-10 w-10 text-gray-600" />
        <p className="text-gray-400">Profile not found</p>
        <p className="mt-1 text-sm text-gray-600">Your profile will appear here once HR has filled in your details.</p>
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
    <div className="flex items-start gap-3 border-b border-gray-800 py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
      <div>
        <p className="mb-0.5 text-xs text-gray-500">{label}</p>
        <p className={`text-sm ${value != null && value !== '' ? 'text-white' : 'italic text-gray-600'}`}>
          {value != null && value !== '' ? String(value) : 'Not set'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-violet-800 bg-gradient-to-br from-violet-950/40 to-gray-900 p-6">
        <div className="flex items-center gap-5">
          <Avatar name={profile.name} size={16} color="bg-violet-600" />
          <div>
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
            <p className="mt-0.5 text-sm text-violet-400">Student</p>
            <p className="mt-1 text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>

        {/* Grade / Section badges */}
        {(profile.grade || profile.section || profile.board) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.grade && (
              <span className="flex items-center gap-1 rounded-full border border-violet-700 bg-violet-900/30 px-3 py-0.5 text-xs font-medium text-violet-300">
                <GraduationCap className="h-3 w-3" /> {profile.grade}
              </span>
            )}
            {profile.section && (
              <span className="flex items-center gap-1 rounded-full border border-violet-700 bg-violet-900/30 px-3 py-0.5 text-xs font-medium text-violet-300">
                <BookMarked className="h-3 w-3" /> Section {profile.section}
              </span>
            )}
            {profile.board && (
              <span className="flex items-center gap-1 rounded-full border border-violet-700 bg-violet-900/30 px-3 py-0.5 text-xs font-medium text-violet-300">
                <School className="h-3 w-3" /> {profile.board}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-5">
        <Field label="Phone"       value={profile.phone}        icon={Phone}         />
        <Field label="WhatsApp"    value={profile.whatsapp}     icon={Phone}         />
        <Field
          label="Date of Birth"
          value={
            profile.date_of_birth
              ? fmtDateLongIST(profile.date_of_birth)
              : null
          }
          icon={Calendar}
        />
        <Field label="Board"       value={profile.board}        icon={School}        />
        <Field label="Grade"       value={profile.grade}        icon={GraduationCap} />
        <Field label="Section"     value={profile.section}      icon={BookMarked}    />
        <Field label="Parent Email" value={profile.parent_email} icon={Users}         />
        <Field
          label="Admission Date"
          value={
            profile.admission_date
              ? fmtDateLongIST(profile.admission_date)
              : null
          }
          icon={Calendar}
        />
        {profile.notes && <Field label="Notes" value={profile.notes} icon={Info} />}
      </div>
    </div>
  );
}

// ── Main Dashboard Component ───────────────────────────────────

export default function StudentDashboardClient({ userName, userEmail, userRole }: Props) {
  const [assignments,    setAssignments]    = useState<Assignment[]>([]);
  const [profile,        setProfile]        = useState<StudentProfile | null>(null);
  const [loadingRooms,   setLoadingRooms]   = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeTab,      setActiveTab]      = useState<'overview' | 'classes' | 'profile'>('overview');

  const fetchAssignments = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res  = await fetch('/api/v1/student/rooms');
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) setAssignments(data.data?.rooms ?? []);
    } catch (err) {
      console.error('[Student] rooms fetch failed:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res  = await fetch('/api/v1/student/profile');
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.success) setProfile(data.data);
      else console.error('[Student] profile error:', data.error);
    } catch (err) {
      console.error('[Student] profile fetch failed:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    if (activeTab === 'profile' && !profile) fetchProfile();
  }, [activeTab, profile, fetchProfile]);

  // Auto-refresh every 60 s to pick up live status changes
  useEffect(() => {
    const id = setInterval(fetchAssignments, 60_000);
    return () => clearInterval(id);
  }, [fetchAssignments]);

  const liveCount = assignments.filter((a) => a.status === 'live').length;

  const navItems = [
    { label: 'Dashboard',  href: '/student',         icon: LayoutDashboard, active: true },
    { label: 'My Classes', href: '/student#classes',  icon: BookOpen },
    { label: 'Exams',      href: '/student/exams',   icon: GraduationCap },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'overview' ? 'Student Dashboard'
              : activeTab === 'classes' ? 'My Classes'
              : 'My Profile'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {activeTab === 'overview'
              ? `Welcome back, ${userName.split(' ')[0]}`
              : activeTab === 'classes'
              ? `${assignments.length} class${assignments.length !== 1 ? 'es' : ''} assigned`
              : 'Your account & profile information'}
          </p>
        </div>
        <button
          onClick={fetchAssignments}
          disabled={loadingRooms}
          title="Refresh"
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-800 bg-gray-900/60 p-1">
        {(
          [
            { key: 'overview' as const, label: 'Overview',   icon: LayoutDashboard },
            {
              key:   'classes' as const,
              label: liveCount > 0 ? `My Classes  •  ${liveCount} Live` : 'My Classes',
              icon:  BookOpen,
            },
            { key: 'profile' as const, label: 'My Profile',  icon: User },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
      {activeTab === 'overview' && <OverviewTab assignments={assignments} userName={userName} />}
      {activeTab === 'classes'  && <MyClassesTab assignments={assignments} />}
      {activeTab === 'profile'  && <ProfileTab   profile={profile} loading={loadingProfile} />}
    </DashboardShell>
  );
}

