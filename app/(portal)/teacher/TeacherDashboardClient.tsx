// ═══════════════════════════════════════════════════════════════
// Teacher Dashboard — Client Component (Batch-Sessions Based)
// ═══════════════════════════════════════════════════════════════
// Tabs: Overview · My Batches · Today · Schedule · My Profile
// Theme: light / emerald primary — uses shared UI components
// Pattern: matches HR & Academic Operator dashboards
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  SearchInput, FilterSelect,
  StatCard, StatCardSmall, Card, InfoCard,
  Badge, StatusBadge, Avatar,
  LoadingState, EmptyState, Alert,
  TableWrapper, THead, TH, TRow,
  money,
} from '@/components/dashboard/shared';
import {
  LayoutDashboard, BookOpen, User, Radio, Calendar, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  GraduationCap, Briefcase, Phone, Timer,
  Users, Loader2, CalendarDays, Play, Video,
  MapPin, FileText, Star,
  ArrowRight, Pencil, Save, X as XIcon,
  HelpCircle, ListChecks, AlertTriangle, Info,
  CreditCard, TrendingUp, FolderOpen, ExternalLink,
  CalendarClock, Ban, Send,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

interface BatchSession {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string;
  teacher_name: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  status: string;
  livekit_room_name: string;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string;
  batch_name: string;
  batch_type: string;
  grade: string;
  section: string | null;
  batch_subjects: string[] | null;
  coordinator_email: string | null;
  academic_operator_email: string | null;
  student_count: number;
}

interface TodayStats {
  today_total: number;
  today_live: number;
  today_upcoming: number;
  today_completed: number;
  today_cancelled: number;
}

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  grade: string;
  section: string | null;
  subjects: string[] | null;
  board: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  coordinator_email: string | null;
  academic_operator_email: string | null;
  assigned_subject: string;
  student_count: number;
  total_sessions: number;
  completed_sessions: number;
  upcoming_sessions: number;
  live_sessions: number;
  cancelled_sessions: number;
  students: BatchStudent[];
}

