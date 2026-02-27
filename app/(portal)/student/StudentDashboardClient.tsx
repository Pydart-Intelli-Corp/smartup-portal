// ═══════════════════════════════════════════════════════════════
// Student Dashboard — Client Component
// Tabs: Overview · Batches · Sessions · Sessions · Attendance · Exams · Fees · Materials · Profile
// Theme: light / emerald primary — uses shared UI components
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, SearchInput, TabBar,
  StatCard, Card, Badge, StatusBadge,
  LoadingState, EmptyState, Alert, Avatar, money,
} from '@/components/dashboard/shared';
import { fmtSmartDateIST, fmtTimeIST, fmtDateLongIST } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  GraduationCap, Phone, Timer, Users,
  CreditCard, AlertCircle, Info, BookMarked, School,
  FolderOpen, ExternalLink, TrendingUp, ArrowRight, BarChart2, Activity,
  Receipt, Trophy, FileText, DollarSign, Clipboard, PlayCircle,
  ListChecks, Send, CalendarClock, ClipboardList, Ban, Loader2,
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

interface TeachingMaterial {
  id: string;
  batch_id: string | null;
  batch_name: string | null;
  subject: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  material_type: string;
  created_at: string;
  file_size: number | null;
  mime_type: string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

// ── Batch & Attendance Types ───────────────────────────────────

interface BatchTeacher {
  subject: string;
  is_primary: boolean;
  teacher_name: string;
  teacher_email: string;
}

interface BatchDetail {
  id: string;
  name: string;
  type: string;
  grade: string | null;
  section: string | null;
  subjects: string[];
  status: string;
  max_students: number;
  notes: string | null;
  enrolled_at: string;
  coordinator: { name: string | null; email: string | null };
  ao_name: string | null;
  teachers: BatchTeacher[];
  stats: { total_sessions: number; completed_sessions: number; upcoming_sessions: number };
  attendance: { total: number; present: number; absent: number; late: number; rate: number };
}

interface AttendanceRecord {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  section: string | null;
  scheduled_start: string;
  duration_minutes: number;
  room_status: string;
  teacher_name: string | null;
  status: string | null;
  is_late: boolean | null;
  late_by_seconds: number | null;
  first_join_at: string | null;
  last_leave_at: string | null;
  time_in_class_seconds: number | null;
  join_count: number | null;
  engagement_score: number | null;
  mic_off_count: number;
  camera_off_count: number;
  leave_request_count: number;
  attention_avg: number | null;
}

interface SubjectAttendance {
  subject: string;
  total: number;
  present: number;
  absent: number;
  rate: number;
}

interface AttendanceSummaryData {
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  attendance_rate: number;
  avg_time_minutes: number;
  total_rejoins: number;
}

// ── Session Types ──────────────────────────────────────────────

interface SessionData {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number | null;
  status: string;
  livekit_room_name: string | null;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  batch_name: string;
  batch_type: string;
  grade: string | null;
  section: string | null;
  attendance_status: string | null;
  is_late: boolean | null;
  first_join_at: string | null;
  last_leave_at: string | null;
  time_in_class_seconds: number | null;
  join_count: number | null;
  engagement_score: number | null;
  class_portion: string | null;
  class_remarks: string | null;
}

interface SessionTodayStats {
  total: number;
  live: number;
  upcoming: number;
  completed: number;
  cancelled: number;
}

// ── Session Request / Availability Types ───────────────────────

interface SessionRequest {
  id: string;
  request_type: 'reschedule' | 'cancel';
  requester_email: string;
  batch_session_id: string;
  batch_id: string;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  batch_name?: string;
  subject?: string;
  session_date?: string;
  requester_name?: string;
}

interface AvailabilitySlot {
  id: string;
  student_email: string;
  batch_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  preference: 'available' | 'preferred' | 'unavailable';
  notes: string | null;
  is_active: boolean;
}

// ── Fee Types ──────────────────────────────────────────────────

interface FeesSummaryData {
  total_invoices: number;
  total_invoiced_paise: number;
  total_paid_paise: number;
  total_pending_paise: number;
  pending_count: number;
  paid_count: number;
  overdue_count: number;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  description: string | null;
  billing_period: string | null;
  amount_paise: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface ReceiptData {
  receipt_number: string;
  invoice_id: string;
  amount_paise: number;
  payment_method: string | null;
  paid_at: string;
  invoice_description: string | null;
  billing_period: string | null;
}

// ── Exam Types ─────────────────────────────────────────────────

interface ExamData {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  scheduled_at: string | null;
  ends_at: string | null;
  attempt_status: string | null;
  attempt_score: number | null;
  attempt_percentage: number | null;
  attempt_grade: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-600', A: 'text-green-600',
  'B+': 'text-blue-600', B: 'text-blue-600',
  'C+': 'text-yellow-600', C: 'text-yellow-600',
  D: 'text-orange-600', F: 'text-red-600',
};

// ── Helpers ────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function effectiveStatus(a: Assignment): string {
  if (a.status === 'scheduled') {
    const endMs = new Date(a.scheduled_start).getTime() + a.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return a.status;
}

// ── Payment Badge ──────────────────────────────────────────────

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'info'; label: string }> = {
    paid:    { variant: 'success', label: 'Paid' },
    exempt:  { variant: 'info',    label: 'Free' },
    pending: { variant: 'warning', label: 'Pending' },
  };
  const s = map[status] ?? { variant: 'default' as const, label: status };
  return <Badge label={s.label} variant={s.variant} icon={CreditCard} />;
}

// ── Countdown ──────────────────────────────────────────────────

function Countdown({ scheduledStart, durationMinutes }: { scheduledStart: string; durationMinutes: number }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const startMs = new Date(scheduledStart).getTime();
      const endMs = startMs + durationMinutes * 60_000;
      if (now < startMs) {
        const diff = startMs - now;
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Starts in ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`);
      } else if (now < endMs) {
        const diff = endMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`${m}m ${s}s remaining`);
      } else {
        setLabel('Session ended');
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [scheduledStart, durationMinutes]);
  return <>{label}</>;
}

// ── Overview Tab ───────────────────────────────────────────────

function OverviewTab({
  assignments, userName, batches, attendanceSummary, sessions, exams, feesSummary, router,
}: {
  assignments: Assignment[];
  userName: string;
  batches: BatchDetail[];
  attendanceSummary: AttendanceSummaryData | null;
  sessions: SessionData[];
  exams: ExamData[];
  feesSummary: FeesSummaryData | null;
  router: ReturnType<typeof useRouter>;
}) {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-IN');
  const liveAssignments = assignments.filter((a) => effectiveStatus(a) === 'live');
  const scheduled = assignments.filter((a) => effectiveStatus(a) === 'scheduled');
  const ended = assignments.filter((a) => effectiveStatus(a) === 'ended');
  const pendingPayments = assignments.filter((a) => a.payment_status === 'pending');
  const todayClasses = assignments.filter((a) => {
    const d = new Date(a.scheduled_start);
    return d.toLocaleDateString('en-IN') === todayStr;
  });
  const nextClass = [...scheduled].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
  )[0];

  return (
    <div className="space-y-6">
      {/* Live Join Banner */}
      {liveAssignments.length > 0 && (
        <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Radio className="h-5 w-5 text-green-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">
                {liveAssignments.length} Session{liveAssignments.length > 1 ? 's' : ''} Live Now
              </p>
              <p className="text-sm text-green-700">
                {liveAssignments.map((a) => a.room_name).join(', ')}
              </p>
            </div>
            <a
              href={`/join/${liveAssignments[0].room_id}`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition-colors"
            >
              Join Session
            </a>
          </div>
        </div>
      )}

      {/* Payment Alert */}
      {pendingPayments.length > 0 && (
        <Alert
          variant="warning"
          message={`${pendingPayments.length} session${pendingPayments.length > 1 ? 's have' : ' has'} pending payment. Contact your coordinator.`}
        />
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={GraduationCap} label="Batches Enrolled" value={batches.length} variant="info" />
        <StatCard icon={Radio} label="Live Now" value={liveAssignments.length} variant="success" />
        <StatCard icon={Calendar} label="Upcoming" value={scheduled.length} variant="info" />
        <StatCard icon={CheckCircle2} label="Completed" value={ended.length} />
        <StatCard
          icon={TrendingUp}
          label="Attendance Rate"
          value={attendanceSummary ? `${attendanceSummary.attendance_rate}%` : '—'}
          variant={
            attendanceSummary
              ? attendanceSummary.attendance_rate >= 75 ? 'success'
              : attendanceSummary.attendance_rate >= 50 ? 'warning' : 'danger'
              : 'default'
          }
        />
      </div>

      {/* Exam & Fee Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          label="Exams Taken"
          value={exams.filter(e => e.attempt_status === 'graded').length}
        />
        <StatCard
          icon={BarChart2}
          label="Avg Score"
          value={(() => {
            const graded = exams.filter(e => e.attempt_percentage != null);
            if (graded.length === 0) return '—';
            const avg = graded.reduce((s, e) => s + (e.attempt_percentage ?? 0), 0) / graded.length;
            return `${Math.round(avg)}%`;
          })()}
          variant={(() => {
            const graded = exams.filter(e => e.attempt_percentage != null);
            if (graded.length === 0) return 'default' as const;
            const avg = graded.reduce((s, e) => s + (e.attempt_percentage ?? 0), 0) / graded.length;
            return avg >= 75 ? 'success' as const : avg >= 50 ? 'warning' as const : 'danger' as const;
          })()}
        />
        <StatCard
          icon={CreditCard}
          label="Pending Fees"
          value={feesSummary ? money(feesSummary.total_pending_paise) : '—'}
          variant={feesSummary && feesSummary.total_pending_paise > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon={DollarSign}
          label="Total Paid"
          value={feesSummary ? money(feesSummary.total_paid_paise) : '—'}
          variant="success"
        />
      </div>

      {/* Fee due alert */}
      {feesSummary && feesSummary.overdue_count > 0 && (
        <Alert
          variant="error"
          message={`${feesSummary.overdue_count} invoice${feesSummary.overdue_count > 1 ? 's are' : ' is'} overdue (${money(feesSummary.total_pending_paise)} pending). Contact your coordinator immediately.`}
        />
      )}

      {/* Next Session */}
      {nextClass && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-800">Next Session</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">{nextClass.room_name}</p>
              <p className="text-sm text-gray-500">
                {nextClass.subject} · {nextClass.grade}{nextClass.section ? ` · ${nextClass.section}` : ''}
                {nextClass.teacher_name && ` · ${nextClass.teacher_name}`}
              </p>
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {fmtSmartDateIST(nextClass.scheduled_start)}
                </span>
                <span>{fmtDuration(nextClass.duration_minutes)}</span>
                <PaymentBadge status={nextClass.payment_status} />
              </div>
            </div>
            <div className="text-right">
              <div className="rounded-lg bg-teal-50 border border-teal-200 px-3 py-2 text-sm font-mono font-bold text-teal-700">
                <Countdown scheduledStart={nextClass.scheduled_start} durationMinutes={nextClass.duration_minutes} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-800">Today&apos;s Schedule</h3>
          <Badge label={`${todayClasses.length} session${todayClasses.length !== 1 ? 's' : ''}`} variant="default" />
        </div>

        {todayClasses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No sessions scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {todayClasses
              .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
              .map((a) => {
                const es = effectiveStatus(a);
                return (
                  <div
                    key={a.room_id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                  >
                    <div className="text-sm font-mono font-semibold text-gray-500 w-16 shrink-0">
                      {fmtTimeIST(new Date(a.scheduled_start))}
                    </div>
                    <div className="h-8 w-0.5 rounded bg-gray-200" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{a.room_name}</p>
                      <p className="text-xs text-gray-500">
                        {a.subject} · {fmtDuration(a.duration_minutes)}
                        {a.teacher_name && ` · ${a.teacher_name}`}
                      </p>
                    </div>
                    <StatusBadge status={es} />
                    {es === 'live' && (
                      <a
                        href={`/join/${a.room_id}`}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Join
                      </a>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* Upcoming Sessions */}
      {sessions.length > 0 && (() => {
        const upcoming = sessions
          .filter(s => s.status === 'scheduled')
          .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.start_time.localeCompare(b.start_time))
          .slice(0, 5);
        if (upcoming.length === 0) return null;
        return (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-800">Upcoming Sessions</h3>
              <Badge label={`${upcoming.length}`} variant="info" />
            </div>
            <div className="space-y-2">
              {upcoming.map(s => (
                <div key={s.session_id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div className="text-sm font-mono font-semibold text-gray-500 w-20 shrink-0">
                    {s.scheduled_date.slice(5)} {s.start_time.slice(0, 5)}
                  </div>
                  <div className="h-8 w-0.5 rounded bg-gray-200" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{s.subject}</p>
                    <p className="text-xs text-gray-500">
                      {s.batch_name}{s.teacher_name && ` · ${s.teacher_name}`}
                      {s.topic && ` · ${s.topic}`}
                    </p>
                  </div>
                  <Badge label={fmtDuration(s.duration_minutes)} variant="default" />
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Recent Exam Results */}
      {exams.length > 0 && (() => {
        const graded = exams
          .filter(e => e.attempt_status === 'graded')
          .slice(0, 4);
        const available = exams
          .filter(e => !e.attempt_status || e.attempt_status === 'in_progress')
          .slice(0, 3);
        if (graded.length === 0 && available.length === 0) return null;
        return (
          <div className="grid gap-4 md:grid-cols-2">
            {graded.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-gray-800">Recent Results</h3>
                </div>
                <div className="space-y-2">
                  {graded.map(e => {
                    const passed = Number(e.attempt_percentage) >= (e.passing_marks / e.total_marks * 100);
                    return (
                      <div key={e.id} className={`flex items-center gap-3 rounded-lg border p-3 ${passed ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/30'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                          <p className="text-xs text-gray-500">{e.subject} · {e.attempt_score}/{e.total_marks}</p>
                        </div>
                        <span className={`text-lg font-bold ${GRADE_COLORS[e.attempt_grade ?? ''] ?? 'text-gray-400'}`}>{e.attempt_grade}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {available.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Pending Exams</h3>
                  <Badge label={`${available.length}`} variant="warning" />
                </div>
                <div className="space-y-2">
                  {available.map(e => (
                    <div key={e.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                        <p className="text-xs text-gray-500">{e.subject} · {e.duration_minutes}m · {e.total_marks} marks</p>
                      </div>
                      <button
                        onClick={() => router.push(`/student/exams/${e.id}`)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shrink-0"
                      >
                        {e.attempt_status === 'in_progress' ? 'Continue' : 'Start'}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── My Sessions Tab ─────────────────────────────────────────────

type FilterKey = 'all' | 'live' | 'scheduled' | 'ended' | 'cancelled';

function MyClassesTab({ assignments }: { assignments: Assignment[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filtered = assignments.filter((a) => {
    const es = effectiveStatus(a);
    const matchSearch =
      !q || a.room_name.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || es === filter;
    return matchSearch && matchFilter;
  });

  const counts: Record<FilterKey, number> = {
    all: assignments.length,
    live: assignments.filter((a) => effectiveStatus(a) === 'live').length,
    scheduled: assignments.filter((a) => effectiveStatus(a) === 'scheduled').length,
    ended: assignments.filter((a) => effectiveStatus(a) === 'ended').length,
    cancelled: assignments.filter((a) => effectiveStatus(a) === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search sessions…" className="w-64" />
        <div className="flex flex-wrap gap-2">
          {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                filter === f ? 'bg-white/20' : 'bg-white'
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Class list */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message={search ? 'No sessions match your search' : 'No sessions in this category'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const es = effectiveStatus(a);
            const isExpanded = expandedId === a.room_id;
            return (
              <Card
                key={a.room_id}
                className={`overflow-hidden transition-colors ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}
              >
                {/* Clickable row */}
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : a.room_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    es === 'live' ? 'bg-green-100' :
                    es === 'scheduled' ? 'bg-teal-50' :
                    es === 'cancelled' ? 'bg-red-50' : 'bg-gray-100'
                  }`}>
                    {es === 'live'      && <Radio        className="h-5 w-5 text-green-600" />}
                    {es === 'ended'     && <CheckCircle2 className="h-5 w-5 text-gray-400" />}
                    {es === 'cancelled' && <XCircle      className="h-5 w-5 text-red-500" />}
                    {es === 'scheduled' && <Calendar     className="h-5 w-5 text-teal-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{a.room_name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{a.subject} · {a.grade}{a.section ? ` · ${a.section}` : ''}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtSmartDateIST(a.scheduled_start)}
                      </span>
                      {a.teacher_name && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {a.teacher_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <StatusBadge status={es} />
                      <p className="mt-1 text-xs text-gray-400">{fmtDuration(a.duration_minutes)}</p>
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
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Date &amp; Time</p>
                        <p className="text-gray-800">{fmtSmartDateIST(a.scheduled_start)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Duration</p>
                        <p className="text-gray-800">{fmtDuration(a.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Teacher</p>
                        <p className="text-gray-800">{a.teacher_name ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Payment</p>
                        <PaymentBadge status={a.payment_status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Status</p>
                        <StatusBadge status={es} />
                      </div>
                    </div>

                    {es === 'scheduled' && (
                      <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                        <Timer className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold">
                          <Countdown scheduledStart={a.scheduled_start} durationMinutes={a.duration_minutes} />
                        </span>
                      </div>
                    )}

                    {a.payment_status === 'pending' && es === 'scheduled' && (
                      <Alert
                        variant="warning"
                        message="Payment pending — contact your coordinator to complete payment."
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────

function ProfileTab({ profile, loading }: { profile: StudentProfile | null; loading: boolean }) {
  if (loading) return <LoadingState />;

  if (!profile) {
    return <EmptyState icon={User} message="Your profile will appear here once HR has filled in your details." />;
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
    <div className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <p className="mb-0.5 text-xs text-gray-400">{label}</p>
        <p className={`text-sm ${value != null && value !== '' ? 'text-gray-800' : 'italic text-gray-400'}`}>
          {value != null && value !== '' ? String(value) : 'Not set'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <Avatar name={profile.name} size="lg" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
            <p className="mt-0.5 text-sm font-medium text-emerald-600">Student</p>
            <p className="mt-1 text-xs text-gray-500">{profile.email}</p>
          </div>
        </div>

        {/* Grade / Section badges */}
        {(profile.grade || profile.section || profile.board) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.grade && (
              <Badge label={profile.grade} variant="primary" icon={GraduationCap} />
            )}
            {profile.section && (
              <Badge label={`Section ${profile.section}`} variant="primary" icon={BookMarked} />
            )}
            {profile.board && (
              <Badge label={profile.board} variant="info" icon={School} />
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <Card className="px-5">
        <Field label="Phone" value={profile.phone} icon={Phone} />
        <Field label="WhatsApp" value={profile.whatsapp} icon={Phone} />
        <Field
          label="Date of Birth"
          value={profile.date_of_birth ? fmtDateLongIST(profile.date_of_birth) : null}
          icon={Calendar}
        />
        <Field label="Board" value={profile.board} icon={School} />
        <Field label="Grade" value={profile.grade} icon={GraduationCap} />
        <Field label="Section" value={profile.section} icon={BookMarked} />
        <Field label="Parent Email" value={profile.parent_email} icon={Users} />
        <Field
          label="Admission Date"
          value={profile.admission_date ? fmtDateLongIST(profile.admission_date) : null}
          icon={Calendar}
        />
        {profile.notes && <Field label="Notes" value={profile.notes} icon={Info} />}
      </Card>
    </div>
  );
}

// ── Main Dashboard Component ───────────────────────────────────

export default function StudentDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);
  const [batches, setBatches] = useState<BatchDetail[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummaryData | null>(null);
  const [attendanceBySubject, setAttendanceBySubject] = useState<SubjectAttendance[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionTodayStats, setSessionTodayStats] = useState<SessionTodayStats | null>(null);
  const [feesSummary, setFeesSummary] = useState<FeesSummaryData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [exams, setExams] = useState<ExamData[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Sync tab with URL hash (sidebar nav clicks)
  useEffect(() => {
    const validTabs = ['overview', 'batches', 'sessions', 'attendance', 'exams', 'fees', 'materials', 'requests', 'profile'];
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && validTabs.includes(hash)) setActiveTab(hash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const changeTab = useCallback((key: string) => {
    setActiveTab(key);
    window.location.hash = key === 'overview' ? '' : key;
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/v1/student/rooms');
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

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch('/api/v1/student/batches');
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches ?? []);
    } catch (err) {
      console.error('[Student] batches fetch failed:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const res = await fetch('/api/v1/student/attendance');
      const data = await res.json();
      if (data.success) {
        setAttendanceRecords(data.data?.records ?? []);
        setAttendanceSummary(data.data?.summary ?? null);
        setAttendanceBySubject(data.data?.by_subject ?? []);
      }
    } catch (err) {
      console.error('[Student] attendance fetch failed:', err);
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const res = await fetch('/api/v1/teaching-materials');
      const data = await res.json();
      if (data.success) setMaterials(data.data?.materials ?? []);
    } catch (err) {
      console.error('[Student] materials fetch failed:', err);
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch('/api/v1/student/profile');
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

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/v1/student/sessions?range=all');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data?.sessions ?? []);
        setSessionTodayStats(data.data?.today ?? null);
      }
    } catch (err) {
      console.error('[Student] sessions fetch failed:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchFees = useCallback(async () => {
    setLoadingFees(true);
    try {
      const res = await fetch('/api/v1/student/fees');
      const data = await res.json();
      if (data.success) {
        setFeesSummary(data.data?.summary ?? null);
        setInvoices(data.data?.invoices ?? []);
        setReceipts(data.data?.receipts ?? []);
      }
    } catch (err) {
      console.error('[Student] fees fetch failed:', err);
    } finally {
      setLoadingFees(false);
    }
  }, []);

  // ── Razorpay payment ────────────────────────────────
  const getRazorpay = () => (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;

  const handlePayInvoice = useCallback(async (invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      const res = await fetch('/api/v1/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Payment initiation failed'); return; }

      const order = data.data;

      if (order.mode === 'test' || order.mode === 'mock') {
        // Mock/test mode: auto-complete
        const cbRes = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: invoiceId }),
        });
        const cbData = await cbRes.json();
        if (cbData.success) { fetchFees(); }
        else { alert('Payment failed'); }
      } else {
        // Live Razorpay checkout
        const Razorpay = getRazorpay();
        if (!Razorpay) { alert('Payment gateway loading, please try again...'); return; }
        const rzp = new Razorpay({
          key: order.gatewayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: 'SmartUp Academy',
          description: 'Fee Payment',
          order_id: order.orderId,
          prefill: order.prefill,
          theme: { color: '#059669' },
          handler: async (response: Record<string, string>) => {
            await fetch('/api/v1/payment/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            fetchFees();
          },
        });
        rzp.open();
      }
    } catch { alert('Network error'); }
    finally { setPayingInvoice(null); }
  }, [fetchFees]);

  const fetchExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const res = await fetch('/api/v1/exams?role=student');
      const data = await res.json();
      if (data.success) setExams(data.data?.exams ?? []);
    } catch (err) {
      console.error('[Student] exams fetch failed:', err);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  const fetchSessionRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.requests ?? []);
    } catch (err) {
      console.error('[Student] session-requests fetch failed:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    setLoadingAvailability(true);
    try {
      const res = await fetch('/api/v1/student-availability');
      const data = await res.json();
      if (data.success) setAvailability(data.slots ?? []);
    } catch (err) {
      console.error('[Student] availability fetch failed:', err);
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); fetchBatches(); fetchAttendance(); }, [fetchAssignments, fetchBatches, fetchAttendance]);

  useEffect(() => {
    if (activeTab === 'profile' && !profile) fetchProfile();
  }, [activeTab, profile, fetchProfile]);

  useEffect(() => {
    if (activeTab === 'materials') fetchMaterials();
  }, [activeTab, fetchMaterials]);

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions();
  }, [activeTab, fetchSessions]);

  useEffect(() => {
    if (activeTab === 'batches') fetchBatches();
  }, [activeTab, fetchBatches]);

  useEffect(() => {
    if (activeTab === 'fees' && !feesSummary) fetchFees();
  }, [activeTab, feesSummary, fetchFees]);

  useEffect(() => {
    if ((activeTab === 'exams' || activeTab === 'overview') && exams.length === 0) fetchExams();
  }, [activeTab, exams.length, fetchExams]);

  useEffect(() => {
    if (activeTab === 'requests' && sessionRequests.length === 0) { fetchSessionRequests(); fetchAvailability(); }
  }, [activeTab, sessionRequests.length, fetchSessionRequests, fetchAvailability]);

  useEffect(() => {
    if (activeTab === 'overview' && !feesSummary) fetchFees();
  }, [activeTab, feesSummary, fetchFees]);

  useEffect(() => {
    if (activeTab === 'overview' && sessions.length === 0) fetchSessions();
  }, [activeTab, sessions.length, fetchSessions]);

  // Poll sessions every 20 seconds to pick up live-status changes
  useEffect(() => {
    const id = setInterval(fetchSessions, 20_000);
    return () => clearInterval(id);
  }, [fetchSessions]);

  useEffect(() => {
    const id = setInterval(fetchAssignments, 60_000);
    return () => clearInterval(id);
  }, [fetchAssignments]);

  const sessionLiveCount = sessions.filter(s => s.status === 'live').length;
  const completedExams = exams.filter(e => e.attempt_status === 'graded' || e.attempt_status === 'submitted');
  const refreshAll = useCallback(() => {
    fetchAssignments(); fetchBatches(); fetchAttendance(); fetchSessions();
  }, [fetchAssignments, fetchBatches, fetchAttendance, fetchSessions]);

  const tabs = [
    { key: 'overview',   label: 'Overview',   icon: LayoutDashboard },
    { key: 'batches',    label: `Batches${batches.length > 0 ? ` · ${batches.length}` : ''}`, icon: BookOpen },
    { key: 'sessions',   label: sessionLiveCount > 0 ? `Sessions · ${sessionLiveCount} Live` : sessionTodayStats ? `Sessions · ${sessionTodayStats.total} Today` : 'Sessions', icon: Calendar },
    { key: 'attendance', label: attendanceSummary ? `Attendance · ${attendanceSummary.attendance_rate}%` : 'Attendance', icon: CheckCircle2 },
    { key: 'exams',      label: `Exams${completedExams.length > 0 ? ` · ${completedExams.length} Done` : ''}`, icon: Trophy },
    { key: 'fees',       label: feesSummary && feesSummary.overdue_count > 0 ? `Fees · ${feesSummary.overdue_count} Due` : 'Fees', icon: CreditCard },
    { key: 'materials',  label: 'Materials',  icon: FolderOpen },
    { key: 'requests',   label: `Requests${sessionRequests.filter(r => r.status === 'pending').length > 0 ? ` · ${sessionRequests.filter(r => r.status === 'pending').length}` : ''}`, icon: ClipboardList },
    { key: 'profile',    label: 'Profile', icon: User },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={GraduationCap}
            title="Student Dashboard"
            subtitle={`Welcome back, ${userName.split(' ')[0]}`}
          />
          <RefreshButton loading={loadingRooms || loadingBatches} onClick={refreshAll} />
        </div>

        <TabBar tabs={tabs} active={activeTab} onChange={changeTab} />

        {(loadingRooms || loadingBatches) && assignments.length === 0 && batches.length === 0 ? (
          <LoadingState />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                assignments={assignments}
                userName={userName}
                batches={batches}
                attendanceSummary={attendanceSummary}
                sessions={sessions}
                exams={exams}
                feesSummary={feesSummary}
                router={router}
              />
            )}
            {activeTab === 'batches' && (
              <BatchesTab batches={batches} loading={loadingBatches} onRefresh={fetchBatches} />
            )}
            {activeTab === 'sessions' && (
              <SessionsTab
                sessions={sessions}
                todayStats={sessionTodayStats}
                loading={loadingSessions}
                onRefresh={fetchSessions}
              />
            )}
            {activeTab === 'attendance' && (
              <AttendanceTab
                records={attendanceRecords}
                summary={attendanceSummary}
                bySubject={attendanceBySubject}
                loading={loadingAttendance}
                onRefresh={fetchAttendance}
              />
            )}
            {activeTab === 'exams' && (
              <ExamsTab exams={exams} loading={loadingExams} onRefresh={fetchExams} router={router} />
            )}
            {activeTab === 'fees' && (
              <FeesTab
                summary={feesSummary}
                invoices={invoices}
                receipts={receipts}
                loading={loadingFees}
                onRefresh={fetchFees}
                onPay={handlePayInvoice}
                payingId={payingInvoice}
              />
            )}
            {activeTab === 'materials' && (
              <StudentMaterialsTab materials={materials} loading={loadingMaterials} onRefresh={fetchMaterials} />
            )}
            {activeTab === 'requests' && (
              <RequestsTab
                requests={sessionRequests}
                availability={availability}
                sessions={sessions}
                batches={batches}
                loading={loadingRequests}
                loadingAvailability={loadingAvailability}
                onRefresh={() => { fetchSessionRequests(); fetchAvailability(); }}
                userEmail={userEmail}
                userName={userName}
              />
            )}
            {activeTab === 'profile' && <ProfileTab profile={profile} loading={loadingProfile} />}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// ── Batches Tab ────────────────────────────────────────────────

const BATCH_TYPE_LABEL: Record<string, string> = {
  one_to_one:   '1:1', one_to_three: '1:3',
  one_to_many:  'Classroom', custom: 'Custom',
};
const BATCH_TYPE_VARIANT: Record<string, 'primary' | 'info' | 'default' | 'warning'> = {
  one_to_one:   'info',    one_to_three: 'primary',
  one_to_many:  'default', custom:       'warning',
};

function BatchesTab({
  batches, loading, onRefresh,
}: { batches: BatchDetail[]; loading: boolean; onRefresh: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading && batches.length === 0) return <LoadingState />;
  if (!loading && batches.length === 0) {
    return <EmptyState icon={BookOpen} message="You haven't been assigned to any batch yet. Contact your coordinator." />;
  }

  const attColor  = (r: number) => r >= 75 ? 'text-green-600' : r >= 50 ? 'text-amber-600' : 'text-red-600';
  const attBar    = (r: number) => r >= 75 ? 'bg-green-500' : r >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} enrolled</p>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {batches.map(b => {
        const isExpanded = expandedId === b.id;
        const rate = b.attendance.rate;
        return (
          <Card key={b.id} className={`overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}>
            <button
              className="flex w-full items-start gap-4 p-5 text-left"
              onClick={() => setExpandedId(isExpanded ? null : b.id)}
            >
              {/* Icon */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <GraduationCap className="h-6 w-6 text-emerald-600" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <Badge label={BATCH_TYPE_LABEL[b.type] ?? b.type} variant={BATCH_TYPE_VARIANT[b.type] ?? 'default'} />
                  {b.status !== 'active' && <Badge label={b.status} variant="warning" />}
                </div>
                <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-gray-500">
                  {b.grade && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {b.grade}{b.section ? ` · ${b.section}` : ''}
                    </span>
                  )}
                  {b.subjects?.length > 0 && <span>{b.subjects.join(', ')}</span>}
                  {b.coordinator.name && (
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.coordinator.name}</span>
                  )}
                </div>
                {/* Attendance bar */}
                {b.attendance.total > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div className={`h-full rounded-full ${attBar(rate)}`} style={{ width: `${rate}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${attColor(rate)}`}>{rate}%</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{b.attendance.present}/{b.attendance.total} sessions attended</p>
                  </div>
                )}
              </div>

              {/* Stats column */}
              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Sessions</p>
                  <p className="text-sm font-bold text-gray-800">{b.stats.total_sessions}</p>
                </div>
                {b.stats.upcoming_sessions > 0 && (
                  <Badge label={`${b.stats.upcoming_sessions} upcoming`} variant="info" />
                )}
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-400 mt-1" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: 'Total', val: b.stats.total_sessions,     cls: 'text-gray-900' },
                    { label: 'Done',  val: b.stats.completed_sessions, cls: 'text-emerald-700' },
                    { label: 'Upcoming', val: b.stats.upcoming_sessions, cls: 'text-teal-700' },
                    { label: 'Rate',  val: `${rate}%`,                 cls: attColor(rate) },
                    { label: 'Present', val: b.attendance.present,     cls: 'text-green-700' },
                    { label: 'Absent',  val: b.attendance.absent,      cls: 'text-red-600' },
                  ].map(x => (
                    <div key={x.label} className="rounded-lg bg-white border border-gray-100 p-2 text-center">
                      <p className={`text-base font-bold ${x.cls}`}>{x.val}</p>
                      <p className="text-[10px] text-gray-400">{x.label}</p>
                    </div>
                  ))}
                </div>

                {/* Teachers */}
                {b.teachers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Teachers</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {b.teachers.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                          <Avatar name={t.teacher_name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{t.teacher_name}</p>
                            <p className="text-[10px] text-gray-500">{t.subject}{t.is_primary ? ' · Primary' : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coordinator + AO */}
                {(b.coordinator.name || b.ao_name) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {b.coordinator.name && (
                      <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <p className="text-[10px] text-gray-400">Batch Coordinator</p>
                        <p className="text-xs font-medium text-gray-800">{b.coordinator.name}</p>
                        {b.coordinator.email && <p className="text-[10px] text-gray-400 truncate">{b.coordinator.email}</p>}
                      </div>
                    )}
                    {b.ao_name && (
                      <div className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <p className="text-[10px] text-gray-400">Academic Operator</p>
                        <p className="text-xs font-medium text-gray-800">{b.ao_name}</p>
                      </div>
                    )}
                  </div>
                )}

                {b.notes && <Alert variant="info" message={b.notes} />}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────

function AttendanceTab({
  records, summary, bySubject, loading, onRefresh,
}: {
  records: AttendanceRecord[];
  summary: AttendanceSummaryData | null;
  bySubject: SubjectAttendance[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus,  setFilterStatus]  = useState<'' | 'present' | 'absent' | 'late'>('');

  const subjects = Array.from(new Set(records.map(r => r.subject))).filter(Boolean).sort();

  const filtered = records
    .filter(r => !filterSubject || r.subject === filterSubject)
    .filter(r => {
      if (!filterStatus) return true;
      if (filterStatus === 'late')    return r.is_late === true;
      if (filterStatus === 'present') return r.status === 'present';
      if (filterStatus === 'absent')  return r.status === 'absent' || (!r.status && r.room_status === 'ended');
      return true;
    });

  const attColor  = (rate: number) => rate >= 75 ? 'text-green-700' : rate >= 50 ? 'text-amber-700' : 'text-red-600';
  const attBar    = (rate: number) => rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> My Attendance
        </h2>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Attendance Rate */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">Attendance Rate</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className={`text-2xl font-bold ${attColor(summary.attendance_rate)}`}>{summary.attendance_rate}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${attBar(summary.attendance_rate)}`} style={{ width: `${summary.attendance_rate}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{summary.present}/{summary.total_sessions} sessions attended</p>
          </div>
          <StatCard icon={BookOpen}      label="Total Sessions" value={summary.total_sessions} />
          <StatCard icon={CheckCircle2}  label="Present"       value={summary.present}         variant="success" />
          <StatCard icon={XCircle}       label="Absent"        value={summary.absent}           variant="danger" />
        </div>
      )}

      {/* Subject-wise breakdown table */}
      {bySubject.length > 0 && (
        <Card className="p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5" /> Subject-wise Attendance
          </h3>
          <div className="space-y-2">
            {bySubject.map(sub => (
              <div key={sub.subject} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{sub.subject}</p>
                  <p className="text-[10px] text-gray-400">{sub.present}/{sub.total}</p>
                </div>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${attBar(sub.rate)}`} style={{ width: `${sub.rate}%` }} />
                </div>
                <span className={`w-10 text-right text-xs font-bold shrink-0 ${attColor(sub.rate)}`}>{sub.rate}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Classroom Behaviour Summary (from media tracking) ── */}
      {(() => {
        const presentRecords = records.filter(r => r.status === 'present');
        const totalMicOff = presentRecords.reduce((s, r) => s + (r.mic_off_count || 0), 0);
        const totalCamOff = presentRecords.reduce((s, r) => s + (r.camera_off_count || 0), 0);
        const totalLeaveReq = presentRecords.reduce((s, r) => s + (r.leave_request_count || 0), 0);
        const attentionScores = presentRecords.filter(r => r.attention_avg !== null).map(r => r.attention_avg as number);
        const avgAttention = attentionScores.length > 0
          ? Math.round(attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length)
          : null;
        if (totalMicOff === 0 && totalCamOff === 0 && totalLeaveReq === 0 && avgAttention === null) return null;
        return (
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Classroom Behaviour
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {totalMicOff > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-700">{totalMicOff}</p>
                  <p className="text-[10px] text-gray-400">Mic Off Events</p>
                </div>
              )}
              {totalCamOff > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-700">{totalCamOff}</p>
                  <p className="text-[10px] text-gray-400">Camera Off Events</p>
                </div>
              )}
              {totalLeaveReq > 0 && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-700">{totalLeaveReq}</p>
                  <p className="text-[10px] text-gray-400">Leave Requests</p>
                </div>
              )}
              {avgAttention !== null && (
                <div className={`rounded-lg border p-3 text-center ${
                  avgAttention >= 70 ? 'border-green-200 bg-green-50' : avgAttention >= 40 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
                }`}>
                  <p className={`text-lg font-bold ${avgAttention >= 70 ? 'text-green-700' : avgAttention >= 40 ? 'text-amber-700' : 'text-red-600'}`}>{avgAttention}%</p>
                  <p className="text-[10px] text-gray-400">Avg Attention</p>
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {subjects.length > 1 && (
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="flex gap-2 flex-wrap">
          {(['', 'present', 'absent', 'late'] as const).map(f => (
            <button
              key={f || 'all'}
              onClick={() => setFilterStatus(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filterStatus === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f || 'All'} ({f === '' ? records.length : filtered.length})
            </button>
          ))}
        </div>
        {filtered.length !== records.length && (
          <span className="text-xs text-gray-400">{filtered.length} shown</span>
        )}
      </div>

      {/* Records list */}
      {loading && records.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No attendance records yet. Records appear once sessions have been held." />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const isPresent = r.status === 'present';
            const isAbsent  = r.status === 'absent' || (!r.status && r.room_status === 'ended');
            const isLate    = r.is_late === true;
            const timeMins  = r.time_in_class_seconds ? Math.round(r.time_in_class_seconds / 60) : null;
            return (
              <div
                key={r.room_id + r.scheduled_start}
                className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                  isPresent
                    ? isLate ? 'border-amber-200 bg-amber-50/30' : 'border-green-200 bg-green-50/30'
                    : isAbsent ? 'border-red-200 bg-red-50/20' : 'border-gray-100 bg-white'
                }`}
              >
                {/* Status icon */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isPresent ? (isLate ? 'bg-amber-100' : 'bg-green-100') : isAbsent ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {isPresent
                    ? isLate ? <Timer className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : isAbsent ? <XCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-gray-400" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.room_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span>{r.subject}</span>
                    {r.teacher_name && <span>{r.teacher_name}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{fmtSmartDateIST(r.scheduled_start)}
                    </span>
                    {timeMins !== null && isPresent && (
                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{timeMins}m attended</span>
                    )}
                  </div>
                  {/* Media tracking row */}
                  {isPresent && (r.mic_off_count > 0 || r.camera_off_count > 0 || r.leave_request_count > 0 || r.attention_avg !== null) && (
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
                      {r.mic_off_count > 0 && (
                        <span title="Mic muted count">🎤 off ×{r.mic_off_count}</span>
                      )}
                      {r.camera_off_count > 0 && (
                        <span title="Camera off count">📷 off ×{r.camera_off_count}</span>
                      )}
                      {r.leave_request_count > 0 && (
                        <span title="Leave requests">🚪 leave req ×{r.leave_request_count}</span>
                      )}
                      {r.attention_avg !== null && (
                        <span title="Attention score" className={r.attention_avg >= 70 ? 'text-green-600' : r.attention_avg >= 40 ? 'text-amber-600' : 'text-red-500'}>
                          🧠 {r.attention_avg}%
                        </span>
                      )}
                      {r.last_leave_at && (
                        <span title="Exit time">⏱️ exit {new Date(r.last_leave_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Badge */}
                <div className="shrink-0">
                  {isPresent ? (
                    <Badge label={isLate ? 'Late' : 'Present'} variant={isLate ? 'warning' : 'success'} />
                  ) : isAbsent ? (
                    <Badge label="Absent" variant="danger" />
                  ) : (
                    <StatusBadge status={r.room_status} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StudentMaterialsTab ────────────────────────────────────────

const STUDENT_MATERIAL_TYPE_STYLE: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

function fmtBytesStudent(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function StudentMaterialsTab({
  materials, loading, onRefresh,
}: {
  materials: TeachingMaterial[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filterBatch, setFilterBatch] = useState('');
  const [filterType, setFilterType]   = useState('');

  const batches = Array.from(
    new Map(
      materials
        .filter(m => m.batch_id && m.batch_name)
        .map(m => [m.batch_id, { value: m.batch_id!, label: m.batch_name! }])
    ).values()
  );

  const types = Array.from(new Set(materials.map(m => m.material_type))).sort();

  const filtered = materials
    .filter(m => !filterBatch || m.batch_id === filterBatch)
    .filter(m => !filterType  || m.material_type === filterType);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-emerald-600" /> Study Materials
        </h2>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Filters */}
      {materials.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All batches</option>
            {batches.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} message="No materials available for your batches yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${STUDENT_MATERIAL_TYPE_STYLE[m.material_type] ?? STUDENT_MATERIAL_TYPE_STYLE.other}`}>
                      {m.material_type}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subject}</span>
                    {m.batch_name && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">{m.batch_name}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                  {m.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {m.file_size && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmtBytesStudent(m.file_size)}</span>
                  )}
                </div>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.file_name || 'Open / Download'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ───────────────────────────────────────────────

type SessionFilterKey = 'all' | 'scheduled' | 'live' | 'ended' | 'cancelled';

function SessionsTab({
  sessions, todayStats, loading, onRefresh,
}: {
  sessions: SessionData[];
  todayStats: SessionTodayStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SessionFilterKey>('all');
  const [filterBatch, setFilterBatch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const batchList = Array.from(
    new Map(sessions.map(s => [s.batch_id, { id: s.batch_id, name: s.batch_name }])).values()
  );

  const q = search.toLowerCase();
  const filtered = sessions
    .filter(s => !q || s.subject.toLowerCase().includes(q) || s.batch_name.toLowerCase().includes(q) || (s.topic?.toLowerCase().includes(q)))
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => !filterBatch || s.batch_id === filterBatch);

  const counts: Record<SessionFilterKey, number> = {
    all: sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    live: sessions.filter(s => s.status === 'live').length,
    ended: sessions.filter(s => s.status === 'ended').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
  };

  const attColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-500';
    if (status === 'present') return 'bg-green-100 text-green-700';
    if (status === 'absent') return 'bg-red-100 text-red-600';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="space-y-5">
      {/* Today Stats */}
      {todayStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={ListChecks} label="Today Total" value={todayStats.total} />
          <StatCard icon={Radio} label="Live" value={todayStats.live} variant="success" />
          <StatCard icon={Clock} label="Upcoming" value={todayStats.upcoming} variant="info" />
          <StatCard icon={CheckCircle2} label="Completed" value={todayStats.completed} variant="default" />
          <StatCard icon={XCircle} label="Cancelled" value={todayStats.cancelled} variant="danger" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search sessions…" className="w-64" />
        {batchList.length > 1 && (
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All Batches</option>
            {batchList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          {(['all', 'live', 'scheduled', 'ended', 'cancelled'] as SessionFilterKey[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filterStatus === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${filterStatus === f ? 'bg-white/20' : 'bg-white'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Session Cards */}
      {loading && sessions.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ListChecks} message={search ? 'No sessions match your search' : 'No sessions found'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isExpanded = expandedId === s.session_id;
            const statusIcon = {
              live: <Radio className="h-5 w-5 text-green-600" />,
              scheduled: <Clock className="h-5 w-5 text-teal-600" />,
              ended: <CheckCircle2 className="h-5 w-5 text-gray-400" />,
              cancelled: <XCircle className="h-5 w-5 text-red-500" />,
            }[s.status] ?? <Clock className="h-5 w-5 text-gray-400" />;
            const statusBg = {
              live: 'bg-green-100', scheduled: 'bg-teal-50', ended: 'bg-gray-100', cancelled: 'bg-red-50',
            }[s.status] ?? 'bg-gray-100';

            return (
              <Card key={s.session_id} className={`overflow-hidden transition-colors ${isExpanded ? 'ring-1 ring-emerald-300' : ''}`}>
                <button
                  className="flex w-full items-center gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : s.session_id)}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusBg}`}>
                    {statusIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{s.subject}</p>
                      {s.topic && <span className="text-xs text-gray-500">— {s.topic}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{s.batch_name}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {s.scheduled_date} {s.start_time.slice(0, 5)}
                      </span>
                      {s.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.teacher_name}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <StatusBadge status={s.status} />
                      <p className="text-xs text-gray-400">{fmtDuration(s.duration_minutes)}</p>
                    </div>
                    {s.attendance_status && (
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${attColor(s.attendance_status)}`}>
                        {s.attendance_status === 'present' ? '✓ Present' : '✗ Absent'}
                      </span>
                    )}
                    {s.status === 'live' && (
                      <a
                        href={`/join/${s.session_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 shrink-0 animate-pulse"
                      >
                        Join Now
                      </a>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Date &amp; Time</p>
                        <p className="text-gray-800">{s.scheduled_date} {s.start_time.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Duration</p>
                        <p className="text-gray-800">{fmtDuration(s.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Teacher</p>
                        <p className="text-gray-800">{s.teacher_name ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs text-gray-400">Attendance</p>
                        {s.attendance_status ? (
                          <Badge
                            label={s.is_late ? 'Late' : s.attendance_status === 'present' ? 'Present' : 'Absent'}
                            variant={s.is_late ? 'warning' : s.attendance_status === 'present' ? 'success' : 'danger'}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </div>
                    </div>

                    {/* Time in class */}
                    {s.time_in_class_seconds != null && s.time_in_class_seconds > 0 && (
                      <div className="flex items-center gap-4 rounded-lg bg-white border border-gray-100 px-3 py-2">
                        <div>
                          <p className="text-[10px] text-gray-400">Time in Session</p>
                          <p className="text-sm font-bold text-gray-800">{Math.round(s.time_in_class_seconds / 60)}m</p>
                        </div>
                        {s.join_count != null && (
                          <div>
                            <p className="text-[10px] text-gray-400">Joins</p>
                            <p className="text-sm font-bold text-gray-800">{s.join_count}</p>
                          </div>
                        )}
                        {s.engagement_score != null && (
                          <div>
                            <p className="text-[10px] text-gray-400">Engagement</p>
                            <p className="text-sm font-bold text-gray-800">{s.engagement_score}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Class Portion & Remarks */}
                    {(s.class_portion || s.class_remarks) && (
                      <div className="space-y-2">
                        {s.class_portion && (
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                            <p className="text-[10px] text-emerald-600 font-semibold uppercase">Session Portion Covered</p>
                            <p className="text-sm text-emerald-800 mt-0.5">{s.class_portion}</p>
                          </div>
                        )}
                        {s.class_remarks && (
                          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                            <p className="text-[10px] text-blue-600 font-semibold uppercase">Teacher Remarks</p>
                            <p className="text-sm text-blue-800 mt-0.5">{s.class_remarks}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Topic & Notes */}
                    {s.topic && (
                      <p className="text-xs text-gray-500"><span className="font-semibold">Topic:</span> {s.topic}</p>
                    )}
                    {s.notes && <Alert variant="info" message={s.notes} />}

                    {s.status === 'cancelled' && s.cancel_reason && (
                      <Alert variant="error" message={`Cancelled: ${s.cancel_reason}`} />
                    )}
                    {s.status === 'live' && (
                      <a
                        href={`/join/${s.session_id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700"
                      >
                        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        Join Live Session
                      </a>
                    )}
                    {s.status === 'scheduled' && (() => {
                      const sessionStart = new Date(`${s.scheduled_date.slice(0, 10)}T${s.start_time.slice(0, 5)}+05:30`);
                      const hasStarted = Date.now() >= sessionStart.getTime();
                      return hasStarted ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            <Clock className="h-4 w-4 shrink-0" />
                            <span>Class was scheduled at <strong>{s.start_time.slice(0, 5)}</strong> — waiting for teacher to go live</span>
                          </div>
                          <a
                            href={`/join/${s.session_id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700"
                          >
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            Try to Join
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-700">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>Class starts at <strong>{s.start_time.slice(0, 5)}</strong> — join link will activate when teacher goes live</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Exams Tab ──────────────────────────────────────────────────

function ExamsTab({
  exams, loading, onRefresh, router,
}: {
  exams: ExamData[];
  loading: boolean;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [tab, setTab] = useState<'available' | 'completed'>('available');

  const available = exams.filter(e => !e.attempt_status || e.attempt_status === 'in_progress');
  const completed = exams.filter(e => e.attempt_status === 'graded' || e.attempt_status === 'submitted');
  const currentList = tab === 'available' ? available : completed;

  // Summary stats
  const gradedExams = exams.filter(e => e.attempt_percentage != null);
  const avgScore = gradedExams.length > 0
    ? Math.round(gradedExams.reduce((s, e) => s + (e.attempt_percentage ?? 0), 0) / gradedExams.length)
    : null;
  const passCount = gradedExams.filter(e => (e.attempt_percentage ?? 0) >= (e.passing_marks / e.total_marks * 100)).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Exams" value={exams.length} />
        <StatCard icon={Trophy} label="Completed" value={completed.length} variant="success" />
        <StatCard icon={BarChart2} label="Avg Score" value={avgScore != null ? `${avgScore}%` : '—'}
          variant={avgScore != null ? (avgScore >= 75 ? 'success' : avgScore >= 50 ? 'warning' : 'danger') : 'default'}
        />
        <StatCard icon={CheckCircle2} label="Passed" value={`${passCount}/${gradedExams.length}`}
          variant={gradedExams.length > 0 ? (passCount === gradedExams.length ? 'success' : 'warning') : 'default'}
        />
      </div>

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {[
            { key: 'available' as const, label: 'Available', count: available.length },
            { key: 'completed' as const, label: 'Completed', count: completed.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Exam Cards */}
      {loading && exams.length === 0 ? (
        <LoadingState />
      ) : currentList.length === 0 ? (
        <EmptyState icon={Trophy} message={tab === 'available' ? 'No pending exams' : 'No completed exams yet'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currentList.map(exam => {
            const passed = exam.attempt_percentage != null && (exam.attempt_percentage >= (exam.passing_marks / exam.total_marks * 100));
            return (
              <Card key={exam.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{exam.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{exam.subject} · Grade {exam.grade}</p>
                  </div>
                  {exam.attempt_grade && (
                    <span className={`text-xl font-bold ml-2 ${GRADE_COLORS[exam.attempt_grade] ?? 'text-gray-400'}`}>
                      {exam.attempt_grade}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration_minutes}m</span>
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {exam.total_marks} marks</span>
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Pass: {exam.passing_marks}</span>
                </div>

                {exam.scheduled_at && (
                  <p className="text-xs text-gray-500 mb-3">
                    Scheduled: {new Date(exam.scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                )}

                {exam.attempt_status === 'graded' ? (
                  <div className="mt-auto">
                    <div className={`flex items-center justify-between rounded-lg border p-3 ${passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div>
                        <p className="text-xs text-gray-400">Score</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {exam.attempt_score}/{exam.total_marks}
                          <span className="text-gray-400 ml-1">({exam.attempt_percentage}%)</span>
                        </p>
                      </div>
                      {passed
                        ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                        : <XCircle className="h-5 w-5 text-red-500" />
                      }
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <button
                      onClick={() => router.push(`/student/exams/${exam.id}`)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
                    >
                      {exam.attempt_status === 'in_progress' ? 'Continue Exam' : 'Start Exam'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Fees Tab ───────────────────────────────────────────────────

function FeesTab({
  summary, invoices, receipts, loading, onRefresh, onPay, payingId,
}: {
  summary: FeesSummaryData | null;
  invoices: InvoiceData[];
  receipts: ReceiptData[];
  loading: boolean;
  onRefresh: () => void;
  onPay: (invoiceId: string) => void;
  payingId: string | null;
}) {
  const [view, setView] = useState<'invoices' | 'receipts'>('invoices');

  const feeStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    if (status === 'paid') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'overdue') return 'danger';
    return 'default';
  };

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Receipt} label="Total Invoiced" value={money(summary.total_invoiced_paise)} />
            <StatCard icon={DollarSign} label="Total Paid" value={money(summary.total_paid_paise)} variant="success" />
            <StatCard icon={CreditCard} label="Pending" value={money(summary.total_pending_paise)}
              variant={summary.total_pending_paise > 0 ? 'warning' : 'success'}
            />
            <StatCard icon={AlertCircle} label="Overdue" value={summary.overdue_count}
              variant={summary.overdue_count > 0 ? 'danger' : 'success'}
            />
          </div>

          {summary.overdue_count > 0 && (
            <Alert
              variant="error"
              message={`${summary.overdue_count} overdue invoice${summary.overdue_count > 1 ? 's' : ''}. Please pay promptly to avoid disruption.`}
            />
          )}
        </>
      )}

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {[
            { key: 'invoices' as const, label: 'Invoices', count: invoices.length },
            { key: 'receipts' as const, label: 'Receipts', count: receipts.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                view === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <RefreshButton loading={loading} onClick={onRefresh} />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : view === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState icon={Receipt} message="No invoices found." />
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <Card key={inv.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    inv.status === 'paid' ? 'bg-green-100' :
                    inv.status === 'overdue' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    {inv.status === 'paid'
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : inv.status === 'overdue'
                      ? <AlertCircle className="h-5 w-5 text-red-500" />
                      : <CreditCard className="h-5 w-5 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                      <Badge label={inv.status} variant={feeStatusVariant(inv.status)} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {inv.description || 'Fee Invoice'}
                      {inv.billing_period && ` · ${inv.billing_period}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-gray-900">{money(inv.amount_paise)}</p>
                    {inv.due_date && (
                      <p className="text-xs text-gray-400">
                        Due: {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                    {(inv.status === 'pending' || inv.status === 'overdue') && (
                      <button
                        onClick={() => onPay(inv.id)}
                        disabled={payingId === inv.id}
                        className="mt-1.5 flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 ml-auto"
                      >
                        {payingId === inv.id ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Processing...</>
                        ) : (
                          <><CreditCard className="h-3 w-3" /> Pay Now</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        receipts.length === 0 ? (
          <EmptyState icon={DollarSign} message="No payment receipts found." />
        ) : (
          <div className="space-y-2">
            {receipts.map(r => (
              <Card key={r.receipt_number} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{r.receipt_number}</p>
                      <Badge label="Paid" variant="success" />
                      {r.payment_method && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{r.payment_method}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.invoice_description || 'Payment'}
                      {r.billing_period && ` · ${r.billing_period}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-green-700">{money(r.amount_paise)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Requests Tab ───────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RequestsTab({ requests, availability, sessions, batches, loading, loadingAvailability, onRefresh, userEmail, userName }: {
  requests: SessionRequest[];
  availability: AvailabilitySlot[];
  sessions: SessionData[];
  batches: BatchDetail[];
  loading: boolean;
  loadingAvailability: boolean;
  onRefresh: () => void;
  userEmail: string;
  userName: string;
}) {
  const [view, setView] = useState<'requests' | 'availability'>('requests');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sessionId: '', batchId: '', requestType: 'reschedule' as 'reschedule' | 'cancel', reason: '', proposedDate: '', proposedTime: '' });
  const [availForm, setAvailForm] = useState({ batchId: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:30', preference: 'available' as 'available' | 'preferred' | 'unavailable' });

  // Upcoming sessions for making requests
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_date) >= new Date());

  const submitRequest = async () => {
    if (!form.sessionId || !form.reason) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        batch_session_id: form.sessionId,
        batch_id: form.batchId,
        request_type: form.requestType,
        reason: form.reason,
      };
      if (form.requestType === 'reschedule') {
        if (form.proposedDate) body.proposed_date = form.proposedDate;
        if (form.proposedTime) body.proposed_time = form.proposedTime;
      }
      const res = await fetch('/api/v1/session-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { setShowForm(false); setForm({ sessionId: '', batchId: '', requestType: 'reschedule', reason: '', proposedDate: '', proposedTime: '' }); onRefresh(); }
    } catch { /* */ } finally { setSubmitting(false); }
  };

  const withdrawRequest = async (id: string) => {
    try {
      await fetch('/api/v1/session-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw', request_id: id }) });
      onRefresh();
    } catch { /* */ }
  };

  const submitAvailability = async () => {
    if (!availForm.batchId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/student-availability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: availForm.batchId, day_of_week: Number(availForm.dayOfWeek), start_time: availForm.startTime, end_time: availForm.endTime, preference: availForm.preference }),
      });
      const data = await res.json();
      if (data.success) onRefresh();
    } catch { /* */ } finally { setSubmitting(false); }
  };

  const deleteSlot = async (id: string) => {
    try {
      await fetch('/api/v1/student-availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', slot_id: id }) });
      onRefresh();
    } catch { /* */ }
  };

  const statusColor = (s: string) => s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'withdrawn' ? 'neutral' : 'warning';

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Toggle bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'requests' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <ClipboardList className="inline h-4 w-4 mr-1.5" />Session Requests
          </button>
          <button onClick={() => setView('availability')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'availability' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <CalendarClock className="inline h-4 w-4 mr-1.5" />My Availability
          </button>
        </div>
        <RefreshButton loading={loading || loadingAvailability} onClick={onRefresh} />
      </div>

      {view === 'requests' ? (
        <div className="space-y-4">
          {/* New request button */}
          {upcomingSessions.length > 0 && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition text-sm font-medium">
              <Send className="h-4 w-4" />{showForm ? 'Cancel' : 'New Request'}
            </button>
          )}

          {/* Request form */}
          {showForm && (
            <Card className="p-5 space-y-4 border-emerald-200">
              <h3 className="text-sm font-semibold text-gray-900">Submit Session Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.sessionId}
                    onChange={e => {
                      const sess = upcomingSessions.find(s => s.session_id === e.target.value);
                      setForm(f => ({ ...f, sessionId: e.target.value, batchId: sess?.batch_id || '' }));
                    }}>
                    <option value="">Select session…</option>
                    {upcomingSessions.map(s => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.subject} — {new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {s.start_time?.slice(0, 5)} ({s.batch_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Request Type</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.requestType}
                    onChange={e => setForm(f => ({ ...f, requestType: e.target.value as 'reschedule' | 'cancel' }))}>
                    <option value="reschedule">🔄 Reschedule</option>
                    <option value="cancel">❌ Cancel</option>
                  </select>
                </div>
                {form.requestType === 'reschedule' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Date</label>
                      <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.proposedDate} onChange={e => setForm(f => ({ ...f, proposedDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Time</label>
                      <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.proposedTime} onChange={e => setForm(f => ({ ...f, proposedTime: e.target.value }))} />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Explain why you need this change…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <button disabled={submitting || !form.sessionId || !form.reason} onClick={submitRequest}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </Card>
          )}

          {/* Request list */}
          {requests.length === 0 ? (
            <EmptyState icon={ClipboardList} message="No session requests yet" />
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${r.request_type === 'cancel' ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {r.request_type === 'cancel' ? <Ban className="h-4.5 w-4.5 text-red-600" /> : <CalendarClock className="h-4.5 w-4.5 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{r.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} — {r.subject || 'Session'}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.batch_name && `${r.batch_name} · `}
                        {r.session_date && fmtSmartDateIST(r.session_date)}
                        {r.proposed_date && ` → ${fmtSmartDateIST(r.proposed_date)}`}
                        {r.proposed_time && ` at ${r.proposed_time}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejection: {r.rejection_reason}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-400">{fmtSmartDateIST(r.created_at)}</p>
                      {r.status === 'pending' && (
                        <button onClick={() => withdrawRequest(r.id)} className="text-xs text-red-500 hover:text-red-700">Withdraw</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Availability view */
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Add Available Time Slot</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.batchId} onChange={e => setAvailForm(f => ({ ...f, batchId: e.target.value }))}>
                  <option value="">Select…</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Day</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.dayOfWeek} onChange={e => setAvailForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                  {DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.startTime} onChange={e => setAvailForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                <input type="time" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.endTime} onChange={e => setAvailForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preference</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={availForm.preference} onChange={e => setAvailForm(f => ({ ...f, preference: e.target.value as 'available' | 'preferred' | 'unavailable' }))}>
                  <option value="available">Available</option>
                  <option value="preferred">Preferred</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>
            <button disabled={submitting || !availForm.batchId} onClick={submitAvailability}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              {submitting ? 'Saving…' : 'Add Slot'}
            </button>
          </Card>

          {/* Availability schedule */}
          {loadingAvailability ? <LoadingState /> : availability.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No availability slots set. Add your preferred times above." />
          ) : (
            <div className="space-y-3">
              {DAYS.map((day, idx) => {
                const daySlots = availability.filter(s => s.day_of_week === idx);
                if (daySlots.length === 0) return null;
                return (
                  <Card key={idx} className="p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{day}</h4>
                    <div className="space-y-1.5">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${slot.preference === 'preferred' ? 'bg-emerald-500' : slot.preference === 'unavailable' ? 'bg-red-500' : 'bg-blue-500'}`} />
                            <span className="text-gray-700">{slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}</span>
                            <Badge label={slot.preference} variant={slot.preference === 'preferred' ? 'success' : slot.preference === 'unavailable' ? 'danger' : 'info'} />
                            {slot.notes && <span className="text-xs text-gray-400">({slot.notes})</span>}
                          </div>
                          <button onClick={() => deleteSlot(slot.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