interface BatchStudent {
  batch_id: string;
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  is_active: boolean;
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

// ── Salary & Ratings types ─────────────────────────────────

interface Payslip {
  id: string;
  payroll_period_id: string;
  teacher_email: string;
  period_label: string;
  start_date: string;
  end_date: string;
  classes_conducted: number;
  classes_missed: number;
  classes_cancelled: number;
  rate_per_class: number;
  base_pay_paise: number;
  incentive_paise: number;
  lop_paise: number;
  total_paise: number;
  status: string;
}

interface PayConfig {
  teacher_email: string;
  rate_per_class: number;
  incentive_rules: {
    bonus_threshold?: number;
    bonus_per_class?: number;
  };
}

interface RatingItem {
  id: string;
  session_id: string;
  student_email: string;
  batch_id: string | null;
  punctuality: number | null;
  teaching_quality: number | null;
  communication: number | null;
  overall: number | null;
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
  batch_name?: string;
  subject?: string;
  scheduled_date?: string;
}

interface RatingsData {
  averages: {
    punctuality: number;
    teaching_quality: number;
    communication: number;
    overall: number;
    total_count: number;
  };
  recent: RatingItem[];
  monthly: { month: string; avg_overall: number; count: number }[];
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
  uploaded_by: string;
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

// ── Helpers ─────────────────────────────────────────────────

const BATCH_TYPE_LABELS: Record<string, string> = {
  one_to_one: '1:1', one_to_three: '1:3',
  one_to_many: '1:Many', custom: 'Custom',
};

function batchTypeLabel(t: string): string {
  return BATCH_TYPE_LABELS[t] || t;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function sessionDateTime(s: BatchSession): Date {
  return new Date(`${nd(s.scheduled_date)}T${s.start_time.slice(0, 5)}+05:30`);
}

function sessionEndTime(s: BatchSession): Date {
  const d = sessionDateTime(s);
  d.setMinutes(d.getMinutes() + s.duration_minutes);
  return d;
}

function sessionPrepStart(s: BatchSession): Date {
  const d = sessionDateTime(s);
  d.setMinutes(d.getMinutes() - s.prep_buffer_minutes);
  return d;
}

function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getWeekDates(): string[] {
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(istNow);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getDayLabel(dateStr: string): string {
  const todayStr = todayISO();
  if (dateStr === todayStr) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (dateStr === tomorrowStr) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

function getFullDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Normalize DB date (may be full ISO or YYYY-MM-DD) to YYYY-MM-DD */
function nd(d: string): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function canStartSession(s: BatchSession): boolean {
  if (s.status !== 'scheduled') return false;
  const now = Date.now();
  const prepStart = sessionPrepStart(s).getTime();
  const endTime = sessionEndTime(s).getTime();
  return now >= prepStart && now < endTime;
}

/** True if session end time is still in the future */
function isSessionUpcoming(s: BatchSession): boolean {
  return sessionEndTime(s).getTime() > Date.now();
}

// ── Countdown Component ─────────────────────────────────────

function SessionCountdown({ session }: { session: BatchSession }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const startMs = sessionDateTime(session).getTime();
      const endMs = sessionEndTime(session).getTime();
      const prepMs = sessionPrepStart(session).getTime();
      if (now < prepMs) {
        const diff = prepMs - now;
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Prep in ${h > 0 ? `${h}h ` : ''}${m}m ${s}s`);
      } else if (now < startMs) {
        const diff = startMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`Starts in ${m}m ${s}s`);
      } else if (now < endMs) {
        const diff = endMs - now;
        const m = Math.floor(diff / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        setLabel(`${m}m ${s}s left`);
      } else {
        setLabel('Ended');
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [session]);
  return <span className="text-xs font-mono text-emerald-600">{label}</span>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TeacherDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const validTabs = ['overview', 'batches', 'schedule', 'profile', 'salary', 'ratings', 'materials', 'leave'] as const;
  type Tab = typeof validTabs[number];
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Data state ──
  const [sessions, setSessions] = useState<BatchSession[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({ today_total: 0, today_live: 0, today_upcoming: 0, today_completed: 0, today_cancelled: 0 });
  const [maxPerDay, setMaxPerDay] = useState(4);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  // ── Salary & Ratings state ──
  const [salaryData, setSalaryData] = useState<{ payslips: Payslip[]; config: PayConfig | null } | null>(null);
  const [ratingsData, setRatingsData] = useState<RatingsData | null>(null);
  const [materials, setMaterials] = useState<TeachingMaterial[]>([]);

  // ── Hash sync (matches HR/AO pattern) ──
  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (validTabs.includes(h)) setActiveTab(h);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = useCallback((t: string) => {
    if ((validTabs as readonly string[]).includes(t)) {
      setActiveTab(t as Tab);
      window.location.hash = t;
    }
  }, []);

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessRes, batchRes, profRes, salRes, ratRes, matRes] = await Promise.all([
        fetch('/api/v1/teacher/my-sessions?range=week'),
        fetch('/api/v1/teacher/my-batches'),
        fetch('/api/v1/teacher/profile'),
        fetch('/api/v1/payroll'),
        fetch('/api/v1/teacher/ratings'),
        fetch('/api/v1/teaching-materials'),
      ]);
      const [sessData, batchData, profData, salData, ratData, matData] = await Promise.all([
        sessRes.json(), batchRes.json(), profRes.json(), salRes.json(), ratRes.json(), matRes.json(),
      ]);

      if (sessData.success) {
        setSessions(sessData.data.sessions || []);
        setTodayStats(sessData.data.today || { today_total: 0, today_live: 0, today_upcoming: 0, today_completed: 0, today_cancelled: 0 });
        setMaxPerDay(sessData.data.max_sessions_per_day || 4);
      }
      if (batchData.success) {
        setBatches(batchData.data.batches || []);
      }
      if (profData.success) {
        setProfile(profData.data);
      }
      if (salData.success) {
        setSalaryData({ payslips: salData.data.payslips || [], config: salData.data.config || null });
      }
      if (ratData.success) {
        setRatingsData(ratData.data);
      }
      if (matData.success) {
        setMaterials(matData.data.materials || []);
      }
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Start session (creates LiveKit room) ──
  const startSession = async (sessionId: string, session: BatchSession) => {
    setStarting(sessionId);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${sessionId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Failed to start session');
        return;
      }
      const participants = data.data?.participants || [];
      const teacherEntry = participants.find((p: Record<string, unknown>) => p.email === userEmail);
      if (!teacherEntry) {
        alert('Could not find your join token. Please try again.');
        return;
      }
      sessionStorage.setItem('lk_token', teacherEntry.token);
      sessionStorage.setItem('lk_url', data.data.ws_url);
      sessionStorage.setItem('room_name', data.data.livekit_room_name);
      sessionStorage.setItem('participant_role', 'teacher');
      sessionStorage.setItem('participant_name', userName);
      const isoStart = `${session.scheduled_date}T${session.start_time}+05:30`;
      sessionStorage.setItem('scheduled_start', isoStart);
      sessionStorage.setItem('duration_minutes', String(session.duration_minutes));
      // Open classroom in a new tab so teacher can keep the dashboard open
      window.open(`/classroom/${sessionId}`, '_blank');
    } catch {
      alert('Network error starting session');
    } finally {
      setStarting(null);
    }
  };

  // ── Derived data ──
  const todaySessions = sessions.filter(s => nd(s.scheduled_date) === todayISO());
  const liveSessions = sessions.filter(s => s.status === 'live');
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && isSessionUpcoming(s));
  const nextSession = upcomingSessions.length > 0
    ? upcomingSessions.reduce((a, b) =>
        sessionDateTime(a).getTime() < sessionDateTime(b).getTime() ? a : b
      )
    : null;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <DashboardShell userName={userName} userEmail={userEmail} role={userRole} permissions={permissions}>
      <div className="space-y-6">

        {/* ── Live class overlay warning ── */}
        {liveSessions.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-red-400 bg-linear-to-r from-red-600 to-red-500 shadow-lg shadow-red-200">
            {/* Pulse ring */}
            <span className="absolute right-4 top-4 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-white/70" />
            </span>

            {/* Header row */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                <Radio className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-100">You are live</p>
                <h2 className="text-lg font-extrabold text-white leading-tight">
                  {liveSessions.length === 1 ? 'Session In Progress' : `${liveSessions.length} Sessions In Progress`}
                </h2>
              </div>
            </div>

            {/* Per-session details */}
            <div className="px-5 pb-5 space-y-3">
              {liveSessions.map(s => (
                <div key={s.session_id} className="flex items-center gap-4 rounded-xl bg-white/10 border border-white/20 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-base font-bold text-white">{s.subject}</span>
                      <span className="text-red-200 text-sm">—</span>
                      <span className="text-sm font-semibold text-red-100">{s.batch_name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse inline-block" /> LIVE
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-red-100">
                      <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Grade {s.grade}{s.section ? `-${s.section}` : ''}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {s.student_count} student{s.student_count !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Started {formatTime12h(s.start_time)}</span>
                      <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {fmtDuration(s.duration_minutes)}</span>
                      {s.topic && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {s.topic}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => startSession(s.session_id, s)}
                    disabled={starting === s.session_id}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-600 shadow-md hover:bg-red-50 active:scale-95 transition-all disabled:opacity-60 shrink-0"
                  >
                    {starting === s.session_id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Video className="h-4 w-4" />}
                    Join Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab content ── */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <Alert variant="error" message={error} />
        ) : activeTab === 'overview' ? (
          <OverviewTab
            sessions={sessions}
            liveSessions={liveSessions}
            todaySessions={todaySessions}
            todayStats={todayStats}
            maxPerDay={maxPerDay}
            nextSession={nextSession}
            batches={batches}
            onRefresh={fetchData}
            onStartSession={startSession}
            starting={starting}
            changeTab={changeTab}
            loading={loading}
          />
        ) : activeTab === 'batches' ? (
          <BatchesTab batches={batches} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'schedule' ? (
          <ScheduleTab
            sessions={sessions}
            onRefresh={fetchData}
            onStartSession={startSession}
            starting={starting}
            loading={loading}
          />
        ) : activeTab === 'profile' ? (
          <ProfileTab profile={profile} onRefresh={fetchData} />
        ) : activeTab === 'salary' ? (
          <SalaryTab
            payslips={salaryData?.payslips ?? []}
            config={salaryData?.config ?? null}
            onRefresh={fetchData}
            loading={loading}
          />
        ) : activeTab === 'ratings' ? (
          <RatingsTab data={ratingsData} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'materials' ? (
          <TeacherMaterialsTab materials={materials} onRefresh={fetchData} loading={loading} />
        ) : activeTab === 'leave' ? (
          <LeaveTab />
        ) : null}
      </div>
    </DashboardShell>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Overview
// ═════════════════════════════════════════════════════════════

function OverviewTab({
  todaySessions, todayStats, maxPerDay, nextSession, batches, liveSessions,
  onRefresh, onStartSession, starting, changeTab, loading,
}: {
  sessions: BatchSession[];
  liveSessions: BatchSession[];
  todaySessions: BatchSession[];
  todayStats: TodayStats;
  maxPerDay: number;
  nextSession: BatchSession | null;
  batches: Batch[];
  onRefresh: () => void;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
  changeTab: (t: string) => void;
  loading: boolean;
}) {
  const totalStudents = batches.reduce((sum, b) => sum + b.student_count, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={LayoutDashboard} title="Overview" subtitle="Your teaching overview">
        <RefreshButton loading={loading} onClick={onRefresh} />
      </PageHeader>

      {/* ── Quick Stats (matches HR / AO stat grid) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCardSmall icon={BookOpen}      label="My Batches"       value={batches.length}              variant="info" />
        <StatCardSmall icon={Users}         label="Total Students"   value={totalStudents}               variant="default" />
        <StatCardSmall icon={CalendarDays}  label="Today"            value={todayStats.today_total}      variant={todayStats.today_total > 0 ? 'info' : 'default'} />
        <StatCardSmall icon={Radio}         label="Live Now"         value={todayStats.today_live}       variant={todayStats.today_live > 0 ? 'danger' : 'default'} />
        <StatCardSmall icon={CheckCircle2}  label="Completed Today"  value={todayStats.today_completed}  variant="success" />
        <StatCardSmall icon={Timer}         label={`Limit (${maxPerDay})`} value={`${maxPerDay - todayStats.today_total} left`} variant={todayStats.today_total >= maxPerDay ? 'warning' : 'default'} />
      </div>

      {/* ── Next Session Card ── */}
      {nextSession && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 shrink-0">
              <Calendar className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">Next Session</h3>
                <SessionCountdown session={nextSession} />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {nextSession.subject} — {nextSession.batch_name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {getDayLabel(nd(nextSession.scheduled_date))} · {formatTime12h(nextSession.start_time)} · {fmtDuration(nextSession.duration_minutes)}
                {nextSession.topic && ` · ${nextSession.topic}`}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge icon={Users} label={`${nextSession.student_count} students`} variant="info" />
                <Badge label={batchTypeLabel(nextSession.batch_type)} variant="default" />
                {nextSession.grade && <Badge label={`Grade ${nextSession.grade}`} variant="default" />}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {canStartSession(nextSession) && (
                <Button size="sm" icon={Play} onClick={() => onStartSession(nextSession.session_id, nextSession)} disabled={starting === nextSession.session_id} loading={starting === nextSession.session_id}>
                  Start Session
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Today Sessions Table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Today&apos;s Sessions</h3>
        </div>
        {todaySessions.length === 0 ? (
          <EmptyState icon={Calendar} message="No sessions scheduled for today" />
        ) : (
          <TableWrapper
            footer={
              <>
                <span>{todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} today</span>
                <span>{todayStats.today_upcoming} upcoming · {todayStats.today_completed} completed</span>
              </>
            }
          >
            <THead>
              <TH>Time</TH>
              <TH>Subject</TH>
              <TH>Batch</TH>
              <TH>Students</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </THead>
            <tbody>
              {[...todaySessions].sort((a, b) => a.start_time.localeCompare(b.start_time)).slice(0, 5).map(s => (
                <TRow key={s.session_id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-gray-800">{formatTime12h(s.start_time)}</p>
                    <p className="text-[10px] text-gray-400">{fmtDuration(s.duration_minutes)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{s.subject}</p>
                    {s.topic && <p className="text-xs text-gray-400 truncate max-w-40">{s.topic}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{s.batch_name}</p>
                    <p className="text-xs text-gray-400">{batchTypeLabel(s.batch_type)} · Grade {s.grade}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-gray-400" />{s.student_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                    {s.status === 'live' && <Radio className="inline h-3 w-3 text-red-500 animate-pulse ml-1" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === 'live' && (
                      <Button size="xs" variant="danger" icon={Video} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                        Rejoin
                      </Button>
                    )}
                    {canStartSession(s) && (
                      <Button size="xs" icon={Play} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                        Start
                      </Button>
                    )}
                    {s.status === 'ended' && <Badge label="Done" variant="success" icon={CheckCircle2} />}
                    {s.status === 'cancelled' && <Badge label="Cancelled" variant="danger" icon={XCircle} />}
                    {s.status === 'scheduled' && !canStartSession(s) && <SessionCountdown session={s} />}
                  </td>
                </TRow>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </div>

      {/* ── Assigned Batches Cards (matches HR role breakdown) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned Batches</h3>
          <button onClick={() => changeTab('batches')} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {batches.length === 0 ? (
          <EmptyState icon={BookOpen} message="No batches assigned yet — contact your Academic Operator" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {batches.slice(0, 6).map(b => (
              <div key={b.batch_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">{b.assigned_subject}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-lg font-bold text-gray-900">{b.batch_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {batchTypeLabel(b.batch_type)} · Grade {b.grade}{b.section ? `-${b.section}` : ''}
                  {b.board && ` · ${b.board}`}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs">
                  <span className="text-gray-500"><Users className="h-3 w-3 inline mr-0.5" />{b.student_count} students</span>
                  <span className="text-emerald-600 font-medium"><CheckCircle2 className="h-3 w-3 inline mr-0.5" />{b.completed_sessions}/{b.total_sessions}</span>
                  {b.live_sessions > 0 && <span className="text-red-600 font-medium"><Radio className="h-3 w-3 inline mr-0.5 animate-pulse" />{b.live_sessions} live</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {batches.length > 6 && (
          <p className="text-xs text-center text-gray-400 mt-2">
            Showing 6 of {batches.length} — <button onClick={() => changeTab('batches')} className="text-emerald-600 hover:underline">view all</button>
          </p>
        )}
      </div>

      {/* ── Quick Setup Guide ── */}
      <QuickSetupGuide />

      {/* ── Session Limit Warning ── */}
      {todayStats.today_total >= maxPerDay && (
        <Alert variant="warning" message={`You have reached the daily session limit (${maxPerDay}). No more sessions can be started today.`} />
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// Quick Setup Guide (workflow-based teacher onboarding dropdown)
// ═════════════════════════════════════════════════════════════

const SETUP_SECTIONS = [
  {
    id: 'session_rules',
    icon: Info,
    label: 'Session Rules',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    items: [
      'Each session is 1 hour 30 minutes (75 min teaching + 15 min prep buffer)',
      'Maximum 4 sessions per day per teacher',
      'Session types: One-to-One, One-to-Three (max 3 students), One-to-Many',
      'One-to-One students may request preferred timings, subject to approval',
    ],
  },
  {
    id: 'pre_class',
    icon: ListChecks,
    label: 'Before & During Session',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    items: [
      'Enter the session 15 minutes before the scheduled start time',
      'Students join after you (the teacher) have entered',
      'Mark student attendance at the start of every session',
      'Conduct the full scheduled lesson portion',
      'After session: update the topic covered and add remarks in the system',
    ],
  },
  {
    id: 'responsibilities',
    icon: CheckCircle2,
    label: 'Your Responsibilities',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    items: [
      'Conduct sessions as per the assigned schedule',
      'Always enter the session on time (15 min early)',
      'Mark attendance for every student in every session',
      'Complete the scheduled academic portion each session',
      'Update session details, topic covered, and remarks after each session',
      'Evaluate student performance and update exam marks promptly',
    ],
  },
  {
    id: 'cancellation',
    icon: AlertTriangle,
    label: 'Cancellation Policy',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    items: [
      'Teachers cannot directly cancel any scheduled session',
      'Submit a cancellation request to your Batch Coordinator with a valid reason',
      'Approval chain: Batch Coordinator → Admin → Academic Operator → HR',
      'Session is cancelled only after HR final approval',
      'Unauthorized cancellation is considered a policy violation',
      'All cancellation actions are logged and audited',
    ],
  },
];

function QuickSetupGuide() {
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (id: string) =>
    setOpenSection(prev => (prev === id ? null : id));

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header / main toggle */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
          <HelpCircle className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Quick Setup Guide</p>
          <p className="text-xs text-gray-400">How sessions work, your duties &amp; policies — tap to expand</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {SETUP_SECTIONS.map(section => (
            <div key={section.id}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${section.bg} shrink-0`}>
                  <section.icon className={`h-3.5 w-3.5 ${section.color}`} />
                </div>
                <span className={`flex-1 text-sm font-medium ${section.color}`}>{section.label}</span>
                <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 shrink-0 ${openSection === section.id ? 'rotate-90' : ''}`} />
              </button>

              {/* Section steps */}
              {openSection === section.id && (
                <div className={`mx-4 mb-3 rounded-lg border ${section.border} ${section.bg} px-4 py-3`}>
                  <ol className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${section.border} text-[10px] font-bold ${section.color} shrink-0`}>
                          {i + 1}
                        </span>
                        <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: My Batches
// ═════════════════════════════════════════════════════════════

function BatchesTab({ batches, onRefresh, loading }: { batches: Batch[]; onRefresh: () => void; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = batches.filter(b => {
    if (statusFilter === 'active' && b.status !== 'active') return false;
    if (statusFilter === 'inactive' && b.status !== 'inactive') return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.batch_name.toLowerCase().includes(q) ||
        b.assigned_subject.toLowerCase().includes(q) ||
        b.grade.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeBatches = batches.filter(b => b.status === 'active').length;
  const totalStudents = batches.reduce((sum, b) => sum + b.student_count, 0);
  const totalSessions = batches.reduce((sum, b) => sum + b.total_sessions, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="My Batches" subtitle="Batches assigned by Academic Operator">
        <RefreshButton loading={loading} onClick={onRefresh} />
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSmall icon={BookOpen}     label="Total Batches"  value={batches.length}  variant="info" />
        <StatCardSmall icon={CheckCircle2} label="Active"         value={activeBatches}   variant="success" />
        <StatCardSmall icon={Users}        label="Total Students" value={totalStudents}   variant="default" />
        <StatCardSmall icon={CalendarDays} label="Total Sessions" value={totalSessions}   variant="default" />
      </div>

      {/* Search + Filters (matches HR pattern) */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search batches…" />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active Only' },
            { value: 'inactive', label: 'Inactive Only' },
          ]}
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">{filtered.length} of {batches.length}</span>
        </div>
      </div>

      {/* Batch list */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message={batches.length === 0 ? 'No batches assigned yet — contact your Academic Operator' : 'No batches match the selected filter'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const isExpanded = expandedId === b.batch_id;
            return (
              <Card key={b.batch_id} className="overflow-hidden">
                {/* Batch header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : b.batch_id)}
                  className="w-full flex items-center gap-4 text-left p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{b.batch_name}</p>
                      <StatusBadge status={b.status} />
                      {b.live_sessions > 0 && <Badge icon={Radio} label="LIVE" variant="danger" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.assigned_subject} · Grade {b.grade}{b.section ? `-${b.section}` : ''} · {batchTypeLabel(b.batch_type)}
                      {b.board && ` · ${b.board}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    <span className="hidden sm:flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.student_count}</span>
                    <span className="hidden sm:flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{b.total_sessions}</span>
                    <span className="hidden sm:flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" />{b.completed_sessions}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                    {/* Session stats (InfoCard grid) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <InfoCard label="Total Sessions">
                        <p className="text-lg font-bold text-gray-800">{b.total_sessions}</p>
                      </InfoCard>
                      <InfoCard label="Completed" icon={CheckCircle2}>
                        <p className="text-lg font-bold text-emerald-600">{b.completed_sessions}</p>
                      </InfoCard>
                      <InfoCard label="Upcoming" icon={CalendarDays}>
                        <p className="text-lg font-bold text-blue-600">{b.upcoming_sessions}</p>
                      </InfoCard>
                      <InfoCard label="Live" icon={Radio}>
                        <p className="text-lg font-bold text-red-600">{b.live_sessions}</p>
                      </InfoCard>
                      <InfoCard label="Cancelled" icon={XCircle}>
                        <p className="text-lg font-bold text-gray-400">{b.cancelled_sessions}</p>
                      </InfoCard>
                    </div>

                    {/* Info fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {b.coordinator_email && (
                        <InfoCard label="Coordinator" icon={User}>
                          <p className="text-sm text-gray-700">{b.coordinator_email}</p>
                        </InfoCard>
                      )}
                      {b.academic_operator_email && (
                        <InfoCard label="Academic Operator" icon={Star}>
                          <p className="text-sm text-gray-700">{b.academic_operator_email}</p>
                        </InfoCard>
                      )}
                      {b.notes && (
                        <InfoCard label="Notes" icon={FileText}>
                          <p className="text-sm text-gray-700">{b.notes}</p>
                        </InfoCard>
                      )}
                    </div>

                    {/* Students list (table format like HR) */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Students ({b.students.length})
                      </h4>
                      {b.students.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-2">No students enrolled in this batch</p>
                      ) : (
                        <TableWrapper>
                          <THead>
                            <TH>#</TH>
                            <TH>Student Name</TH>
                            <TH>Status</TH>
                          </THead>
                          <tbody>
                            {b.students.map((st, idx) => (
                              <TRow key={st.student_email}>
                                <td className="px-4 py-2.5 text-xs text-gray-400 w-10">{idx + 1}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={st.student_name || 'Student'} size="sm" />
                                    <span className="text-sm font-medium text-gray-800">
                                      {st.student_name || <span className="text-gray-400 italic">Unnamed Student</span>}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge
                                    icon={st.is_active ? CheckCircle2 : XCircle}
                                    label={st.is_active ? 'Active' : 'Inactive'}
                                    variant={st.is_active ? 'success' : 'danger'}
                                  />
                                </td>
                              </TRow>
                            ))}
                          </tbody>
                        </TableWrapper>
                      )}
                    </div>
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


// ═════════════════════════════════════════════════════════════
// TAB: Schedule (weekly)
// ═════════════════════════════════════════════════════════════

function ScheduleTab({
  sessions, onRefresh, onStartSession, starting, loading,
}: {
  sessions: BatchSession[];
  onRefresh: () => void;
  onStartSession: (id: string, s: BatchSession) => void;
  starting: string | null;
  loading: boolean;
}) {
  const weekDates = getWeekDates();

  // Group sessions by date
  const byDate: Record<string, BatchSession[]> = {};
  for (const s of sessions) {
    if (!byDate[s.scheduled_date]) byDate[s.scheduled_date] = [];
    byDate[s.scheduled_date].push(s);
  }
  for (const d of Object.keys(byDate)) {
    byDate[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  // Weekly summary
  const totalWeek = sessions.length;
  const scheduledWeek = sessions.filter(s => s.status === 'scheduled').length;
  const completedWeek = sessions.filter(s => s.status === 'ended').length;
  const liveWeek = sessions.filter(s => s.status === 'live').length;

  return (
    <div className="space-y-6">
      <PageHeader icon={Calendar} title="Weekly Schedule" subtitle="Next 7 days">
        <RefreshButton loading={loading} onClick={onRefresh} />
      </PageHeader>

      {/* Week summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSmall icon={CalendarDays} label="This Week"  value={totalWeek}     variant="info" />
        <StatCardSmall icon={Clock}        label="Upcoming"   value={scheduledWeek} variant="default" />
        <StatCardSmall icon={Radio}        label="Live"       value={liveWeek}      variant={liveWeek > 0 ? 'danger' : 'default'} />
        <StatCardSmall icon={CheckCircle2} label="Completed"  value={completedWeek} variant="success" />
      </div>

      {/* Day-by-day schedule */}
      <div className="space-y-4">
        {weekDates.map(date => {
          const daySessions = byDate[date] || [];
          const isToday = date === todayISO();
          return (
            <div key={date}>
              <div className={`flex items-center gap-2 mb-2 px-1 ${isToday ? 'text-emerald-700' : 'text-gray-600'}`}>
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isToday ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-semibold">{getDayLabel(date)}</h3>
                <span className="text-xs text-gray-400">
                  {new Date(date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                </span>
                {daySessions.length > 0 && (
                  <Badge label={`${daySessions.length} session${daySessions.length > 1 ? 's' : ''}`} variant="info" />
                )}
              </div>
              {daySessions.length === 0 ? (
                <Card className="border-dashed p-3">
                  <p className="text-xs text-gray-400 text-center">No sessions</p>
                </Card>
              ) : (
                <TableWrapper>
                  <THead>
                    <TH>Time</TH>
                    <TH>Subject</TH>
                    <TH>Batch</TH>
                    <TH>Students</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Action</TH>
                  </THead>
                  <tbody>
                    {daySessions.map(s => (
                      <TRow key={s.session_id}>
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-bold text-gray-800">{formatTime12h(s.start_time)}</p>
                          <p className="text-[10px] text-gray-400">{fmtDuration(s.duration_minutes)}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-gray-800">{s.subject}</p>
                          {s.topic && <p className="text-xs text-gray-400 truncate max-w-36">{s.topic}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-gray-700">{s.batch_name}</p>
                          <p className="text-xs text-gray-400">{batchTypeLabel(s.batch_type)} · Grade {s.grade}</p>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3 text-gray-400" />{s.student_count}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <StatusBadge status={s.status} />
                            {s.status === 'live' && <Radio className="h-3 w-3 text-red-500 animate-pulse" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {s.status === 'live' && (
                            <Button size="xs" variant="danger" icon={Video} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                              Rejoin
                            </Button>
                          )}
                          {canStartSession(s) && (
                            <Button size="xs" icon={Play} onClick={() => onStartSession(s.session_id, s)} disabled={starting === s.session_id} loading={starting === s.session_id}>
                              Start
                            </Button>
                          )}
                          {s.status === 'scheduled' && !canStartSession(s) && <SessionCountdown session={s} />}
                        </td>
                      </TRow>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Profile
// ═════════════════════════════════════════════════════════════

function ProfileTab({ profile, onRefresh }: { profile: TeacherProfile | null; onRefresh: () => void }) {
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // Edit form state — only teacher-editable fields
  const [fPhone, setFPhone]         = useState('');
  const [fWhatsapp, setFWhatsapp]   = useState('');
  const [fQual, setFQual]           = useState('');
  const [fExp, setFExp]             = useState('');
  const [fRegion, setFRegion]       = useState('');
  const [fNotes, setFNotes]         = useState('');

  const startEdit = () => {
    if (!profile) return;
    setFPhone(profile.phone ?? '');
    setFWhatsapp(profile.whatsapp ?? '');
    setFQual(profile.qualification ?? '');
    setFExp(profile.experience_years != null ? String(profile.experience_years) : '');
    setFRegion(profile.assigned_region ?? '');
    setFNotes(profile.notes ?? '');
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setSaveError(null); };

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/v1/teacher/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone:            fPhone    || null,
          whatsapp:         fWhatsapp || null,
          qualification:    fQual     || null,
          experience_years: fExp !== '' ? Number(fExp) : null,
          assigned_region:  fRegion   || null,
          notes:            fNotes    || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(false);
        onRefresh();
      } else {
        setSaveError(json.error || 'Failed to save profile');
      }
    } catch {
      setSaveError('Network error — please try again');
    }
    setSaving(false);
  };

  if (!profile) return <EmptyState icon={User} message="Profile not found" />;

  return (
    <div className="space-y-6">
      <PageHeader icon={User} title="My Profile" subtitle="Your teaching profile and contact details">
        <div className="flex items-center gap-2">
          <RefreshButton onClick={onRefresh} />
          {!editing && (
            <Button icon={Pencil} size="sm" variant="ghost" onClick={startEdit}>
              Edit Profile
            </Button>
          )}
        </div>
      </PageHeader>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
          <XIcon className="h-4 w-4 shrink-0" /> {saveError}
        </div>
      )}

      <Card className="p-6">
        {/* Profile header — always read-only */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
          <Avatar name={profile.name} size="lg" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{profile.name}</h3>
            <p className="text-sm text-gray-500">{profile.email}</p>
            {profile.subjects && profile.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.subjects.map(s => (
                  <Badge key={s} label={s} variant="primary" />
                ))}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          /* ── Edit Form ── */
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Phone">
                <input value={fPhone} onChange={e => setFPhone(e.target.value)}
                  className={editInputCls} placeholder="e.g. +92 300 1234567" />
              </EditField>
              <EditField label="WhatsApp">
                <input value={fWhatsapp} onChange={e => setFWhatsapp(e.target.value)}
                  className={editInputCls} placeholder="Same as phone if identical" />
              </EditField>
              <EditField label="Qualification">
                <select value={fQual} onChange={e => setFQual(e.target.value)} className={editInputCls}>
                  <option value="">— Select qualification —</option>
                  {QUALIFICATION_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </EditField>
              <EditField label="Experience">
                <select value={fExp} onChange={e => setFExp(e.target.value)} className={editInputCls}>
                  <option value="">— Select experience —</option>
                  {EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </EditField>
              <EditField label="Region">
                <select value={fRegion} onChange={e => setFRegion(e.target.value)} className={editInputCls}>
                  <option value="">— Select region —</option>
                  {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </EditField>

              <EditField label="Notes" className="sm:col-span-2">
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)}
                  className={`${editInputCls} resize-none`} rows={3}
                  placeholder="Any additional notes about your profile\u2026" />
              </EditField>
            </div>

            {/* Admin-only reminder */}
            <p className="text-xs text-gray-400 italic">
              Name, email and date of birth are managed by admin.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="ghost" icon={XIcon} onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button icon={Save} onClick={saveProfile} disabled={saving} loading={saving}>
                {saving ? 'Saving\u2026' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Read View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProfileField icon={Phone}        label="Phone"          value={profile.phone} />
            <ProfileField icon={Phone}        label="WhatsApp"       value={profile.whatsapp} />
            <ProfileField icon={GraduationCap} label="Qualification" value={profile.qualification} />
            <ProfileField icon={Briefcase}    label="Experience"     value={profile.experience_years != null ? `${profile.experience_years} years` : null} />
            <ProfileField icon={BookOpen}     label="Subjects"       value={profile.subjects?.join(', ')} />
            <ProfileField icon={MapPin}       label="Region"         value={profile.assigned_region} />
            {profile.date_of_birth && (
              <ProfileField icon={Calendar} label="Date of Birth" value={fmtDate(profile.date_of_birth)} />
            )}
            {profile.notes && (
              <ProfileField icon={FileText} label="Notes" value={profile.notes} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Edit Profile option lists ─────────────────────────────
const QUALIFICATION_OPTIONS = [
  'B.A.', 'M.A.', 'B.Sc.', 'M.Sc.', 'M.Phil.',
  'Ph.D.', 'B.Ed.', 'M.Ed.', 'B.Tech.', 'M.Tech.',
  'B.Com.', 'M.Com.', 'MBA', 'Other',
];

const EXPERIENCE_OPTIONS = [
  { value: '0',  label: 'Less than 1 year' },
  { value: '1',  label: '1 year' },
  { value: '2',  label: '2 years' },
  { value: '3',  label: '3 years' },
  { value: '4',  label: '4 years' },
  { value: '5',  label: '5 years' },
  { value: '6',  label: '6 years' },
  { value: '7',  label: '7 years' },
  { value: '8',  label: '8 years' },
  { value: '9',  label: '9 years' },
  { value: '10', label: '10 years' },
  { value: '12', label: '12 years' },
  { value: '15', label: '15 years' },
  { value: '20', label: '20 years' },
  { value: '25', label: '25+ years' },
];

const REGION_OPTIONS = [
  'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'India', 'Pakistan', 'Bangladesh', 'Other',
];

// Shared styling for edit inputs
const editInputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300';

function EditField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// Shared sub-components
// ═════════════════════════════════════════════════════════════

function ProfileField({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3 text-emerald-500" /> {label}
      </p>
      <p className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Salary
// ═════════════════════════════════════════════════════════════

const PAYSLIP_STATUS_STYLE: Record<string, string> = {
  paid:      'text-emerald-700 bg-emerald-50 border border-emerald-200',
  finalized: 'text-blue-700   bg-blue-50   border border-blue-200',
  draft:     'text-gray-600   bg-gray-50   border border-gray-200',
};

function SalaryTab({
  payslips, config, onRefresh, loading,
}: {
  payslips: Payslip[];
  config: PayConfig | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [subTab, setSubTab] = useState<'summary' | 'history' | 'config'>('summary');

  const totalPaid    = payslips.filter(p => p.status === 'paid').reduce((s, p) => s + p.total_paise, 0);
  const totalPending = payslips.filter(p => p.status !== 'paid').reduce((s, p) => s + p.total_paise, 0);
  const totalDone    = payslips.reduce((s, p) => s + p.classes_conducted, 0);
  const totalMissed  = payslips.reduce((s, p) => s + p.classes_missed,    0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-600" /> Salary &amp; Payroll
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['summary', 'history', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
              subTab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Summary ── */}
      {subTab === 'summary' && (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Earned',    value: money(totalPaid),    color: 'text-emerald-700' },
              { label: 'Pending / Draft', value: money(totalPending), color: 'text-amber-600'   },
              { label: 'Sessions Done',    value: String(totalDone),   color: 'text-blue-700'    },
              { label: 'Sessions Missed',  value: String(totalMissed), color: 'text-red-600'     },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Current pay config */}
          {config && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Pay Schedule</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-700">{money(config.rate_per_class * 100)}</p>
                  <p className="text-xs text-gray-400 mt-1">Rate per session</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {config.incentive_rules?.bonus_threshold ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bonus threshold</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-700">
                    {config.incentive_rules?.bonus_per_class
                      ? money(config.incentive_rules.bonus_per_class * 100)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bonus per session</p>
                </div>
              </div>
            </div>
          )}

          {payslips.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No payslip records yet.
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {subTab === 'history' && (
        <div className="space-y-3">
          {payslips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              No payslips found.
            </div>
          ) : (
            <TableWrapper>
              <THead>
                <tr>
                  <TH>Period</TH>
                  <TH>Sessions</TH>
                  <TH>Base Pay</TH>
                  <TH>Incentive</TH>
                  <TH>LOP</TH>
                  <TH>Total</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <tbody>
                {payslips.map(p => (
                  <TRow key={p.id}>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{p.period_label}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="text-emerald-700 font-semibold">{p.classes_conducted}</span>
                      {p.classes_missed > 0 && (
                        <span className="text-red-500 text-xs ml-1">(–{p.classes_missed})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{money(p.base_pay_paise)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{money(p.incentive_paise)}</td>
                    <td className="px-4 py-3 text-sm text-red-500">
                      {p.lop_paise > 0 ? `–${money(p.lop_paise)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{money(p.total_paise)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PAYSLIP_STATUS_STYLE[p.status] ?? PAYSLIP_STATUS_STYLE.draft}`}>
                        {p.status}
                      </span>
                    </td>
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          )}
          <p className="text-xs text-gray-400 text-right">
            {payslips.length} payslip{payslips.length !== 1 ? 's' : ''} · Total paid: <span className="font-semibold text-gray-600">{money(totalPaid)}</span>
          </p>
        </div>
      )}

      {/* ── Config ── */}
      {subTab === 'config' && (
        <div className="space-y-4">
          {config ? (
            <>
              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <p className="text-sm font-semibold text-gray-700">Pay Schedule Details</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rate per session</span>
                    <span className="font-semibold text-gray-800">{money(config.rate_per_class * 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bonus threshold (sessions)</span>
                    <span className="font-semibold text-gray-800">{config.incentive_rules?.bonus_threshold ?? 'Not set'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Bonus per extra session</span>
                    <span className="font-semibold text-gray-800">
                      {config.incentive_rules?.bonus_per_class ? money(config.incentive_rules.bonus_per_class * 100) : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-700">
                <strong>LOP Policy:</strong> Loss of pay is applied for missed sessions not cancelled 24 hours in advance.
                Contact your coordinator if you believe a deduction is incorrect.
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              Pay configuration not available. Contact your coordinator.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Ratings
// ═════════════════════════════════════════════════════════════

function StarDisplay({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < Math.round(value) ? 'text-amber-400' : 'text-gray-200'}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function RatingBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round((value / 5) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-700 font-semibold">{value > 0 ? value.toFixed(1) : '—'} / 5</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RatingsTab({
  data, onRefresh, loading,
}: {
  data: RatingsData | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const avg = data?.averages;
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" /> Student Ratings
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {!avg || avg.total_count === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-400">
          No ratings received yet. Ratings appear after students review completed sessions.
        </div>
      ) : (
        <>
          {/* Top row: overall score + category bars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Overall score card */}
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col items-center justify-center gap-2">
              <p className="text-5xl font-extrabold text-amber-500">{avg.overall.toFixed(1)}</p>
              <p className="text-xs text-gray-400">out of 5.0</p>
              <StarDisplay value={avg.overall} />
              <p className="text-xs text-gray-400 mt-1">{avg.total_count} rating{avg.total_count !== 1 ? 's' : ''}</p>
            </div>

            {/* Category bars */}
            <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category Breakdown</p>
              <RatingBar label="Punctuality"       value={avg.punctuality}       color="bg-blue-400"    />
              <RatingBar label="Teaching Quality"  value={avg.teaching_quality}  color="bg-emerald-400" />
              <RatingBar label="Communication"     value={avg.communication}     color="bg-purple-400"  />
              <RatingBar label="Overall"           value={avg.overall}           color="bg-amber-400"   />
            </div>
          </div>

          {/* Recent ratings list */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Ratings</p>
            {recent.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {r.is_anonymous ? '?' : r.student_email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {r.is_anonymous ? 'Anonymous' : r.student_email.split('@')[0]}
                      </p>
                      {r.batch_name && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                          {r.subject ?? r.batch_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  r.overall != null && r.overall >= 4 ? 'bg-emerald-50 text-emerald-700' :
                      r.overall != null && r.overall >= 3 ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {r.overall} / 5
                    </span>
                  </div>
                </div>

                {/* Per-category mini stars */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                  {[
                    { label: 'Punctuality',      val: r.punctuality      },
                    { label: 'Teaching Quality', val: r.teaching_quality },
                    { label: 'Communication',    val: r.communication    },
                    { label: 'Overall',          val: r.overall          },
                  ].map(c => (
                    <div key={c.label}>
                      <p className="mb-0.5 text-gray-400">{c.label}</p>
                      <StarDisplay value={c.val ?? 0} />
                    </div>
                  ))}
                </div>

                {r.comment && (
                  <p className="text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2 border-l-2 border-emerald-300">
                    &ldquo;{r.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Teaching Materials (read-only for teacher)
// ═════════════════════════════════════════════════════════════

const MATERIAL_TYPE_STYLE_T: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

function TeacherMaterialsTab({
  materials, onRefresh, loading,
}: {
  materials: TeachingMaterial[];
  onRefresh: () => void;
  loading: boolean;
}) {
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType]       = useState('');

  const subjects = Array.from(new Set(materials.map(m => m.subject))).sort();
  const types    = Array.from(new Set(materials.map(m => m.material_type))).sort();

  const filtered = materials.filter(m => {
    if (filterSubject && m.subject !== filterSubject) return false;
    if (filterType    && m.material_type !== filterType)    return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-emerald-600" /> Teaching Materials
        </h2>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </div>

      {/* Filters */}
      {materials.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Materials grid */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No materials available</p>
          <p className="text-xs text-gray-400 mt-1">Your academic operator will upload study resources here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${MATERIAL_TYPE_STYLE_T[m.material_type] ?? MATERIAL_TYPE_STYLE_T.other}`}>
                      {m.material_type}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.subject}</span>
                    {m.batch_name && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">{m.batch_name}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                <span className="text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {m.file_name || 'Open file'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ═════════════════════════════════════════════════════════════
// TAB: Leave Requests
// ═════════════════════════════════════════════════════════════

interface LeaveRequest {
  id: string;
  teacher_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  hr_status: string;
  owner_status: string;
  ao_reviewed_by: string | null;
  hr_reviewed_by: string | null;
  owner_reviewed_by: string | null;
  affected_sessions: string[];
  created_at: string;
}

function LeaveTab() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: 'planned', startDate: '', endDate: '', reason: '' });

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setLeaveRequests(data.requests ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  const submitLeave = async () => {
    if (!form.startDate || !form.endDate || !form.reason) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_type: form.leaveType, start_date: form.startDate, end_date: form.endDate, reason: form.reason }),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); setForm({ leaveType: 'planned', startDate: '', endDate: '', reason: '' }); fetchLeave(); }
    } catch { /* */ } finally { setSubmitting(false); }
  };

  const withdrawLeave = async (id: string) => {
    try {
      await fetch('/api/v1/teacher-leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', leave_id: id }),
      });
      fetchLeave();
    } catch { /* */ }
  };

  const statusIcon = (s: string) => s === 'approved' ? '✅' : s === 'rejected' ? '❌' : s === 'pending' ? '⏳' : '—';

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Leave Requests</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition text-sm font-medium">
          <Send className="h-4 w-4" />{showForm ? 'Cancel' : 'Request Leave'}
        </button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-4 border-emerald-200">
          <h3 className="text-sm font-semibold text-gray-900">New Leave Request</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.leaveType}
                onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                <option value="planned">📅 Planned</option>
                <option value="sick">🤒 Sick</option>
                <option value="personal">👤 Personal</option>
                <option value="emergency">🚨 Emergency</option>
                <option value="other">📋 Other</option>
              </select>
            </div>
            <div />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Explain your leave reason…"
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <button disabled={submitting || !form.startDate || !form.endDate || !form.reason} onClick={submitLeave}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
            {submitting ? 'Submitting…' : 'Submit Leave Request'}
          </button>
        </Card>
      )}

      {leaveRequests.length === 0 ? (
        <EmptyState icon={CalendarClock} message="No leave requests yet. Use the button above to request leave." />
      ) : (
        <div className="space-y-3">
          {leaveRequests.map(lr => (
            <Card key={lr.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{lr.leave_type} Leave</span>
                    <StatusBadge status={lr.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {lr.affected_sessions?.length > 0 && ` · ${lr.affected_sessions.length} sessions affected`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                  {/* Approval chain */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                    <span>{statusIcon(lr.ao_status)} AO: {lr.ao_status}</span>
                    <span>{statusIcon(lr.hr_status)} HR: {lr.hr_status}</span>
                    <span>{statusIcon(lr.owner_status)} Owner: {lr.owner_status}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-xs text-gray-400">{new Date(lr.created_at).toLocaleDateString('en-IN')}</p>
                  {lr.status === 'pending' && (
                    <button onClick={() => withdrawLeave(lr.id)} className="text-xs text-red-500 hover:text-red-700">Withdraw</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}