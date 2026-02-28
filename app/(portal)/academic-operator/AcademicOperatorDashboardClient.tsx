// ═══════════════════════════════════════════════════════════════
// Academic Operator Dashboard — Client Component (v3)
// Batch-centric: view batches, schedule sessions, create batches,
// change teachers, day-of-week recurring sessions,
// expanded batch detail with students & parents.
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton, TabBar,
  SearchInput, FilterSelect,
  FormField, FormGrid, Input, Select, Textarea,
  TableWrapper, THead, TH, TRow,
  StatCard, InfoCard, Badge, StatusBadge,
  LoadingState, EmptyState, Alert,
  useToast, useConfirm, Avatar,
} from '@/components/dashboard/shared';
import { CreateUserModal } from '@/components/dashboard/CreateUserForm';
import {
  LayoutDashboard, Calendar, Clock, Users, BookOpen,
  GraduationCap, PlayCircle, PlusCircle, Eye, StopCircle,
  Radio, CheckCircle2, XCircle, ChevronDown, ChevronRight, ChevronLeft,
  Link2, Copy, ExternalLink, Video, MapPin,
  AlertTriangle, Zap, X, FileText, Plus, User, Pencil,
  CheckCircle, AlertCircle, Layers, Trash2, RefreshCw, Repeat,
  Database, Save, Send, Table2, FolderOpen, Upload,
  CalendarClock, Ban, ClipboardList, Briefcase,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────
const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Social Science', 'English', 'Malayalam', 'Arabic'];
const DEFAULT_GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DEFAULT_BOARDS = ['CBSE', 'ICSE', 'State Board'];

const BATCH_TEMPLATES = [
  { type: 'one_to_one' as const,   label: 'One-to-One',   description: '1 Student — Personal tuition.',   maxStudents: 1,   icon: User,          color: 'bg-blue-50 border-blue-200 text-blue-700',    selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300' },
  { type: 'one_to_three' as const, label: 'One-to-Three', description: 'Up to 3 Students — Small group.', maxStudents: 3,   icon: Users,         color: 'bg-emerald-50 border-emerald-200 text-emerald-700', selectedColor: 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300' },
  { type: 'one_to_many' as const,  label: 'Classroom',    description: 'Full session batch — Multiple students.', maxStudents: 15, icon: GraduationCap, color: 'bg-purple-50 border-purple-200 text-purple-700', selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300' },
  { type: 'custom' as const,       label: 'Custom',       description: 'Custom configuration.', maxStudents: 999, icon: Layers,        color: 'bg-amber-50 border-amber-200 text-amber-700',  selectedColor: 'bg-amber-100 border-amber-500 ring-2 ring-amber-300' },
];

type BatchType = 'one_to_one' | 'one_to_three' | 'one_to_many' | 'custom';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

// ─── Types ──────────────────────────────────────────────────
interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: string;
  subjects: string[] | null;
  grade: string;
  section: string | null;
  board: string | null;
  coordinator_email: string | null;
  coordinator_name: string | null;
  academic_operator_email: string | null;
  academic_operator_name: string | null;
  max_students: number;
  status: string;
  notes: string | null;
  created_at: string;
  student_count: number;
  teacher_count: number;
  teachers: { teacher_email: string; teacher_name: string; subject: string }[];
}

interface BatchDetail {
  batch: Batch;
  students: BatchStudent[];
  teachers: { teacher_email: string; teacher_name: string | null; subject: string; added_at?: string }[];
}

interface BatchStudent {
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  added_at: string;
  total_classes: number | null;
  present: number | null;
  attendance_rate: number | null;
}

interface Session {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  teaching_minutes: number;
  prep_buffer_minutes: number;
  status: string;
  livekit_room_name: string | null;
  topic: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  batch_name?: string;
  batch_type?: string;
  grade?: string;
  section?: string;
  student_count?: number;
}

interface JoinLink {
  email: string;
  name: string;
  role: string;
  token: string;
  join_url: string;
}

interface Person {
  email: string;
  full_name: string;
  portal_role: string;
  phone: string | null;
  subjects: string[] | null;
  grade: string | null;
  board: string | null;
  parent_email: string | null;
  parent_name: string | null;
}

interface AcademicOperatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ─── Helpers ────────────────────────────────────────────────
const BATCH_TYPE_LABELS: Record<string, string> = { one_to_one: '1:1', one_to_three: '1:3', one_to_many: '1:Many', custom: 'Custom' };
const BATCH_TYPE_VARIANTS: Record<string, 'info' | 'primary' | 'warning' | 'default'> = { one_to_one: 'info', one_to_three: 'primary', one_to_many: 'warning', custom: 'default' };

function fmtTime12(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  // Handle both "2026-02-26" and "2026-02-26T00:00:00.000Z" formats
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const iso = dateStr.slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function todayISO(): string {
  const d = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + offset);
  return ist.toISOString().slice(0, 10);
}

// Subject group colors for visual distinction
const SUBJECT_COLORS: { bg: string; border: string; text: string; dot: string }[] = [
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
];

function groupSessionsBySubject(sessions: Session[]): { subject: string; sessions: Session[]; color: typeof SUBJECT_COLORS[0] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = map.get(s.subject) || [];
    list.push(s);
    map.set(s.subject, list);
  }
  return Array.from(map.entries()).map(([subject, sessionsArr], idx) => ({
    subject,
    sessions: sessionsArr,
    color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
  }));
}

function batchTypeLabel(t: string): string {
  const labels: Record<string, string> = { one_to_one: 'One-to-One', one_to_three: 'One-to-Three', one_to_many: 'One-to-Many', custom: 'Custom' };
  return labels[t] || t;
}

function batchTypeBadgeVariant(t: string): 'primary' | 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = { one_to_one: 'primary', one_to_three: 'success', one_to_many: 'info', custom: 'warning' };
  return map[t] || 'default';
}

// Get dates for given day-of-week names from a start date for N weeks or N months
function getDatesForDays(days: string[], startDate: string, count: number, unit: 'weeks' | 'months' = 'months'): { day: string; date: string }[] {
  const dayToIdx: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dates: { day: string; date: string }[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  if (unit === 'months') {
    end.setMonth(end.getMonth() + count);
  } else {
    end.setDate(end.getDate() + count * 7);
  }
  // Iterate week by week from start until end date
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7) + 1;
  for (let w = 0; w < totalWeeks; w++) {
    for (const day of days) {
      const target = dayToIdx[day];
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7);
      const current = d.getDay();
      const diff = (target - current + 7) % 7;
      d.setDate(d.getDate() + diff);
      if (d >= start && d < end) {
        const iso = d.toISOString().slice(0, 10);
        if (!dates.find(x => x.date === iso)) {
          dates.push({ day, date: iso });
        }
      }
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates;
}

// ─── Tab Config ─────────────────────────────────────────────
type AOTab = 'overview' | 'batches' | 'sessions' | 'materials' | 'monitoring' | 'requests';

interface AOSessionRequest {
  id: string;
  request_type: 'reschedule' | 'cancel';
  requester_email: string;
  requester_name: string;
  requester_role: string;
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
}

interface AOLeaveRequest {
  id: string;
  teacher_email: string;
  teacher_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  ao_status: string;
  ao_reviewed_by: string | null;
  ao_reviewed_at: string | null;
  affected_sessions: string[];
  created_at: string;
}

interface MonitoringAlertAO {
  id: string;
  room_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  target_email: string | null;
  status: string;
  created_at: string;
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function AcademicOperatorDashboardClient({ userName, userEmail, userRole }: AcademicOperatorDashboardClientProps) {
  const [tab, setTab] = useState<AOTab>('overview');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [monitorAlerts, setMonitorAlerts] = useState<MonitoringAlertAO[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<AOSessionRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<AOLeaveRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const toast = useToast();

  const fetchMonitorAlerts = useCallback(async () => {
    setLoadingMonitor(true);
    try {
      const res = await fetch('/api/v1/monitoring/alerts');
      const data = await res.json();
      if (data.success) setMonitorAlerts(data.data?.alerts || []);
    } catch { /* ignore */ }
    finally { setLoadingMonitor(false); }
  }, []);

  const fetchBatches = useCallback(async (q = '', isSearch = false) => {
    if (!isSearch) setLoading(true);
    try {
      const url = q ? `/api/v1/batches?q=${encodeURIComponent(q)}` : '/api/v1/batches';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setBatches(data.data?.batches || []);
    } catch { toast.error('Failed to load batches'); }
    finally { if (!isSearch) setLoading(false); }
  }, [toast]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/v1/batch-sessions');
      const data = await res.json();
      if (data.success) setSessions(data.data?.sessions || []);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoadingSessions(false); }
  }, [toast]);

  const fetchSessionRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.requests ?? []);
    } catch { /* */ }
    finally { setLoadingRequests(false); }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    setLoadingLeave(true);
    try {
      const res = await fetch('/api/v1/teacher-leave');
      const data = await res.json();
      if (data.success) setLeaveRequests(data.requests ?? []);
    } catch { /* */ }
    finally { setLoadingLeave(false); }
  }, []);

  useEffect(() => { fetchBatches(); fetchSessions(); fetchMonitorAlerts(); }, [fetchBatches, fetchSessions, fetchMonitorAlerts]);

  // Auto-refresh monitoring alerts every 30s
  useEffect(() => {
    const iv = setInterval(fetchMonitorAlerts, 30_000);
    return () => clearInterval(iv);
  }, [fetchMonitorAlerts]);

  // Auto-refresh sessions every 30s so live/ended status stays current
  useEffect(() => {
    const iv = setInterval(fetchSessions, 30_000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

  // ── Auto-start polling: check every 60s for sessions whose prep window opened ──
  useEffect(() => {
    let mounted = true;
    const autoStart = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/auto-start', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.started > 0) {
          toast.success(`Auto-started ${data.data.started} session${data.data.started > 1 ? 's' : ''} (prep time open)`);
          fetchSessions();
        }
      } catch { /* silent */ }
    };
    autoStart(); // run immediately on mount
    const iv = setInterval(autoStart, 60_000); // then every 60s
    return () => { mounted = false; clearInterval(iv); };
  }, [toast, fetchSessions]);

  // ── Daily timetable email: send once every morning ──
  useEffect(() => {
    let mounted = true;
    const sendTimetable = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/daily-timetable', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.sent > 0) {
          toast.success(`Daily timetable sent to ${data.data.sent} recipient${data.data.sent > 1 ? 's' : ''}`);
        }
      } catch { /* silent */ }
    };
    sendTimetable(); // check on mount
    const iv = setInterval(sendTimetable, 5 * 60_000); // re-check every 5 min (deduped server-side)
    return () => { mounted = false; clearInterval(iv); };
  }, [toast]);

  // ── Session reminder email: 30 min before class, send join links ──
  useEffect(() => {
    let mounted = true;
    const sendReminders = async () => {
      try {
        const res = await fetch('/api/v1/batch-sessions/session-reminder', { method: 'POST' });
        const data = await res.json();
        if (!mounted) return;
        if (data.success && data.data?.sent > 0) {
          toast.success(`Sent ${data.data.sent} session reminder${data.data.sent > 1 ? 's' : ''} (30 min before)`);
        }
      } catch { /* silent */ }
    };
    sendReminders(); // check on mount
    const iv = setInterval(sendReminders, 60_000); // every 60s (deduped server-side)
    return () => { mounted = false; clearInterval(iv); };
  }, [toast]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '') as AOTab;
      if (['overview', 'batches', 'sessions', 'materials', 'monitoring', 'requests'].includes(hash)) setTab(hash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (tab === 'requests' && sessionRequests.length === 0 && !loadingRequests) fetchSessionRequests();
    if (tab === 'requests' && leaveRequests.length === 0 && !loadingLeave) fetchLeaveRequests();
  }, [tab, sessionRequests.length, loadingRequests, leaveRequests.length, loadingLeave, fetchSessionRequests, fetchLeaveRequests]);

  const stats = {
    totalBatches: batches.length,
    activeBatches: batches.filter(b => b.status === 'active').length,
    todaySessions: sessions.filter(s => isToday(s.scheduled_date) && s.status !== 'cancelled').length,
    liveSessions: sessions.filter(s => s.status === 'live').length,
    scheduledSessions: sessions.filter(s => s.status === 'scheduled').length,
    totalStudents: batches.reduce((sum, b) => sum + Number(b.student_count || 0), 0),
  };

  const refreshAll = () => { fetchBatches(); fetchSessions(); };

  // Create batch wizard state
  const [showCreateBatch, setShowCreateBatch] = useState(false);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={LayoutDashboard} title="Academic Operator" subtitle={`Welcome back, ${userName}`}>
          <RefreshButton loading={loading || loadingSessions} onClick={refreshAll} />
          {tab !== 'materials' && (
            <Button variant="primary" icon={Plus} onClick={() => setShowCreateBatch(true)}>New Batch</Button>
          )}
        </PageHeader>

        {userRole === 'owner' && (
          <TabBar
            tabs={[
              { key: 'overview',   label: 'Overview',   icon: LayoutDashboard },
              { key: 'batches',    label: 'Batches',    icon: BookOpen,    count: stats.activeBatches },
              { key: 'sessions',   label: 'Sessions',   icon: Calendar,    count: stats.todaySessions },
              { key: 'materials',  label: 'Materials',  icon: FolderOpen },
              { key: 'monitoring', label: 'Monitoring', icon: AlertTriangle, count: monitorAlerts.length },
              { key: 'requests',   label: 'Requests',   icon: ClipboardList,  count: sessionRequests.filter(r => r.status === 'pending').length + leaveRequests.filter(r => r.ao_status === 'pending').length },
            ]}
            active={tab}
            onChange={(k) => { setTab(k as AOTab); window.location.hash = k; }}
          />
        )}

        {tab === 'overview' && (
          <OverviewTab stats={stats} sessions={sessions} batches={batches} loading={loading || loadingSessions} />
        )}
        {tab === 'batches' && (
          <BatchesTab batches={batches} sessions={sessions} loading={loading} onRefresh={refreshAll} onSearch={(q: string) => fetchBatches(q, true)} userRole={userRole} />
        )}
        {tab === 'sessions' && (
          <SessionsTab sessions={sessions} batches={batches} loading={loadingSessions} onRefresh={refreshAll} />
        )}
        {tab === 'materials' && (
          <MaterialsTab userEmail={userEmail} userRole={userRole} batches={batches} />
        )}
        {tab === 'monitoring' && (
          <AOMonitoringTab alerts={monitorAlerts} loading={loadingMonitor} onRefresh={fetchMonitorAlerts} />
        )}
        {tab === 'requests' && (
          <AORequestsTab
            sessionRequests={sessionRequests}
            leaveRequests={leaveRequests}
            loadingRequests={loadingRequests}
            loadingLeave={loadingLeave}
            onRefresh={() => { fetchSessionRequests(); fetchLeaveRequests(); }}
            toast={toast}
          />
        )}
      </div>

      {/* Create Batch Wizard */}
      {showCreateBatch && (
        <CreateBatchWizard
          batches={batches}
          userRole={userRole}
          userEmail={userEmail}
          onClose={() => setShowCreateBatch(false)}
          onCreated={() => { setShowCreateBatch(false); refreshAll(); }}
        />
      )}
    </DashboardShell>
  );
}

// ─── Overview Tab ───────────────────────────────────────────
function OverviewTab({ stats, sessions, batches, loading }: {
  stats: { totalBatches: number; activeBatches: number; todaySessions: number; liveSessions: number; scheduledSessions: number; totalStudents: number };
  sessions: Session[];
  batches: Batch[];
  loading: boolean;
}) {
  if (loading) return <LoadingState />;

  const todaySessions = sessions
    .filter(s => isToday(s.scheduled_date) && s.status !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const liveSessions = sessions.filter(s => s.status === 'live');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={BookOpen}      label="Total Batches"    value={stats.totalBatches}      variant="default" />
        <StatCard icon={Zap}           label="Active Batches"   value={stats.activeBatches}     variant="success" />
        <StatCard icon={Calendar}      label="Today's Sessions" value={stats.todaySessions}     variant="info" />
        <StatCard icon={Radio}         label="Live Now"         value={stats.liveSessions}      variant="success" />
        <StatCard icon={Clock}         label="Scheduled"        value={stats.scheduledSessions} variant="warning" />
        <StatCard icon={GraduationCap} label="Total Students"   value={stats.totalStudents}     variant="default" />
      </div>

      {liveSessions.length > 0 && (
        <Alert
          variant="success"
          message={`${liveSessions.length} session${liveSessions.length > 1 ? 's' : ''} currently live: ${liveSessions.map(s => `${s.subject} (${s.batch_name || s.batch_id})`).join(', ')}`}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-emerald-600" /> Today&apos;s Agenda
        </h3>
        {todaySessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No sessions scheduled for today</p>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => (
              <div key={s.session_id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  s.status === 'live' ? 'bg-green-100 text-green-600' : 'bg-teal-50 text-teal-600'
                }`}>
                  {s.status === 'live' ? <Radio className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{s.subject}</span>
                    <StatusBadge status={s.status} />
                    {s.topic && <span className="text-xs text-gray-400">— {s.topic}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(s.start_time)}</span>
                    <span>{s.duration_minutes}m</span>
                    {s.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.teacher_name}</span>}
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{s.batch_name || s.batch_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {batches.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-emerald-600" /> Batch Summary
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.filter(b => b.status === 'active').slice(0, 6).map(b => (
              <div key={b.batch_id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{b.batch_name}</span>
                  <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                </div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>{b.grade}{b.section ? ` - ${b.section}` : ''}</span>
                  <span>{b.student_count} student{b.student_count !== 1 ? 's' : ''}</span>
                  <span>{b.teacher_count} teacher{b.teacher_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Batches Tab ────────────────────────────────────────────
function BatchesTab({ batches, sessions, loading, onRefresh, onSearch, userRole }: {
  batches: Batch[];
  sessions: Session[];
  loading: boolean;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  userRole: string;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [scheduleBatch, setScheduleBatch] = useState<Batch | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [timetableBatch, setTimetableBatch] = useState<Batch | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(val);
    }, 400);
  };

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleDelete = async (batch: Batch, permanent: boolean) => {
    setDeleting(true);
    try {
      const url = permanent
        ? `/api/v1/batches/${batch.batch_id}?permanent=true`
        : `/api/v1/batches/${batch.batch_id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(permanent ? 'Batch permanently deleted' : 'Batch archived');
        setDeleteBatch(null);
        if (expandedBatch === batch.batch_id) setExpandedBatch(null);
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to delete batch');
      }
    } catch { toast.error('Failed to delete batch'); }
    setDeleting(false);
  };

  if (loading && batches.length === 0) return <LoadingState />;

  const filtered = batches
    .filter(b => statusFilter === 'all' || b.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search batches, students, teachers, parents..." />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No batches found" />
      ) : (
        <TableWrapper footer={<span>{filtered.length} batch{filtered.length !== 1 ? 'es' : ''}</span>}>
          <THead>
            <TH />
            <TH>Batch</TH>
            <TH>Type</TH>
            <TH>Grade</TH>
            <TH>Subjects</TH>
            <TH>Students</TH>
            <TH>Teachers</TH>
            <TH>Status</TH>
            <TH></TH>
          </THead>
          <tbody>
            {filtered.map(b => (
              <React.Fragment key={b.batch_id}>
                <TRow
                  selected={expandedBatch === b.batch_id}
                  onClick={() => setExpandedBatch(expandedBatch === b.batch_id ? null : b.batch_id)}
                >
                  <td className="px-3 py-3 w-8">
                    {expandedBatch === b.batch_id
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{b.batch_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{b.batch_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={BATCH_TYPE_LABELS[b.batch_type] || b.batch_type} variant={BATCH_TYPE_VARIANTS[b.batch_type] || 'default'} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {b.grade}{b.section ? ` - ${b.section}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(b.subjects || []).map(s => (
                        <span key={s} className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.student_count}</td>
                  <td className="px-4 py-3 text-gray-700">{b.teacher_count}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {b.status === 'active' && (
                        <Button
                          icon={PlusCircle}
                          size="xs"
                          variant="primary"
                          onClick={() => setScheduleBatch(b)}
                        >
                          Schedule
                        </Button>
                      )}
                      <button
                        type="button"
                        title="View Weekly Timetable"
                        onClick={() => setTimetableBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Table2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Edit batch"
                        onClick={() => setEditBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete batch"
                        onClick={() => setDeleteBatch(b)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </TRow>
                {expandedBatch === b.batch_id && (
                  <tr>
                    <td colSpan={9} className="p-0 bg-gray-50/80">
                      <BatchDetailInline
                        batch={b}
                        sessions={sessions.filter(s => s.batch_id === b.batch_id)}
                        onRefresh={onRefresh}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </TableWrapper>
      )}

      {scheduleBatch && (
        <ScheduleSessionModal
          batch={scheduleBatch}
          onClose={() => setScheduleBatch(null)}
          onCreated={() => { setScheduleBatch(null); onRefresh(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Batch</h3>
                <p className="text-sm text-gray-500">{deleteBatch.batch_name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Choose how to remove this batch:
            </p>
            <div className="space-y-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteBatch, false)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left disabled:opacity-50"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Archive</p>
                  <p className="text-xs text-amber-600">Mark as archived. Can be restored later.</p>
                </div>
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteBatch, true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left disabled:opacity-50"
              >
                <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Permanently Delete</p>
                  <p className="text-xs text-red-600">Remove all data including students & sessions. Cannot be undone.</p>
                </div>
              </button>
            </div>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteBatch(null)}
              className="w-full mt-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editBatch && (
        <EditBatchModal
          batch={editBatch}
          batches={batches}
          userRole={userRole}
          onClose={() => setEditBatch(null)}
          onSaved={() => { setEditBatch(null); onRefresh(); }}
        />
      )}

      {/* Weekly Timetable Modal */}
      {timetableBatch && (
        <WeeklyTimetableModal
          batch={timetableBatch}
          onClose={() => setTimetableBatch(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Weekly Timetable Modal
// Shows batch timetable grouped by day-of-week with send button.
// ═══════════════════════════════════════════════════════════════

interface TimetableSlot {
  day: string;
  subject: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  duration: string;
}

const DAY_THEME_TT = { bg: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-200', light: 'bg-emerald-50' };

const ALL_DAYS_TT = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function WeeklyTimetableModal({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [byDay, setByDay] = useState<Record<string, TimetableSlot[]>>({});
  const [sortedDays, setSortedDays] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ sent: number; total: number } | null>(null);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/batch-sessions/weekly-timetable?batch_id=${batch.batch_id}`);
        const data = await res.json();
        if (data.success) {
          setSlots(data.data.slots || []);
          setByDay(data.data.byDay || {});
          setSortedDays(data.data.sortedDays || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [batch.batch_id]);

  const handleSendTimetable = async (isUpdate: boolean) => {
    setSending(true);
    setSentResult(null);
    try {
      const res = await fetch('/api/v1/batch-sessions/weekly-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.batch_id, is_update: isUpdate }),
      });
      const data = await res.json();
      if (data.success) {
        const sent = data.data?.sent || 0;
        const total = data.data?.total_recipients || 0;
        setSentResult({ sent, total });
        toast.success(`Timetable sent to ${sent} of ${total} recipient${total > 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to send timetable');
      }
    } catch {
      toast.error('Network error sending timetable');
    }
    setSending(false);
  };

  const uniqueSubjects = [...new Set(slots.map(s => s.subject))];
  const activeDays = sortedDays.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-700 px-6 py-5 relative overflow-hidden shrink-0">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Table2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Weekly Timetable</h2>
                <p className="text-white/70 text-xs mt-0.5">
                  {batch.batch_name} · Grade {batch.grade}{batch.section ? ` - ${batch.section}` : ''} · Mon–Sat
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && slots.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span className="text-gray-500">Days:</span>
              <span className="font-semibold text-gray-800">{activeDays} / 6</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              <span className="text-gray-500">Sessions/Week:</span>
              <span className="font-semibold text-gray-800">{slots.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-teal-600" />
              <span className="text-gray-500">Subjects:</span>
              <span className="font-semibold text-gray-800">{uniqueSubjects.join(', ')}</span>
            </div>
          </div>
        )}

        {/* Timetable content — Mon to Sat grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 text-gray-300 animate-spin" />
              <span className="ml-3 text-sm text-gray-400">Loading timetable…</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No sessions scheduled for this batch</p>
              <p className="text-xs text-gray-300 mt-1">Schedule sessions to see the timetable here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ALL_DAYS_TT.map(day => {
                const daySlots = byDay[day] || [];
                const dc = DAY_THEME_TT;
                const hasClasses = daySlots.length > 0;
                return (
                  <div key={day} className={`rounded-xl border ${hasClasses ? dc.border : 'border-gray-100'} overflow-hidden`}>
                    {/* Day badge header */}
                    <div className={`flex items-center gap-2 px-4 py-2 ${hasClasses ? dc.light : 'bg-gray-50'}`}>
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${hasClasses ? dc.bg : 'bg-gray-300'} text-white text-[10px] font-bold`}>
                        {day.slice(0, 2).toUpperCase()}
                      </span>
                      <span className={`text-sm font-bold ${hasClasses ? dc.text : 'text-gray-400'}`}>{day}</span>
                      {!hasClasses && <span className="text-xs text-gray-300 italic ml-1">— No session</span>}
                      {hasClasses && <span className="text-xs text-gray-400 ml-auto">{daySlots.length} session{daySlots.length > 1 ? 's' : ''}</span>}
                    </div>
                    {/* Session rows */}
                    {hasClasses && (
                      <table className="w-full">
                        <tbody>
                          {daySlots.map((s, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 whitespace-nowrap w-40">
                                {s.startTime} – {s.endTime}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-sm font-semibold text-gray-800">{s.subject}</span>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-600">{s.teacherName}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-400 w-20 text-right">{s.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with send buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          {sentResult && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">
                Timetable sent to {sentResult.sent} of {sentResult.total} recipient{sentResult.total > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Close
            </button>
            <div className="flex items-center gap-2">
              {slots.length > 0 && (
                <>
                  <Button
                    icon={Send}
                    size="sm"
                    variant="primary"
                    onClick={() => handleSendTimetable(false)}
                    disabled={sending}
                    loading={sending}
                  >
                    {sending ? 'Sending…' : 'Send Timetable'}
                  </Button>
                  <Button
                    icon={RefreshCw}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSendTimetable(true)}
                    disabled={sending}
                    loading={sending}
                  >
                    {sending ? 'Sending…' : 'Send as Update'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Batch Modal (exact same design as CreateBatchWizard) ───
type EditStep = 'students' | 'details' | 'teachers' | 'review';
const EDIT_STEPS: { key: EditStep; label: string }[] = [
  { key: 'students', label: 'Students' },
  { key: 'details', label: 'Details' },
  { key: 'teachers', label: 'Subjects & Teachers' },
  { key: 'review', label: 'Review' },
];

function EditBatchModal({ batch, batches, userRole, onClose, onSaved }: {
  batch: Batch;
  batches: Batch[];
  userRole: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [wizardStep, setWizardStep] = useState<EditStep>('students');
  const [saving, setSaving] = useState(false);

  // Academic settings
  const [SUBJECTS, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [GRADES] = useState<string[]>(DEFAULT_GRADES);
  const [SECTIONS] = useState<string[]>(DEFAULT_SECTIONS);
  const [BOARDS] = useState<string[]>(DEFAULT_BOARDS);

  // Form state — prefilled from batch
  const [formName, setFormName] = useState(batch.batch_name);
  const [formSubjects, setFormSubjects] = useState<string[]>(batch.subjects || []);
  const [formGrade, setFormGrade] = useState(batch.grade || '');
  const [formSection, setFormSection] = useState(batch.section || '');
  const [formBoard, setFormBoard] = useState(batch.board || '');
  const [formCoordinator, setFormCoordinator] = useState(batch.coordinator_email || '');
  const [formMaxStudents, setFormMaxStudents] = useState(String(batch.max_students || ''));
  const [formNotes, setFormNotes] = useState(batch.notes || '');
  const [formStatus, setFormStatus] = useState(batch.status);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [academicOperators, setAcademicOperators] = useState<Person[]>([]);
  const [formAO, setFormAO] = useState(batch.academic_operator_email || '');
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');

  // Create user modal (for parents)
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();

  // Fetch settings
  useEffect(() => {
    fetch('/api/v1/academics/settings').then(r => r.json()).then(d => {
      if (d.success && d.data?.subjects?.length) setSubjects(d.data.subjects);
    }).catch(() => {});
  }, []);

  // Fetch batch detail + people on mount
  useEffect(() => {
    const loadPeople = async () => {
      setPeopleLoading(true);
      try {
        const fetches: Promise<Response>[] = [
          fetch(`/api/v1/batches/${batch.batch_id}`),
          fetch('/api/v1/batches/people?role=student'),
          fetch('/api/v1/batches/people?role=teacher'),
          fetch('/api/v1/hr/users?role=batch_coordinator&limit=500'),
        ];
        if (userRole === 'owner') fetches.push(fetch('/api/v1/hr/users?role=academic_operator&limit=500'));
        const responses = await Promise.all(fetches.map(f => f.then(r => r.json())));
        const [detailRes, studRes, teachRes, coordRes] = responses;
        if (studRes.success) setStudents(studRes.data.people);
        if (teachRes.success) setTeachers(teachRes.data.people);
        if (coordRes.success) setCoordinators(coordRes.data.users);
        if (userRole === 'owner' && responses[4]?.success) setAcademicOperators(responses[4].data.users);
        if (detailRes.success) {
          const tMap: Record<string, string> = {};
          for (const t of detailRes.data.teachers || []) tMap[t.subject] = t.teacher_email;
          setSubjectTeachers(tMap);
          setSelectedStudents(
            (detailRes.data.students || []).map((s: BatchStudent) => ({
              email: s.student_email,
              name: s.student_name || s.student_email,
              parent_email: s.parent_email || null,
              parent_name: s.parent_name || null,
            }))
          );
        }
      } catch { toast.error('Failed to load batch details'); }
      setPeopleLoading(false);
    };
    loadPeople();
  }, [batch.batch_id, userRole, toast]);

  const stepIdx = EDIT_STEPS.findIndex(s => s.key === wizardStep);

  // Helpers — same as CreateBatchWizard
  const getUsedSections = (grade: string): string[] => batches.filter(b => b.batch_id !== batch.batch_id && b.grade === grade && b.section).map(b => b.section as string);
  const getNextSection = (grade: string): string => { const used = getUsedSections(grade); return SECTIONS.find(s => !used.includes(s)) || ''; };
  const autoName = (grade: string, section: string) => { if (grade && section) return `Class ${grade} ${section}`; if (grade) return `Class ${grade}`; return ''; };

  const handleGradeChange = (g: string) => {
    setFormGrade(g);
    const nextSection = g ? getNextSection(g) : '';
    setFormSection(nextSection);
    setFormName(autoName(g, nextSection));
  };

  const getMaxForType = (): number => {
    if (batch.batch_type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === batch.batch_type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formName.trim() !== '' && formGrade !== '';

  // Student selection — same as CreateBatchWizard
  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const isStudentSelected = (email: string) => selectedStudents.some(s => s.email === email);
  const maxReached = selectedStudents.length >= getMaxForType();

  const toggleStudent = (person: Person) => {
    if (isStudentSelected(person.email)) {
      setSelectedStudents(prev => prev.filter(s => s.email !== person.email));
    } else {
      if (maxReached) { toast.error(`Max ${getMaxForType()} students for this batch type.`); return; }
      setSelectedStudents(prev => [...prev, { email: person.email, name: person.full_name, parent_email: person.parent_email || null, parent_name: person.parent_name || null }]);
    }
  };

  const removeStudent = (email: string) => setSelectedStudents(prev => prev.filter(s => s.email !== email));

  const toggleSubject = (subj: string) => {
    setFormSubjects(prev => {
      if (prev.includes(subj)) {
        setSubjectTeachers(st => { const copy = { ...st }; delete copy[subj]; return copy; });
        return prev.filter(s => s !== subj);
      }
      return [...prev, subj];
    });
  };

  // Create parent — same as CreateBatchWizard
  const openCreateParent = (studentEmail: string) => { setParentForStudent(studentEmail); setCreateUserRole('parent'); setShowCreateUser(true); };
  const handleUserCreated = async (data?: { email: string; full_name: string; temp_password: string }) => {
    if (data && parentForStudent) {
      setSelectedStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      setStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      try {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(parentForStudent)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_email: data.email }),
        });
      } catch { /* ignore */ }
    }
  };

  // Submit — PATCH instead of POST
  const submitBatch = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const body = {
        batch_name: formName.trim(),
        subjects: formSubjects.length > 0 ? formSubjects : null,
        grade: formGrade || null,
        section: formSection || null,
        board: formBoard || null,
        coordinator_email: formCoordinator || null,
        academic_operator_email: formAO || null,
        max_students: batch.batch_type === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(),
        notes: formNotes || null,
        status: formStatus,
        teachers: formSubjects.filter(s => subjectTeachers[s]).map(s => ({ email: subjectTeachers[s], subject: s })),
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch(`/api/v1/batches/${batch.batch_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success('Batch updated successfully!'); onSaved(); }
      else toast.error(json.error || 'Failed to update batch');
    } catch { toast.error('Failed to update batch'); }
    setSaving(false);
  };

  // Navigation — same as CreateBatchWizard
  const goNext = () => { if (stepIdx < EDIT_STEPS.length - 1) setWizardStep(EDIT_STEPS[stepIdx + 1].key); };
  const goPrev = () => { if (stepIdx > 0) setWizardStep(EDIT_STEPS[stepIdx - 1].key); };
  const canGoNext = (): boolean => {
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') return true;
    return false;
  };

  // ── Step renderers — exact same as CreateBatchWizard ──

  const renderStudentsStep = () => {
    const max = getMaxForType();
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Add Students</h3>
        <p className="text-gray-500 mb-6">Select students for this batch</p>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-sm font-semibold text-emerald-700">{selectedStudents.length}</span>
              <span className="text-xs text-emerald-500 ml-1">/ {max === 999 ? '∞' : max}</span>
            </div>
            <span className="text-sm text-gray-500">students selected</span>
          </div>
          <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="w-72!" />
        </div>

        {selectedStudents.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Students</h4>
            {selectedStudents.map(s => (
              <div key={s.email} className="rounded-xl border-2 border-emerald-200 overflow-hidden">
                <div className="flex items-center justify-between bg-emerald-50/80 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.parent_email ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="h-3.5 w-3.5" /> Parent: {s.parent_name || s.parent_email}
                      </span>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openCreateParent(s.email); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-200 transition-all cursor-pointer"
                      >
                        <AlertCircle className="h-4 w-4" /> No Parent — Click to Add
                      </button>
                    )}
                    <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-xl max-h-72 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0"><tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  return (
                    <tr key={s.email} className={`border-t hover:bg-emerald-50/30 cursor-pointer transition-colors ${selected ? 'bg-emerald-50/50' : ''}`} onClick={() => toggleStudent(s)}>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></td>
                      <td className="px-4 py-3 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-4 py-3">{s.parent_email ? <span className="text-xs text-emerald-600">{s.parent_name || s.parent_email}</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> No parent</span>}</td>
                      <td className="px-4 py-3 text-right">{selected ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span> : maxReached ? <span className="text-xs text-gray-300">Max reached</span> : <span className="text-xs text-gray-400 hover:text-emerald-600">+ Add</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Batch Details</h3>
      <p className="text-gray-500 mb-8">Configure the basic information for this batch</p>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Grade" required>
            <Select value={formGrade} onChange={handleGradeChange}
              options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
            />
          </FormField>
          <FormField label="Section (auto-assigned)">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${formSection ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
              {formSection ? (
                <>
                  <span className="text-2xl font-bold text-emerald-700">{formSection}</span>
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800">Section {formSection}</p>
                    <p className="text-xs text-emerald-500">{getUsedSections(formGrade).length} section{getUsedSections(formGrade).length !== 1 ? 's' : ''} already used</p>
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Select a grade to auto-assign section</p>}
            </div>
          </FormField>
        </div>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Class 10 A" />
        </FormField>
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Board">
            <Select value={formBoard} onChange={setFormBoard}
              options={[{ value: '', label: 'Select Board' }, ...BOARDS.map(b => ({ value: b, label: b }))]}
            />
          </FormField>
          <FormField label="Coordinator">
            <Select value={formCoordinator} onChange={setFormCoordinator}
              options={[
                { value: '', label: 'Select Coordinator' },
                ...coordinators.map(c => {
                  const bc = batches.filter(b => b.coordinator_email === c.email).length;
                  return { value: c.email, label: `${c.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        </div>
        {userRole === 'owner' && (
          <FormField label="Academic Operator">
            <Select value={formAO} onChange={setFormAO}
              options={[
                { value: '', label: 'Select Academic Operator' },
                ...academicOperators.map(ao => {
                  const bc = batches.filter(b => b.academic_operator_email === ao.email).length;
                  return { value: ao.email, label: `${ao.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Status">
            <Select value={formStatus} onChange={setFormStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </FormField>
          {batch.batch_type === 'custom' && (
            <FormField label="Max Students">
              <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
            </FormField>
          )}
        </div>
        <FormField label="Notes">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </FormField>
      </div>
    </div>
  );

  const renderTeachersStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Subjects &amp; Teachers</h3>
      <p className="text-gray-500 mb-8">Select subjects and assign a teacher to each one</p>
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Select Subjects *</label>
        <div className="flex flex-wrap gap-2.5">
          {SUBJECTS.map(subj => {
            const isSelected = formSubjects.includes(subj);
            return (
              <button key={subj} type="button" onClick={() => toggleSubject(subj)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                }`}
              >
                {isSelected && <span className="mr-1.5">✓</span>}{subj}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">{formSubjects.length} of {SUBJECTS.length} subjects selected</p>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Assign Teachers <span className="ml-2 text-xs font-normal text-gray-400">{formSubjects.filter(s => subjectTeachers[s]).length} / {formSubjects.length} assigned</span>
          </label>
          <div className="space-y-3">
            {formSubjects.map(subj => {
              const assigned = !!subjectTeachers[subj];
              return (
                <div key={subj} className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 transition-all ${assigned ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${assigned ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-30"><span className="text-sm font-semibold text-gray-800">{subj}</span></div>
                  <div className="flex-1">
                    <Select
                      value={subjectTeachers[subj] || ''}
                      onChange={(val) => setSubjectTeachers(prev => ({ ...prev, [subj]: val }))}
                      options={[
                        { value: '', label: 'Select Teacher…' },
                        ...teachers.filter(t => { const ts = t.subjects || []; return ts.length === 0 || ts.some(x => x.toLowerCase() === subj.toLowerCase()); })
                          .map(t => ({ value: t.email, label: `${t.full_name}${t.subjects ? ` (${t.subjects.join(', ')})` : ''}` })),
                      ]}
                    />
                  </div>
                  {assigned && <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review &amp; Save</h3>
        <p className="text-gray-500 mb-6">Confirm the batch details before saving</p>
      </div>
      <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
        <h4 className="text-sm font-bold text-emerald-800 mb-4">Batch Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{formName}</span></div>
          <div><span className="text-gray-400">Type:</span> <Badge label={batchTypeLabel(batch.batch_type)} variant={batchTypeBadgeVariant(batch.batch_type)} /></div>
          <div><span className="text-gray-400">Grade / Section:</span> <span className="font-medium text-gray-800">Grade {formGrade}{formSection ? ` ${formSection}` : ''}</span></div>
          <div><span className="text-gray-400">Board:</span> <span className="font-medium text-gray-800">{formBoard || '—'}</span></div>
          <div><span className="text-gray-400">Status:</span> <StatusBadge status={formStatus} /></div>
          <div><span className="text-gray-400">Coordinator:</span> <span className="font-medium text-gray-800">{coordinators.find(c => c.email === formCoordinator)?.full_name || formCoordinator || '—'}</span></div>
          {userRole === 'owner' && <div><span className="text-gray-400">Academic Operator:</span> <span className="font-medium text-gray-800">{academicOperators.find(a => a.email === formAO)?.full_name || formAO || '—'}</span></div>}
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
        </div>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects &amp; Teachers ({formSubjects.length})</h4>
          <div className="space-y-2">
            {formSubjects.map(subj => {
              const teacherEmail = subjectTeachers[subj];
              const teacher = teachers.find(t => t.email === teacherEmail);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teacher ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-30">{subj}</span>
                  <span className="text-gray-300">→</span>
                  {teacher ? <span className="text-emerald-600">{teacher.full_name}</span> : <span className="text-amber-500 italic">No teacher assigned</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedStudents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enrolled Students ({selectedStudents.length})</h4>
          <div className="space-y-2">
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0).toUpperCase()}</div>
                <span className="font-semibold text-gray-700">{s.name}</span>
                <span className="text-gray-400 text-xs">{s.email}</span>
                {s.parent_email ? <span className="ml-auto text-xs text-emerald-600">Parent: {s.parent_name || s.parent_email}</span> : <span className="ml-auto text-xs text-amber-500">No parent assigned</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {formNotes && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-sm text-gray-600">{formNotes}</p>
        </div>
      )}
    </div>
  );

  // ── Wizard overlay — exact same as CreateBatchWizard ──
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Left sidebar */}
          <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <Pencil className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">Edit Batch</h2>
              <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {EDIT_STEPS.length}</p>
            </div>
            <div className="space-y-1 flex-1">
              {EDIT_STEPS.map((step, idx) => {
                const isDone = idx < stepIdx;
                const isCurrent = idx === stepIdx;
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-emerald-200' : 'text-emerald-400/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isDone ? 'bg-emerald-400 text-emerald-900' : isCurrent ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-emerald-300/70'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Cancel &amp; Close
            </button>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              {wizardStep === 'students' && renderStudentsStep()}
              {wizardStep === 'details' && renderDetailsStep()}
              {wizardStep === 'teachers' && renderTeachersStep()}
              {wizardStep === 'review' && renderReviewStep()}
            </div>
            <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
              <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
              <div className="flex items-center gap-3">
                {wizardStep !== 'review' ? (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || saving} size="lg">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal (for parents) */}
      <CreateUserModal
        role={createUserRole}
        open={showCreateUser}
        onClose={() => { setShowCreateUser(false); setParentForStudent(''); }}
        onCreated={handleUserCreated}
      />
    </>
  );
}


// ═════════════════════════════════════════════════════════════
// TAB: Materials (Academic Operator upload + manage)
// ═════════════════════════════════════════════════════════════

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

const MATERIAL_TYPE_STYLE: Record<string, string> = {
  notes:      'bg-blue-50   text-blue-700   border-blue-200',
  assignment: 'bg-amber-50  text-amber-700  border-amber-200',
  resource:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  video:      'bg-purple-50 text-purple-700  border-purple-200',
  other:      'bg-gray-50   text-gray-600   border-gray-200',
};

const MATERIAL_TYPES = ['notes', 'assignment', 'resource', 'video', 'other'];

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialsTab({
  userEmail, userRole, batches,
}: {
  userEmail: string;
  userRole: string;
  batches: Batch[];
}) {
  const toast   = useToast();
  const { confirm } = useConfirm();

  const [materials, setMaterials]   = useState<TeachingMaterial[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterBatch, setFilterBatch]     = useState('');
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);

  const emptyForm = { batch_id: '', subject: '', title: '', description: '', material_type: 'notes' };
  const [form, setForm] = useState(emptyForm);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.set('subject', filterSubject);
      if (filterBatch)   params.set('batch_id', filterBatch);
      const res = await fetch(`/api/v1/teaching-materials?${params}`);
      const data = await res.json();
      if (data.success) setMaterials(data.data.materials || []);
    } catch { toast.error('Failed to load materials'); }
    finally { setLoading(false); }
  }, [filterSubject, filterBatch, toast]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleSubmit = async () => {
    if (!form.batch_id)         { toast.error('Batch is required');            return; }
    if (!form.subject.trim())   { toast.error('Subject is required');          return; }
    if (!form.title.trim())     { toast.error('Title is required');            return; }
    if (!selectedFile)          { toast.error('Please select a file to upload'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('batch_id', form.batch_id);
      fd.append('subject', form.subject);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('material_type', form.material_type);
      const res = await fetch('/api/v1/teaching-materials', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Upload failed'); return; }
      toast.success('Material uploaded successfully');
      setForm(emptyForm);
      setSelectedFile(null);
      setShowForm(false);
      fetchMaterials();
    } catch { toast.error('Server error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({ title: 'Delete Material', message: `Delete "${title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/teaching-materials?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Delete failed'); return; }
      toast.success('Material deleted');
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch { toast.error('Server error'); }
  };

  const subjectOptions = Array.from(
    new Set(batches.flatMap(b => b.subjects ?? []))
  ).sort();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-emerald-600" /> Teaching Materials
        </h2>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={fetchMaterials} loading={loading} />
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancel' : 'Upload Material'}
          </Button>
        </div>
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-emerald-800">Upload New Material</p>
          <FormGrid>
            <FormField label="Batch *">
              <Select
                value={form.batch_id}
                onChange={v => setForm(f => ({ ...f, batch_id: v }))}
                options={[
                  { value: '', label: 'Select batch…' },
                  ...batches.map(b => ({ value: b.batch_id, label: b.batch_name })),
                ]}
              />
            </FormField>
            <FormField label="Subject *">
              <Select
                value={form.subject}
                onChange={v => setForm(f => ({ ...f, subject: v }))}
                options={[
                  { value: '', label: 'Select subject…' },
                  ...subjectOptions.map(s => ({ value: s, label: s })),
                ]}
              />
            </FormField>
            <FormField label="Material Type">
              <Select
                value={form.material_type}
                onChange={v => setForm(f => ({ ...f, material_type: v }))}
                options={MATERIAL_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
              />
            </FormField>
            <FormField label="Title *">
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Chapter 5 Notes"
              />
            </FormField>
          </FormGrid>
          <FormField label="Description">
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes about this material…"
              rows={2}
            />
          </FormField>
          <FormField label="File * (PDF, Word, Excel, PowerPoint, images — max 50 MB)">
            <div className="mt-1">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer bg-white hover:bg-emerald-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {selectedFile ? (
                    <>
                      <FileText className="h-8 w-8 text-emerald-500 mb-2" />
                      <p className="text-sm font-semibold text-emerald-700">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{fmtBytes(selectedFile.size)}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Click to select file</p>
                      <p className="text-xs text-gray-400 mt-1">.pdf .doc .docx .ppt .pptx .xls .xlsx .txt images</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Remove file
                </button>
              )}
            </div>
          </FormField>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setForm(emptyForm); setSelectedFile(null); setShowForm(false); }}>Cancel</Button>
            <Button variant="primary" icon={Send} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <FilterSelect
          value={filterSubject}
          onChange={v => setFilterSubject(v)}
          options={[
            { value: '', label: 'All subjects' },
            ...subjectOptions.map(s => ({ value: s, label: s })),
          ]}
        />
        <FilterSelect
          value={filterBatch}
          onChange={v => setFilterBatch(v)}
          options={[
            { value: '', label: 'All batches' },
            ...batches.map(b => ({ value: b.batch_id, label: b.batch_name })),
          ]}
        />
      </div>

      {/* List */}
      {loading ? (
        <LoadingState />
      ) : materials.length === 0 ? (
        <EmptyState icon={FolderOpen} message="No materials yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map(m => (
            <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${MATERIAL_TYPE_STYLE[m.material_type] ?? MATERIAL_TYPE_STYLE.other}`}>
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
                <button
                  onClick={() => handleDelete(m.id, m.title)}
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {m.file_size && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fmtBytes(m.file_size)}</span>
                  )}
                </div>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
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
}// ─── Batch Detail Inline (with students & parents) ──────────
function BatchDetailInline({ batch, sessions, onRefresh }: {
  batch: Batch;
  sessions: Session[];
  onRefresh: () => void;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'students' | 'sessions'>('info');

  // Multi-select & edit for sessions
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const toast = useToast();
  const { confirm } = useConfirm();

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject); else next.add(subject);
      return next;
    });
  };

  // Fetch full batch detail (students + parents + teachers)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/v1/batches/${batch.batch_id}`);
        const data = await res.json();
        if (!cancelled && data.success) setDetail(data.data);
      } catch { /* ignore */ }
      if (!cancelled) setDetailLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [batch.batch_id]);

  const sortedSessions = [...sessions].sort((a, b) => {
    const statusOrder: Record<string, number> = { live: 0, scheduled: 1, ended: 2, cancelled: 3 };
    const sa = statusOrder[a.status] ?? 4;
    const sb = statusOrder[b.status] ?? 4;
    if (sa !== sb) return sa - sb;
    return (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time);
  });

  const students = detail?.students || [];
  const teachers = detail?.teachers || batch.teachers;

  // Theme palette: emerald primary, teal secondary
  const tc = { bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'from-emerald-600 to-teal-700' };

  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length;
  const liveCount = sessions.filter(s => s.status === 'live').length;

  return (
    <div className="m-4 mb-6 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      {/* ── Colored header banner ── */}
      <div className={`bg-linear-to-r ${tc.accent} px-6 py-5 relative overflow-hidden`}>
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/5" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{batch.batch_name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/70 text-xs font-mono">{batch.batch_id}</span>
                <span className="bg-white/20 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {BATCH_TYPE_LABELS[batch.batch_type] || batch.batch_type}
                </span>
                <span className="text-white/70 text-xs">Grade {batch.grade}{batch.section ? ` - ${batch.section}` : ''}</span>
              </div>
            </div>
          </div>

          {/* Quick stats pills */}
          <div className="flex items-center gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.student_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Students</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{batch.teacher_count}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Teachers</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center">
              <p className="text-lg font-bold text-white">{sessions.length}</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Sessions</p>
            </div>
            {liveCount > 0 && (
              <div className="bg-green-500/30 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center ring-1 ring-green-300/40">
                <p className="text-lg font-bold text-white flex items-center gap-1"><Radio className="h-3.5 w-3.5 animate-pulse" />{liveCount}</p>
                <p className="text-[10px] text-green-100 uppercase tracking-wider">Live</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Tabs ── */}
      <div className={`${tc.light} px-6 py-2.5 border-b ${tc.border} flex items-center gap-1`}>
        {([
          { key: 'info' as const, label: 'Info & Teachers', icon: Users, count: teachers.length },
          { key: 'students' as const, label: 'Students & Parents', icon: GraduationCap, count: batch.student_count },
          { key: 'sessions' as const, label: 'Sessions', icon: Calendar, count: sessions.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              detailTab === t.key
                ? `bg-white ${tc.text} shadow-sm ring-1 ${tc.border}`
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              detailTab === t.key ? `${tc.light} ${tc.text}` : 'bg-gray-100 text-gray-400'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="px-6 py-5">

        {/* Info & Teachers Tab */}
        {detailTab === 'info' && (
          <div className="space-y-5">
            {/* Coordinator card */}
            <div className={`rounded-xl border ${tc.border} ${tc.light} p-4 flex items-center gap-4`}>
              <div className={`w-11 h-11 rounded-xl ${tc.bg} text-white flex items-center justify-center shrink-0`}>
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Batch Coordinator</p>
                <p className="text-sm font-bold text-gray-900">{batch.coordinator_name || 'Not assigned'}</p>
                {batch.coordinator_email && <p className="text-xs text-gray-500">{batch.coordinator_email}</p>}
              </div>
              {batch.notes && (
                <div className="border-l border-gray-200 pl-4 max-w-xs">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Notes</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{batch.notes}</p>
                </div>
              )}
            </div>

            {/* Teachers grid */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" /> Assigned Teachers
              </h4>
              {teachers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {teachers.map(t => (
                    <div key={t.teacher_email + t.subject} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                      <Avatar name={t.teacher_name || 'T'} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.teacher_name || t.teacher_email}</p>
                        <p className="text-xs text-gray-400 truncate">{t.teacher_email}</p>
                      </div>
                      <span className={`shrink-0 rounded-lg ${tc.light} ${tc.text} px-2.5 py-1 text-[10px] font-bold border ${tc.border}`}>
                        {t.subject}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                  <BookOpen className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                  <p className="text-sm text-gray-400">No teachers assigned yet</p>
                </div>
              )}
            </div>

            {/* Subjects */}
            {(batch.subjects || []).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subjects</h4>
                <div className="flex flex-wrap gap-2">
                  {(batch.subjects || []).map(s => (
                    <span key={s} className={`rounded-lg ${tc.light} border ${tc.border} px-3 py-1.5 text-xs font-semibold ${tc.text}`}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Students & Parents Tab */}
        {detailTab === 'students' && (
          <div className="space-y-3">
            {detailLoading ? (
              <div className="text-center py-10"><div className="inline-flex items-center gap-2 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Loading students...</div></div>
            ) : students.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No students in this batch</p>
                <p className="text-xs text-gray-400 mt-1">Students can be added from the batch settings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((s, idx) => (
                  <div key={s.student_email} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Student Row */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="text-[10px] font-bold text-gray-300 w-5 text-center shrink-0">{idx + 1}</div>
                      <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${tc.accent} text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm`}>
                        {(s.student_name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{s.student_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{s.student_email}</p>
                      </div>
                      {/* Attendance badge */}
                      {s.total_classes != null && s.total_classes > 0 ? (
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${
                            Number(s.attendance_rate) >= 75 ? 'text-green-600' :
                            Number(s.attendance_rate) >= 50 ? 'text-amber-600' : 'text-red-600'
                          }`}>{s.attendance_rate}%</p>
                          <p className="text-[10px] text-gray-400">{s.present}/{s.total_classes} attended</p>
                        </div>
                      ) : (
                        <Badge label="Student" variant="primary" />
                      )}
                    </div>
                    {/* Parent Row */}
                    <div className="border-t border-gray-100 bg-linear-to-r from-teal-50/80 to-emerald-50/40 px-5 py-3 flex items-center gap-3">
                      <div className="w-5 shrink-0" />
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-teal-200">
                        {s.parent_name ? s.parent_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      {s.parent_email ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-gray-800">{s.parent_name || s.parent_email}</p>
                            <span className="rounded bg-teal-100 text-teal-600 px-1.5 py-0.5 text-[9px] font-bold">PARENT</span>
                          </div>
                          <div className="flex gap-3 text-[11px] text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1">✉ {s.parent_email}</span>
                            {s.parent_phone && <span className="flex items-center gap-1">☎ {s.parent_phone}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1">
                            <AlertCircle className="h-3.5 w-3.5" /> No parent linked
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {detailTab === 'sessions' && (() => {
          const scheduledIds = sortedSessions.filter(s => s.status === 'scheduled').map(s => s.session_id);
          const selectedScheduledCount = [...selectedSessions].filter(id => scheduledIds.includes(id)).length;
          const deletableIds = new Set(sortedSessions.filter(s => s.status !== 'live').map(s => s.session_id));
          const selectedDeletableCount = [...selectedSessions].filter(id => deletableIds.has(id)).length;

          const toggleSessionSelect = (id: string) => {
            setSelectedSessions(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };

          const toggleAllSessions = () => {
            if (selectedSessions.size === sortedSessions.length) setSelectedSessions(new Set());
            else setSelectedSessions(new Set(sortedSessions.map(s => s.session_id)));
          };

          const handleBulkCancel = async () => {
            const ids = [...selectedSessions].filter(id => scheduledIds.includes(id));
            if (ids.length === 0) { toast.error('No scheduled sessions selected'); return; }
            const ok = await confirm({
              title: 'Cancel Selected Sessions',
              message: `Cancel ${ids.length} scheduled session${ids.length > 1 ? 's' : ''}? They will remain visible as "Cancelled".`,
              confirmLabel: `Cancel ${ids.length} Session${ids.length > 1 ? 's' : ''}`,
              variant: 'danger',
            });
            if (!ok) return;
            setBulkCancelling(true);
            try {
              const res = await fetch('/api/v1/batch-sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_ids: ids, reason: 'Bulk cancelled by operator' }),
              });
              const data = await res.json();
              if (data.success) { toast.success(data.message || `${data.data?.cancelled} sessions cancelled`); setSelectedSessions(new Set()); onRefresh(); }
              else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
            finally { setBulkCancelling(false); }
          };

          const handleBulkDelete = async () => {
            const ids = [...selectedSessions].filter(id => deletableIds.has(id));
            if (ids.length === 0) { toast.error('No sessions selected to delete (live sessions cannot be deleted)'); return; }
            const ok = await confirm({
              title: 'Permanently Delete Sessions',
              message: `Permanently delete ${ids.length} session${ids.length > 1 ? 's' : ''}? This action cannot be undone. Live sessions will be skipped.`,
              confirmLabel: `Delete ${ids.length} Session${ids.length > 1 ? 's' : ''}`,
              variant: 'danger',
            });
            if (!ok) return;
            setBulkDeleting(true);
            try {
              const res = await fetch('/api/v1/batch-sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_ids: ids, permanent: true }),
              });
              const data = await res.json();
              if (data.success) { toast.success(data.message || `${data.data?.deleted} sessions deleted`); setSelectedSessions(new Set()); onRefresh(); }
              else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
            finally { setBulkDeleting(false); }
          };

          const handleSingleCancel = async (s: Session) => {
            const ok = await confirm({
              title: 'Cancel Session',
              message: `Cancel ${s.subject} on ${fmtDate(s.scheduled_date)} at ${fmtTime12(s.start_time)}? It will remain visible as "Cancelled".`,
              confirmLabel: 'Cancel Session',
              variant: 'danger',
            });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) { toast.success('Session cancelled'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleDelete = async (s: Session) => {
            const ok = await confirm({
              title: 'Permanently Delete Session',
              message: `Permanently delete ${s.subject} on ${fmtDate(s.scheduled_date)} at ${fmtTime12(s.start_time)}? This action cannot be undone.`,
              confirmLabel: 'Delete Permanently',
              variant: 'danger',
            });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}?permanent=true`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) { toast.success('Session permanently deleted'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleStart = async (s: Session) => {
            const ok = await confirm({ title: 'Start Session', message: `Start ${s.subject} now?`, confirmLabel: 'Start', variant: 'info' });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}/start`, { method: 'POST' });
              const data = await res.json();
              if (data.success) { toast.success('Session started!'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          const handleSingleEnd = async (s: Session) => {
            const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End', variant: 'warning' });
            if (!ok) return;
            try {
              const res = await fetch(`/api/v1/batch-sessions/${s.session_id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
              });
              const data = await res.json();
              if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
            } catch { toast.error('Network error'); }
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-600" /> Sessions
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {scheduledCount > 0 && <span className="text-teal-600 font-medium">{scheduledCount} upcoming</span>}
                    {scheduledCount > 0 && liveCount > 0 && <span> · </span>}
                    {liveCount > 0 && <span className="text-green-600 font-medium">{liveCount} live</span>}
                    {scheduledCount === 0 && liveCount === 0 && 'No active sessions'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSessions.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">{selectedSessions.size} selected</span>
                      {selectedScheduledCount > 0 && (
                        <Button icon={XCircle} size="xs" variant="outline" onClick={handleBulkCancel} loading={bulkCancelling}>
                          Cancel {selectedScheduledCount}
                        </Button>
                      )}
                      {selectedDeletableCount > 0 && (
                        <Button icon={Trash2} size="xs" variant="danger" onClick={handleBulkDelete} loading={bulkDeleting}>
                          Delete {selectedDeletableCount}
                        </Button>
                      )}
                      <button onClick={() => setSelectedSessions(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    </div>
                  )}
                  {batch.status === 'active' && (
                    <Button icon={PlusCircle} onClick={() => setShowSchedule(true)} size="sm" variant="primary">
                      Schedule Session
                    </Button>
                  )}
                </div>
              </div>

              {sortedSessions.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-7 w-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No sessions scheduled yet</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Schedule the first session for this batch</p>
                  {batch.status === 'active' && (
                    <Button icon={PlusCircle} onClick={() => setShowSchedule(true)} size="sm" variant="primary">
                      Schedule First Session
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {groupSessionsBySubject(sortedSessions).map(group => {
                    const groupIds = group.sessions.map(s => s.session_id);
                    const allGroupSelected = groupIds.every(id => selectedSessions.has(id));
                    const someGroupSelected = groupIds.some(id => selectedSessions.has(id));
                    const scheduledInGroup = group.sessions.filter(s => s.status === 'scheduled').length;

                    const toggleGroupSelect = () => {
                      setSelectedSessions(prev => {
                        const next = new Set(prev);
                        if (allGroupSelected) groupIds.forEach(id => next.delete(id));
                        else groupIds.forEach(id => next.add(id));
                        return next;
                      });
                    };

                    return (
                      <div key={group.subject} className={`rounded-xl border ${group.color.border} overflow-hidden`}>
                        {/* Subject Group Header */}
                        <div className={`${group.color.bg} px-4 py-2.5 flex items-center justify-between cursor-pointer select-none`} onClick={() => toggleSubjectExpand(group.subject)}>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={allGroupSelected} ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                              onChange={(e) => { e.stopPropagation(); toggleGroupSelect(); }} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                            {expandedSubjects.has(group.subject) ? <ChevronDown className={`h-4 w-4 ${group.color.text}`} /> : <ChevronRight className={`h-4 w-4 ${group.color.text}`} />}
                            <div className={`w-2 h-2 rounded-full ${group.color.dot}`} />
                            <span className={`text-sm font-bold ${group.color.text}`}>{group.subject}</span>
                            <span className="text-xs text-gray-400 font-medium">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {scheduledInGroup > 0 && <span className="text-teal-600 font-medium">{scheduledInGroup} upcoming</span>}
                            {group.sessions.some(s => s.status === 'live') && <span className="text-green-600 font-medium flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse" />Live</span>}
                          </div>
                        </div>
                        {/* Table — collapsed by default */}
                        {expandedSubjects.has(group.subject) && (
                        <TableWrapper footer={<span>{group.sessions.length} {group.subject} session{group.sessions.length !== 1 ? 's' : ''}</span>}>
                          <THead>
                            <TH><span className="sr-only">Select</span></TH>
                            <TH>Date</TH>
                            <TH>Time</TH>
                            <TH>Duration</TH>
                            <TH>Teacher</TH>
                            <TH>Status</TH>
                            <TH>Actions</TH>
                          </THead>
                          <tbody>
                            {group.sessions.map(s => {
                              const isSel = selectedSessions.has(s.session_id);
                              const isSessionToday = isToday(s.scheduled_date);
                              return (
                                <TRow key={s.session_id} selected={isSel}>
                                  <td className="px-3 py-3 w-8">
                                    <input type="checkbox" checked={isSel} onChange={() => toggleSessionSelect(s.session_id)}
                                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-gray-700">{fmtDate(s.scheduled_date)}</div>
                                    {isSessionToday && s.status === 'scheduled' && (
                                      <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">TODAY</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{fmtTime12(s.start_time)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {s.duration_minutes}m
                                    <span className="text-xs text-gray-400 ml-1">({s.teaching_minutes}+{s.prep_buffer_minutes})</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {s.teacher_name ? (
                                      <div className="flex items-center gap-2">
                                        <Avatar name={s.teacher_name} size="sm" />
                                        <span className="text-sm text-gray-700">{s.teacher_name}</span>
                                      </div>
                                    ) : <span className="text-xs text-gray-400">—</span>}
                                  </td>
                                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      {s.status === 'scheduled' && (
                                        <>
                                          <button onClick={() => handleSingleStart(s)} title="Start" className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors">
                                            <PlayCircle className="h-4 w-4" />
                                          </button>
                                          <button onClick={() => setEditSession(s)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <button onClick={() => handleSingleCancel(s)} title="Cancel" className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                                            <XCircle className="h-4 w-4" />
                                          </button>
                                          <button onClick={() => handleSingleDelete(s)} title="Delete permanently" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </>
                                      )}
                                      {s.status === 'live' && (
                                        <>
                                          <button onClick={() => window.open(`/classroom/${s.session_id}?mode=observe`, '_blank')} title="Observe" className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                            <Eye className="h-4 w-4" />
                                          </button>
                                          <button onClick={() => handleSingleEnd(s)} title="End" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <StopCircle className="h-4 w-4" />
                                          </button>
                                        </>
                                      )}
                                      {(s.status === 'cancelled' || s.status === 'ended') && (
                                        <button onClick={() => handleSingleDelete(s)} title="Delete permanently" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </TRow>
                              );
                            })}
                          </tbody>
                        </TableWrapper>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-center text-xs text-gray-400 py-1">
                    {sortedSessions.length} total session{sortedSessions.length !== 1 ? 's' : ''} across {groupSessionsBySubject(sortedSessions).length} subject{groupSessionsBySubject(sortedSessions).length !== 1 ? 's' : ''}
                    {selectedSessions.size > 0 && ` · ${selectedSessions.size} selected`}
                  </div>
                </div>
              )}

              {/* Edit Session Modal */}
              {editSession && (
                <EditSessionModal
                  session={editSession}
                  batch={batch}
                  onClose={() => setEditSession(null)}
                  onSaved={() => { setEditSession(null); onRefresh(); }}
                />
              )}
            </div>
          );
        })()}
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <ScheduleSessionModal
          batch={batch}
          onClose={() => setShowSchedule(false)}
          onCreated={() => { setShowSchedule(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Session Card ───────────────────────────────────────────
function SessionCard({ session, batch, onRefresh }: {
  session: Session;
  batch: Batch;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinLinks, setJoinLinks] = useState<JoinLink[] | null>(null);
  const [ending, setEnding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const isSessionToday = isToday(session.scheduled_date);

  const handleStart = async () => {
    const ok = await confirm({
      title: 'Start Session',
      message: `Start the ${session.subject} session now? This will create the LiveKit room and generate join links for all participants.`,
      confirmLabel: 'Start Session',
      variant: 'info',
    });
    if (!ok) return;

    setStarting(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setJoinLinks(data.data?.participants || []);
        toast.success('Session started — join links generated!');
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to start session');
      }
    } catch { toast.error('Network error'); }
    finally { setStarting(false); }
  };

  const handleEnd = async () => {
    const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End Session', variant: 'warning' });
    if (!ok) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setEnding(false); }
  };

  const handleCancel = async () => {
    const ok = await confirm({ title: 'Cancel Session', message: 'Cancel this scheduled session? This cannot be undone.', confirmLabel: 'Cancel Session', variant: 'danger' });
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session cancelled'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setCancelling(false); }
  };

  const handleViewLinks = async () => {
    if (joinLinks) { setExpanded(!expanded); return; }
    setStarting(true);
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { setJoinLinks(data.data?.participants || []); setExpanded(true); }
      else toast.error(data.error || 'Failed to get links');
    } catch { toast.error('Network error'); }
    finally { setStarting(false); }
  };

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success('Link copied!'); };

  const statusColor: Record<string, string> = { scheduled: 'border-teal-200 bg-teal-50/50', live: 'border-green-300 bg-green-50/50', ended: 'border-gray-200 bg-gray-50/50', cancelled: 'border-red-200 bg-red-50/50' };
  const statusIcon: Record<string, React.ReactNode> = { scheduled: <Clock className="h-5 w-5 text-teal-600" />, live: <Radio className="h-5 w-5 text-green-600 animate-pulse" />, ended: <CheckCircle2 className="h-5 w-5 text-gray-400" />, cancelled: <XCircle className="h-5 w-5 text-red-400" /> };

  return (
    <div className={`rounded-xl border ${statusColor[session.status] || 'border-gray-200'} overflow-hidden`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-100">
          {statusIcon[session.status]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{session.subject}</span>
            <StatusBadge status={session.status} />
            {isSessionToday && session.status === 'scheduled' && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">TODAY</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(session.scheduled_date)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime12(session.start_time)}</span>
            <span>{session.duration_minutes}m ({session.teaching_minutes}m + {session.prep_buffer_minutes}m prep)</span>
            {session.teacher_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.teacher_name}</span>}
          </div>
          {session.topic && <p className="text-xs text-gray-400 mt-0.5">Topic: {session.topic}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {session.status === 'scheduled' && (
            <>
              <Button icon={PlayCircle} onClick={handleStart} loading={starting} size="xs" variant="primary">Start</Button>
              <Button icon={XCircle} onClick={handleCancel} loading={cancelling} size="xs" variant="danger">Cancel</Button>
            </>
          )}
          {session.status === 'live' && (
            <>
              <Button icon={Link2} onClick={handleViewLinks} loading={starting} size="xs" variant="outline">Links</Button>
              <Button icon={Eye} onClick={() => window.open(`/classroom/${session.session_id}?mode=observe`, '_blank')} size="xs" variant="outline">Observe</Button>
              <Button icon={StopCircle} onClick={handleEnd} loading={ending} size="xs" variant="danger">End</Button>
            </>
          )}
        </div>
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4 space-y-3">
          {joinLinks && joinLinks.length > 0 ? (
            <>
              <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-emerald-600" /> Join Links ({joinLinks.length} participants)
              </h5>
              <div className="space-y-2 max-h-75 overflow-auto">
                {joinLinks.map(link => (
                  <div key={link.email} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
                    <Avatar name={link.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{link.name}</span>
                        <Badge label={link.role} variant={
                          link.role === 'teacher' ? 'info' : link.role === 'student' ? 'primary' : link.role === 'parent' ? 'success' : 'default'
                        } />
                      </div>
                      <p className="text-xs text-gray-400 truncate">{link.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => copyLink(link.join_url)} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="Copy join link">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a href={link.join_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="Open join link">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : session.status === 'scheduled' ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">Start the session to generate join links for all participants</p>
              <p className="text-xs text-gray-300 mt-1">
                Links will be auto-generated for: teacher, {batch.student_count} student{batch.student_count !== 1 ? 's' : ''},
                parents, coordinator{batch.coordinator_name ? ` (${batch.coordinator_name})` : ''}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">{session.status === 'ended' ? 'Session has ended' : 'Session was cancelled'}</p>
              {session.cancel_reason && <p className="text-xs text-gray-300 mt-1">Reason: {session.cancel_reason}</p>}
            </div>
          )}
          {session.notes && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{session.notes}</p>
            </div>
          )}
          {session.livekit_room_name && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-1">LiveKit Room</p>
              <p className="text-sm font-mono text-gray-600">{session.livekit_room_name}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sessions Tab (All Sessions) ────────────────────────────
function SessionsTab({ sessions, batches, loading, onRefresh }: {
  sessions: Session[];
  batches: Batch[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleBatch, setScheduleBatch] = useState<Batch | null>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  const toast = useToast();
  const { confirm } = useConfirm();

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject); else next.add(subject);
      return next;
    });
  };

  if (loading) return <LoadingState />;

  let filtered = sessions
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .filter(s => !search ||
      s.subject.toLowerCase().includes(search.toLowerCase()) ||
      (s.teacher_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.batch_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.topic || '').toLowerCase().includes(search.toLowerCase())
    );

  if (dateFilter === 'today') filtered = filtered.filter(s => isToday(s.scheduled_date));
  else if (dateFilter === 'upcoming') filtered = filtered.filter(s => s.scheduled_date >= todayISO() && s.status === 'scheduled');
  else if (dateFilter === 'past') filtered = filtered.filter(s => s.scheduled_date < todayISO() || s.status === 'ended');

  filtered.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    const dateComp = b.scheduled_date.localeCompare(a.scheduled_date);
    if (dateComp !== 0) return dateComp;
    return b.start_time.localeCompare(a.start_time);
  });

  const activeBatches = batches.filter(b => b.status === 'active');

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.session_id)));
    }
  };

  const selectableIds = new Set(filtered.filter(s => s.status === 'scheduled').map(s => s.session_id));
  const selectedScheduled = [...selected].filter(id => selectableIds.has(id));
  const deletableIds = new Set(filtered.filter(s => s.status !== 'live').map(s => s.session_id));
  const selectedDeletable = [...selected].filter(id => deletableIds.has(id));

  // Bulk cancel (soft — marks as cancelled)
  const handleBulkCancel = async () => {
    if (selectedScheduled.length === 0) {
      toast.error('No scheduled sessions selected to cancel');
      return;
    }
    const ok = await confirm({
      title: 'Cancel Selected Sessions',
      message: `Cancel ${selectedScheduled.length} scheduled session${selectedScheduled.length > 1 ? 's' : ''}? They will remain visible as "Cancelled".`,
      confirmLabel: `Cancel ${selectedScheduled.length} Session${selectedScheduled.length > 1 ? 's' : ''}`,
      variant: 'danger',
    });
    if (!ok) return;

    setBulkCancelling(true);
    try {
      const res = await fetch('/api/v1/batch-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: selectedScheduled, reason: 'Bulk cancelled by operator' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.data?.cancelled} sessions cancelled`);
        setSelected(new Set());
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to cancel sessions');
      }
    } catch { toast.error('Network error'); }
    finally { setBulkCancelling(false); }
  };

  // Bulk permanent delete (removes from DB)
  const handleBulkDelete = async () => {
    if (selectedDeletable.length === 0) {
      toast.error('No sessions selected to delete (live sessions cannot be deleted)');
      return;
    }
    const ok = await confirm({
      title: 'Permanently Delete Sessions',
      message: `Permanently delete ${selectedDeletable.length} session${selectedDeletable.length > 1 ? 's' : ''}? This action cannot be undone. Live sessions will be skipped.`,
      confirmLabel: `Delete ${selectedDeletable.length} Session${selectedDeletable.length > 1 ? 's' : ''}`,
      variant: 'danger',
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/v1/batch-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: selectedDeletable, permanent: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.data?.deleted} sessions deleted`);
        setSelected(new Set());
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to delete sessions');
      }
    } catch { toast.error('Network error'); }
    finally { setBulkDeleting(false); }
  };

  // Individual cancel
  const handleCancel = async (session: Session) => {
    const ok = await confirm({
      title: 'Cancel Session',
      message: `Cancel the ${session.subject} session on ${fmtDate(session.scheduled_date)} at ${fmtTime12(session.start_time)}? It will remain visible as "Cancelled".`,
      confirmLabel: 'Cancel Session',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session cancelled'); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  // Individual permanent delete
  const handleDelete = async (session: Session) => {
    const ok = await confirm({
      title: 'Permanently Delete Session',
      message: `Permanently delete the ${session.subject} session on ${fmtDate(session.scheduled_date)} at ${fmtTime12(session.start_time)}? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}?permanent=true`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('Session permanently deleted'); onRefresh(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  // Individual start
  const handleStart = async (session: Session) => {
    const ok = await confirm({
      title: 'Start Session',
      message: `Start the ${session.subject} session now?`,
      confirmLabel: 'Start Session',
      variant: 'info',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast.success('Session started!'); onRefresh(); }
      else toast.error(data.error || 'Failed to start');
    } catch { toast.error('Network error'); }
  };

  // Individual end
  const handleEnd = async (session: Session) => {
    const ok = await confirm({ title: 'End Session', message: 'End this session now?', confirmLabel: 'End Session', variant: 'warning' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Session ended'); onRefresh(); } else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sessions..." />
          <FilterSelect value={statusFilter} onChange={setStatusFilter}
            options={[{ value: 'all', label: 'All Status' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'live', label: 'Live' }, { value: 'ended', label: 'Ended' }, { value: 'cancelled', label: 'Cancelled' }]}
          />
          <FilterSelect value={dateFilter} onChange={setDateFilter}
            options={[{ value: 'all', label: 'All Dates' }, { value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-medium text-gray-500">{selected.size} selected</span>
              {selectedScheduled.length > 0 && (
                <Button icon={XCircle} size="xs" variant="outline" onClick={handleBulkCancel} loading={bulkCancelling}>
                  Cancel {selectedScheduled.length}
                </Button>
              )}
              {selectedDeletable.length > 0 && (
                <Button icon={Trash2} size="xs" variant="danger" onClick={handleBulkDelete} loading={bulkDeleting}>
                  Delete {selectedDeletable.length}
                </Button>
              )}
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear</button>
            </div>
          )}
          {activeBatches.length > 0 && (
            <Button icon={PlusCircle} onClick={() => setShowSchedule(true)} size="sm">
              Schedule Session
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="No sessions found" />
      ) : (
        <div className="space-y-4">
          {groupSessionsBySubject(filtered).map(group => {
            const groupIds = group.sessions.map(s => s.session_id);
            const allGroupSelected = groupIds.every(id => selected.has(id));
            const someGroupSelected = groupIds.some(id => selected.has(id));
            const scheduledInGroup = group.sessions.filter(s => s.status === 'scheduled').length;

            const toggleGroupSelect = () => {
              setSelected(prev => {
                const next = new Set(prev);
                if (allGroupSelected) groupIds.forEach(id => next.delete(id));
                else groupIds.forEach(id => next.add(id));
                return next;
              });
            };

            return (
              <div key={group.subject} className={`rounded-xl border ${group.color.border} overflow-hidden`}>
                {/* Subject Group Header */}
                <div className={`${group.color.bg} px-4 py-2.5 flex items-center justify-between cursor-pointer select-none`} onClick={() => toggleSubjectExpand(group.subject)}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={allGroupSelected} ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                      onChange={(e) => { e.stopPropagation(); toggleGroupSelect(); }} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    {expandedSubjects.has(group.subject) ? <ChevronDown className={`h-4 w-4 ${group.color.text}`} /> : <ChevronRight className={`h-4 w-4 ${group.color.text}`} />}
                    <div className={`w-2 h-2 rounded-full ${group.color.dot}`} />
                    <span className={`text-sm font-bold ${group.color.text}`}>{group.subject}</span>
                    <span className="text-xs text-gray-400 font-medium">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {scheduledInGroup > 0 && <span className="text-teal-600 font-medium">{scheduledInGroup} upcoming</span>}
                    {group.sessions.some(s => s.status === 'live') && <span className="text-green-600 font-medium flex items-center gap-1"><Radio className="h-3 w-3 animate-pulse" />Live</span>}
                  </div>
                </div>
                {/* Table — collapsed by default */}
                {expandedSubjects.has(group.subject) && (
                <TableWrapper footer={<span>{group.sessions.length} {group.subject} session{group.sessions.length !== 1 ? 's' : ''}</span>}>
                  <THead>
                    <TH><span className="sr-only">Select</span></TH>
                    <TH>Batch</TH>
                    <TH>Date</TH>
                    <TH>Time</TH>
                    <TH>Duration</TH>
                    <TH>Teacher</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </THead>
                  <tbody>
                    {group.sessions.map(s => {
                      const isSelected = selected.has(s.session_id);
                      const isSessionToday = isToday(s.scheduled_date);
                      return (
                        <TRow key={s.session_id} selected={isSelected}>
                          <td className="px-3 py-3 w-8">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(s.session_id)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700">{s.batch_name || s.batch_id}</div>
                            {s.grade && <div className="text-xs text-gray-400">{s.grade}{s.section ? ` - ${s.section}` : ''}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700">{fmtDate(s.scheduled_date)}</div>
                            {isSessionToday && s.status === 'scheduled' && (
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">TODAY</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{fmtTime12(s.start_time)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {s.duration_minutes}m
                            <span className="text-xs text-gray-400 ml-1">({s.teaching_minutes}+{s.prep_buffer_minutes})</span>
                          </td>
                          <td className="px-4 py-3">
                            {s.teacher_name ? (
                              <div className="flex items-center gap-2">
                                <Avatar name={s.teacher_name} size="sm" />
                                <span className="text-sm text-gray-700">{s.teacher_name}</span>
                              </div>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {s.status === 'scheduled' && (
                                <>
                                  <button onClick={() => handleStart(s)} title="Start" className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors">
                                    <PlayCircle className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setEditSession(s)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleCancel(s)} title="Cancel" className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleDelete(s)} title="Delete permanently" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {s.status === 'live' && (
                                <>
                                  <button onClick={() => window.open(`/classroom/${s.session_id}?mode=observe`, '_blank')} title="Observe" className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleEnd(s)} title="End" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                    <StopCircle className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {(s.status === 'cancelled' || s.status === 'ended') && (
                                <button onClick={() => handleDelete(s)} title="Delete permanently" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </TRow>
                      );
                    })}
                  </tbody>
                </TableWrapper>
                )}
              </div>
            );
          })}
          <div className="text-center text-xs text-gray-400 py-1">
            {filtered.length} total session{filtered.length !== 1 ? 's' : ''} across {groupSessionsBySubject(filtered).length} subject{groupSessionsBySubject(filtered).length !== 1 ? 's' : ''}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          batch={batches.find(b => b.batch_id === editSession.batch_id) || null}
          onClose={() => setEditSession(null)}
          onSaved={() => { setEditSession(null); onRefresh(); }}
        />
      )}

      {showSchedule && (
        <ScheduleSessionModal
          batches={batches}
          onClose={() => { setShowSchedule(false); setScheduleBatch(null); }}
          onCreated={() => { setShowSchedule(false); setScheduleBatch(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Edit Session Modal ─────────────────────────────────────
function EditSessionModal({ session, batch, onClose, onSaved }: {
  session: Session;
  batch: Batch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [allTeachers, setAllTeachers] = useState<Person[]>([]);
  useEffect(() => {
    fetch('/api/v1/batches/people?role=teacher').then(r => r.json()).then(d => {
      if (d.success) setAllTeachers(d.data?.people || []);
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    subject: session.subject,
    teacher_email: session.teacher_email || '',
    teacher_name: session.teacher_name || '',
    scheduled_date: session.scheduled_date.slice(0, 10),
    start_time: session.start_time.slice(0, 5),
    duration_minutes: session.duration_minutes,
    teaching_minutes: session.teaching_minutes,
    prep_buffer_minutes: session.prep_buffer_minutes,
    topic: session.topic || '',
    notes: session.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const durations = [30, 45, 60, 75, 90, 120];

  // Auto-calculate teaching + prep from duration
  useEffect(() => {
    const teaching = Math.max(form.duration_minutes - 15, Math.floor(form.duration_minutes * 0.83));
    const prep = form.duration_minutes - teaching;
    setForm(p => ({ ...p, teaching_minutes: teaching, prep_buffer_minutes: prep }));
  }, [form.duration_minutes]);

  const f = (key: string, val: string | number) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.subject || !form.scheduled_date || !form.start_time) {
      setError('Subject, date, and time are required');
      return;
    }
    // Reject sessions in the past (IST)
    const sessionDateTimeIST = new Date(`${form.scheduled_date}T${form.start_time}+05:30`);
    if (sessionDateTimeIST < new Date()) {
      setError('Session date and time cannot be in the past (Indian Standard Time).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/batch-sessions/${session.session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          teacher_email: form.teacher_email || null,
          teacher_name: form.teacher_name || null,
          scheduled_date: form.scheduled_date,
          start_time: form.start_time,
          duration_minutes: form.duration_minutes,
          teaching_minutes: form.teaching_minutes,
          prep_buffer_minutes: form.prep_buffer_minutes,
          topic: form.topic || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Session updated');
        onSaved();
      } else {
        setError(data.error || 'Failed to update session');
      }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const subjects = batch?.subjects || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b bg-linear-to-r from-emerald-600 to-teal-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Session</h2>
            <p className="text-emerald-200 text-xs mt-0.5">{session.subject} — {fmtDate(session.scheduled_date)}</p>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white transition"><X className="h-5 w-5" /></button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

          <FormGrid cols={2}>
            <FormField label="Subject" required>
              {subjects.length > 0 ? (
                <Select value={form.subject} onChange={(v) => f('subject', v)}
                  options={subjects.map(s => ({ value: s, label: s }))} />
              ) : (
                <Input value={form.subject} onChange={(e) => f('subject', e.target.value)} />
              )}
            </FormField>
            <FormField label="Teacher">
              <Select
                value={form.teacher_email}
                onChange={(v) => {
                  const t = allTeachers.find(t => t.email === v);
                  setForm(p => ({ ...p, teacher_email: v, teacher_name: t?.full_name || '' }));
                }}
                options={[
                  { value: '', label: 'Select Teacher...' },
                  ...allTeachers.map(t => ({ value: t.email, label: t.full_name })),
                ]}
              />
            </FormField>
          </FormGrid>

          <FormGrid cols={2}>
            <FormField label="Date" required>
              <Input type="date" value={form.scheduled_date} min={todayISO()} onChange={(e) => f('scheduled_date', e.target.value)} />
            </FormField>
            <FormField label="Start Time" required>
              <TimePicker12 value={form.start_time} onChange={(v) => f('start_time', v)} />
            </FormField>
          </FormGrid>

          <FormField label="Duration" required>
            <div className="grid grid-cols-3 gap-2 mt-1 sm:grid-cols-6">
              {durations.map(d => (
                <button key={d} type="button" onClick={() => f('duration_minutes', d)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    form.duration_minutes === d
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </FormField>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Teaching</p>
                <p className="text-sm font-bold text-gray-900">{form.teaching_minutes}m</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Prep Buffer</p>
                <p className="text-sm font-bold text-gray-900">{form.prep_buffer_minutes}m</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-bold text-emerald-600">{form.duration_minutes}m</p>
              </div>
            </div>
          </div>

          <FormField label="Topic">
            <Input value={form.topic} onChange={(e) => f('topic', e.target.value)} placeholder="e.g. Quadratic Equations" />
          </FormField>

          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any special instructions..." rows={3} />
          </FormField>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/80 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 12-hour Time Picker ────────────────────────────────────
function TimePicker12({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [h24, min] = (value || '09:00').split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  const update = (newH12: number, newMin: number, newPeriod: string) => {
    let h = newH12;
    if (newPeriod === 'AM') { if (h === 12) h = 0; }
    else { if (h !== 12) h += 12; }
    onChange(`${String(h).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`);
  };

  const sel = 'rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-50';

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <select value={h12} disabled={disabled} onChange={(e) => update(Number(e.target.value), min, period)} className={sel}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-gray-400 font-medium">:</span>
      <select value={min} disabled={disabled} onChange={(e) => update(h12, Number(e.target.value), period)} className={sel}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
      </select>
      <select value={period} disabled={disabled} onChange={(e) => update(h12, min, e.target.value)} className={`${sel} font-medium`}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

// ─── Schedule Session Wizard ────────────────────────────────
type ScheduleStep = 'batch' | 'class' | 'schedule' | 'details' | 'review';

const SCHEDULE_STEPS_WITH_BATCH: { key: ScheduleStep; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'batch', label: 'Select Batch', desc: 'Choose a batch', icon: Layers },
  { key: 'class', label: 'Session Details', desc: 'Subject & teacher', icon: BookOpen },
  { key: 'schedule', label: 'Schedule', desc: 'Date, time & days', icon: Calendar },
  { key: 'details', label: 'Details', desc: 'Topic & notes', icon: FileText },
  { key: 'review', label: 'Review', desc: 'Confirm & schedule', icon: CheckCircle2 },
];

const SCHEDULE_STEPS_NO_BATCH: { key: ScheduleStep; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'class', label: 'Session Details', desc: 'Subject & teacher', icon: BookOpen },
  { key: 'schedule', label: 'Schedule', desc: 'Date, time & days', icon: Calendar },
  { key: 'details', label: 'Details', desc: 'Topic & notes', icon: FileText },
  { key: 'review', label: 'Review', desc: 'Confirm & schedule', icon: CheckCircle2 },
];

function ScheduleSessionModal({ batch: initialBatch, batches: availableBatches, onClose, onCreated }: {
  batch?: Batch | null;
  batches?: Batch[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const needsBatchSelect = !initialBatch;
  const SCHEDULE_STEPS = needsBatchSelect ? SCHEDULE_STEPS_WITH_BATCH : SCHEDULE_STEPS_NO_BATCH;

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(initialBatch || null);
  const batch = selectedBatch!; // used after batch step is done

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = SCHEDULE_STEPS[stepIdx].key;

  // Fetch all teachers for teacher override
  const [allTeachers, setAllTeachers] = useState<Person[]>([]);
  useEffect(() => {
    fetch('/api/v1/batches/people?role=teacher').then(r => r.json()).then(d => {
      if (d.success) setAllTeachers(d.data?.people || []);
    }).catch(() => {});
  }, []);

  // Fetch existing sessions for this batch (for time conflict detection)
  const [existingSessions, setExistingSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (!selectedBatch) return;
    fetch(`/api/v1/batch-sessions?batch_id=${selectedBatch.batch_id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setExistingSessions(d.data?.sessions || []); })
      .catch(() => {});
  }, [selectedBatch]);

  // Time adjustment message
  const [timeAdjusted, setTimeAdjusted] = useState('');

  const [form, setForm] = useState({
    subject: initialBatch?.subjects?.[0] || '',
    teacher_email: '',
    teacher_name: '',
    override_teacher: false,
    scheduled_date: todayISO(),
    start_time: '09:00',
    duration_minutes: 90,
    teaching_minutes: 75,
    prep_buffer_minutes: 15,
    topic: '',
    notes: '',
    // Recurring schedule
    recurring: false,
    class_days: [] as string[],
    recurring_unit: 'months' as 'weeks' | 'months',
    recurring_count: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const durations = [30, 45, 60, 75, 90, 120];

  // Auto-select teacher when subject changes (unless overridden)
  useEffect(() => {
    if (form.override_teacher || !selectedBatch) return;
    const subjectTeacher = selectedBatch.teachers.find(t => t.subject === form.subject);
    if (subjectTeacher) {
      setForm(p => ({ ...p, teacher_email: subjectTeacher.teacher_email, teacher_name: subjectTeacher.teacher_name }));
    } else {
      setForm(p => ({ ...p, teacher_email: '', teacher_name: '' }));
    }
  }, [form.subject, form.override_teacher, selectedBatch]);

  // Auto-calculate teaching + prep from duration
  useEffect(() => {
    const teaching = Math.max(form.duration_minutes - 15, Math.floor(form.duration_minutes * 0.83));
    const prep = form.duration_minutes - teaching;
    setForm(p => ({ ...p, teaching_minutes: teaching, prep_buffer_minutes: prep }));
  }, [form.duration_minutes]);

  // ── Auto-adjust start_time to avoid conflicts with existing sessions ──
  // Converts "HH:MM" to minutes since midnight
  const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const minutesToTime = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  // Find non-conflicting start time for a given date
  const findAvailableTime = useCallback((date: string, preferredTime: string, duration: number): string => {
    // Get all sessions on this date (excluding cancelled)
    const sessionsOnDate = existingSessions
      .filter(s => s.scheduled_date.slice(0, 10) === date && s.status !== 'cancelled')
      .map(s => ({
        start: timeToMinutes(s.start_time),
        end: timeToMinutes(s.start_time) + (s.duration_minutes || 60),
        subject: s.subject,
      }))
      .sort((a, b) => a.start - b.start);

    if (sessionsOnDate.length === 0) return preferredTime;

    const preferredStart = timeToMinutes(preferredTime);
    const preferredEnd = preferredStart + duration;

    // Check if preferred time has no conflict
    const hasConflict = sessionsOnDate.some(s =>
      preferredStart < s.end && preferredEnd > s.start
    );

    if (!hasConflict) return preferredTime;

    // Find next available slot after the latest conflicting session
    // Try after each existing session's end time
    let candidateStart = preferredStart;
    for (const s of sessionsOnDate) {
      if (candidateStart < s.end && (candidateStart + duration) > s.start) {
        // Conflict → move candidate to end of this session
        candidateStart = s.end;
      }
    }

    // Ensure we don't go past 22:00 (10 PM)
    if (candidateStart + duration > 22 * 60) {
      // Try to find a slot before the first session
      const firstSession = sessionsOnDate[0];
      if (firstSession.start >= duration) {
        candidateStart = firstSession.start - duration;
      } else {
        // No room — return the calculated time anyway; user can manually adjust
        candidateStart = sessionsOnDate[sessionsOnDate.length - 1].end;
      }
    }

    return minutesToTime(candidateStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSessions]);

  // When date or subject changes, auto-adjust time to avoid conflicts
  useEffect(() => {
    if (existingSessions.length === 0) return;
    const adjusted = findAvailableTime(form.scheduled_date, form.start_time, form.duration_minutes);
    if (adjusted !== form.start_time) {
      setForm(p => ({ ...p, start_time: adjusted }));
      // Show which sessions caused the adjustment
      const sessionsOnDate = existingSessions
        .filter(s => s.scheduled_date.slice(0, 10) === form.scheduled_date && s.status !== 'cancelled')
        .map(s => `${s.subject} (${fmtTime12(s.start_time)})`)
        .join(', ');
      setTimeAdjusted(`Time adjusted to avoid overlap with: ${sessionsOnDate}`);
      setTimeout(() => setTimeAdjusted(''), 8000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scheduled_date, form.subject, existingSessions]);

  const f = (key: string, val: string | number | boolean | string[]) => setForm(p => ({ ...p, [key]: val }));

  const toggleDay = (day: string) => {
    setForm(p => ({
      ...p,
      class_days: p.class_days.includes(day) ? p.class_days.filter(d => d !== day) : [...p.class_days, day],
    }));
  };

  // Compute recurring dates
  const recurringDates = form.recurring && form.class_days.length > 0
    ? getDatesForDays(form.class_days, form.scheduled_date, form.recurring_count, form.recurring_unit)
    : [];

  const isStepValid = (step: ScheduleStep) => {
    switch (step) {
      case 'batch': return !!selectedBatch;
      case 'class': return !!form.subject;
      case 'schedule': return !!form.scheduled_date && !!form.start_time;
      case 'details': return true;
      case 'review': return true;
      default: return true;
    }
  };

  const canGoNext = () => isStepValid(currentStep);
  const goNext = () => { if (canGoNext() && stepIdx < SCHEDULE_STEPS.length - 1) setStepIdx(stepIdx + 1); };
  const goPrev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const handleSubmit = async () => {
    if (!form.subject) { setError('Subject is required'); return; }
    if (!form.scheduled_date) { setError('Date is required'); return; }
    if (!form.start_time) { setError('Start time is required'); return; }

    // Reject sessions in the past (use IST +05:30 for comparison)
    const sessionDateTimeIST = new Date(`${form.scheduled_date}T${form.start_time}+05:30`);
    if (sessionDateTimeIST < new Date()) {
      setError('Session date and time cannot be in the past (Indian Standard Time). Please select a future time.');
      return;
    }

    setError(''); setSubmitting(true);

    const basePayload = {
      batch_id: batch.batch_id,
      subject: form.subject,
      teacher_email: form.teacher_email || null,
      teacher_name: form.teacher_name || null,
      start_time: form.start_time,
      duration_minutes: form.duration_minutes,
      teaching_minutes: form.teaching_minutes,
      prep_buffer_minutes: form.prep_buffer_minutes,
      topic: form.topic || null,
      notes: form.notes || null,
    };

    try {
      if (form.recurring && recurringDates.length > 0) {
        // Create multiple sessions
        let created = 0;
        let failed = 0;
        for (const rd of recurringDates) {
          try {
            const res = await fetch('/api/v1/batch-sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...basePayload, scheduled_date: rd.date }),
            });
            const data = await res.json();
            if (res.ok && data.success) created++;
            else failed++;
          } catch { failed++; }
        }
        if (created > 0) {
          toast.success(`${created} session${created > 1 ? 's' : ''} scheduled${failed > 0 ? ` (${failed} failed)` : ''}`);
          onCreated();
        } else {
          setError('Failed to create any sessions');
        }
      } else {
        const res = await fetch('/api/v1/batch-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, scheduled_date: form.scheduled_date }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) { setError(data.error || 'Failed to schedule session'); return; }
        toast.success('Session scheduled successfully');
        onCreated();
      }
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  // ── Step renderers ──

  const renderBatchStep = () => {
    const batchList = availableBatches?.filter(b => b.status === 'active') || [];
    return (
      <>
        <h2 className="text-xl font-bold text-gray-900">Select Batch</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Choose which batch to schedule a session for</p>

        {batchList.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">No active batches available</p>
            <p className="text-xs text-gray-400 mt-1">Create a batch first before scheduling sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchList.map(b => {
              const isSelected = selectedBatch?.batch_id === b.batch_id;
              return (
                <button
                  key={b.batch_id}
                  type="button"
                  onClick={() => {
                    setSelectedBatch(b);
                    // Reset form subject to first subject of new batch
                    setForm(p => ({ ...p, subject: b.subjects?.[0] || '', override_teacher: false, teacher_email: '', teacher_name: '' }));
                  }}
                  className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-2 ring-emerald-200'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? 'text-emerald-700' : 'text-gray-900'}`}>{b.batch_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Grade {b.grade}{b.section ? ` - ${b.section}` : ''} · {b.subjects?.join(', ') || 'No subjects'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{b.student_count} student{b.student_count !== 1 ? 's' : ''}</span>
                      <span>{b.teacher_count} teacher{b.teacher_count !== 1 ? 's' : ''}</span>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderClassStep = () => (
    <>
      <h2 className="text-xl font-bold text-gray-900">Session Details</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">Select the subject and teacher for this session</p>

      <FormGrid cols={1}>
        <FormField label="Subject" required>
          <Select
            value={form.subject}
            onChange={(v) => { f('subject', v); f('override_teacher', false); }}
            options={(batch.subjects || []).map(s => ({ value: s, label: s }))}
            placeholder="Select subject"
          />
        </FormField>
      </FormGrid>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Teacher</label>
          <button
            type="button"
            onClick={() => f('override_teacher', !form.override_teacher)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {form.override_teacher ? 'Use batch default' : 'Change teacher'}
          </button>
        </div>

        {form.override_teacher ? (
          <Select
            value={form.teacher_email}
            onChange={(v) => {
              const t = allTeachers.find(t => t.email === v);
              setForm(p => ({ ...p, teacher_email: v, teacher_name: t?.full_name || '' }));
            }}
            options={[
              { value: '', label: 'Select Teacher...' },
              ...allTeachers
                .filter(t => {
                  const tSubjects = t.subjects || [];
                  return tSubjects.length === 0 || tSubjects.some(ts => ts.toLowerCase() === form.subject.toLowerCase());
                })
                .map(t => ({
                  value: t.email,
                  label: `${t.full_name}${t.subjects ? ` (${t.subjects.join(', ')})` : ''}`,
                })),
            ]}
            placeholder="Select teacher"
          />
        ) : (
          <div className="mt-1">
            {form.teacher_name ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <Avatar name={form.teacher_name} size="md" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{form.teacher_name}</p>
                  <p className="text-xs text-gray-500">{form.teacher_email}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No teacher assigned</p>
                  <p className="text-xs text-amber-600">Use &quot;Change teacher&quot; to assign one</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  const renderScheduleStep = () => {
    // Sessions already scheduled on selected date (for conflict display)
    const sessionsOnDate = existingSessions
      .filter(s => s.scheduled_date.slice(0, 10) === form.scheduled_date && s.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Check if current time conflicts
    const currentStart = timeToMinutes(form.start_time);
    const currentEnd = currentStart + form.duration_minutes;
    const conflicting = sessionsOnDate.filter(s => {
      const sStart = timeToMinutes(s.start_time);
      const sEnd = sStart + (s.duration_minutes || 60);
      return currentStart < sEnd && currentEnd > sStart;
    });

    return (
    <>
      <h2 className="text-xl font-bold text-gray-900">Schedule</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">Choose date, time, duration, and optional recurring days</p>

      {/* Existing sessions on this date */}
      {sessionsOnDate.length > 0 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Already scheduled on this date
          </p>
          <div className="space-y-1.5">
            {sessionsOnDate.map(s => {
              const sStart = timeToMinutes(s.start_time);
              const sEnd = sStart + (s.duration_minutes || 60);
              const isConflict = currentStart < sEnd && currentEnd > sStart;
              return (
                <div key={s.session_id} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isConflict ? 'bg-red-100 border border-red-200' : 'bg-white border border-blue-100'}`}>
                  <span className={`font-semibold ${isConflict ? 'text-red-700' : 'text-gray-900'}`}>{s.subject}</span>
                  <span className="text-gray-400">—</span>
                  <span className={isConflict ? 'text-red-600' : 'text-gray-600'}>{fmtTime12(s.start_time)} – {fmtTime12(minutesToTime(sEnd))}</span>
                  <span className="text-gray-400">({s.duration_minutes}m)</span>
                  {s.teacher_name && <span className="text-gray-400 ml-auto">{s.teacher_name}</span>}
                  {isConflict && <span className="text-red-600 font-bold ml-auto">⚠ Overlap</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time adjustment notice */}
      {timeAdjusted && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700">{timeAdjusted}</p>
          <button type="button" onClick={() => setTimeAdjusted('')} className="ml-auto text-emerald-400 hover:text-emerald-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Conflict warning */}
      {conflicting.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-700">Time conflict detected!</p>
            <p className="text-xs text-red-600 mt-0.5">
              Overlaps with: {conflicting.map(s => `${s.subject} (${fmtTime12(s.start_time)}–${fmtTime12(minutesToTime(timeToMinutes(s.start_time) + (s.duration_minutes || 60)))})`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Past-time warning — shown when selected date+time is already in the past (IST) */}
      {form.scheduled_date && form.start_time && new Date(`${form.scheduled_date}T${form.start_time}+05:30`) < new Date() && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            Selected time has already passed (IST). Please choose a future date or time — this session cannot be saved.
          </p>
        </div>
      )}

      <FormGrid cols={2}>
        <FormField label={form.recurring ? 'Start Date' : 'Date'} required>
          <Input type="date" value={form.scheduled_date} min={todayISO()} onChange={(e) => f('scheduled_date', e.target.value)} />
        </FormField>
        <FormField label="Start Time" required>
          <TimePicker12 value={form.start_time} onChange={(v) => f('start_time', v)} />
        </FormField>
      </FormGrid>

      <div className="mt-5">
        <FormField label="Total Duration" required>
          <div className="grid grid-cols-3 gap-2 mt-1 sm:grid-cols-6">
            {durations.map(d => (
              <button key={d} type="button" onClick={() => f('duration_minutes', d)}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  form.duration_minutes === d
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </FormField>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Teaching Time</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{form.teaching_minutes} min</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prep Buffer</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{form.prep_buffer_minutes} min</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">{form.duration_minutes} min</p>
          </div>
        </div>
      </div>

      {/* Recurring Schedule */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-emerald-600" /> Recurring Schedule
          </label>
          <button type="button" onClick={() => f('recurring', !form.recurring)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.recurring ? 'bg-emerald-500' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.recurring ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {form.recurring && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Session Days</label>
              <div className="flex gap-2">
                {DAY_NAMES.map(day => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`w-11 h-11 rounded-xl text-xs font-bold transition-all ${
                      form.class_days.includes(day)
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-emerald-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Duration Unit</label>
              <div className="flex gap-2 mb-3">
                {(['weeks', 'months'] as const).map(u => (
                  <button key={u} type="button" onClick={() => { f('recurring_unit', u); f('recurring_count', 1); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                      form.recurring_unit === u
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-emerald-300'
                    }`}
                  >
                    {u === 'weeks' ? '📅 Weeks' : '🗓️ Months'}
                  </button>
                ))}
              </div>
            </div>

            <FormField label={form.recurring_unit === 'weeks' ? 'Number of Weeks' : 'Number of Months'}>
              <Select
                value={String(form.recurring_count)}
                onChange={(v) => f('recurring_count', Number(v))}
                options={
                  form.recurring_unit === 'weeks'
                    ? [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(w => ({ value: String(w), label: `${w} week${w > 1 ? 's' : ''}` }))
                    : [1, 2, 3, 4, 5, 6, 8, 10, 12].map(m => ({ value: String(m), label: `${m} month${m > 1 ? 's' : ''}` }))
                }
              />
            </FormField>

            {recurringDates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {recurringDates.length} session{recurringDates.length > 1 ? 's' : ''} will be created:
                </p>
                <div className="max-h-32 overflow-auto space-y-1">
                  {recurringDates.map((rd, i) => (
                    <div key={rd.date} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-5 text-right text-gray-400">{i + 1}.</span>
                      <span className="font-medium">{DAY_FULL[rd.day]}</span>
                      <span className="text-gray-400">—</span>
                      <span>{fmtDate(rd.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
    );
  };

  const renderDetailsStep = () => (
    <>
      <h2 className="text-xl font-bold text-gray-900">Session Details</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">Add topic and notes for this session (optional)</p>

      <FormField label="Topic" hint="What will be covered in this session">
        <Input value={form.topic} onChange={(e) => f('topic', e.target.value)} placeholder="e.g. Quadratic Equations, Chapter 5 Review" />
      </FormField>

      <div className="mt-5">
        <FormField label="Notes" hint="Internal notes for this session">
          <Textarea value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any special instructions or reminders..." rows={4} />
        </FormField>
      </div>
    </>
  );

  const renderReviewStep = () => {
    const [h24, m] = (form.start_time || '09:00').split(':').map(Number);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const timeDisplay = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    const totalSessions = form.recurring && recurringDates.length > 0 ? recurringDates.length : 1;

    return (
      <>
        <h2 className="text-xl font-bold text-gray-900">Review &amp; Confirm</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Review all details before scheduling</p>

        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Batch</span>
            <span className="text-sm font-semibold text-gray-900">{batch.batch_name}</span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Subject</span>
            <span className="text-sm font-semibold text-gray-900">{form.subject}</span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Teacher</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{form.teacher_name || 'Not assigned'}</span>
              {form.override_teacher && <Badge label="Changed" variant="warning" />}
            </div>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">{form.recurring ? 'Start Date' : 'Date'}</span>
            <span className="text-sm font-semibold text-gray-900">
              {new Date(form.scheduled_date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Start Time</span>
            <span className="text-sm font-semibold text-gray-900">{timeDisplay}</span>
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">Duration</span>
            <span className="text-sm font-semibold text-gray-900">{form.duration_minutes} min ({form.teaching_minutes} teaching + {form.prep_buffer_minutes} prep)</span>
          </div>
          {form.recurring && (
            <>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Session Days</span>
                <div className="flex gap-1">
                  {form.class_days.map(d => (
                    <span key={d} className="rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">{d}</span>
                  ))}
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Sessions</span>
                <span className="text-sm font-bold text-emerald-600">{totalSessions} sessions over {form.recurring_count} {form.recurring_unit === 'weeks' ? 'week' : 'month'}{form.recurring_count > 1 ? 's' : ''}</span>
              </div>
            </>
          )}
          {form.topic && (
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">Topic</span>
              <span className="text-sm font-semibold text-gray-900">{form.topic}</span>
            </div>
          )}
          {form.notes && (
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">Notes</span>
              <span className="text-sm font-semibold text-gray-900 max-w-xs text-right">{form.notes}</span>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-600" /> Participants (auto-assigned)
          </h5>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { val: form.teacher_name ? 1 : 0, label: 'Teacher' },
              { val: batch.student_count, label: 'Students' },
              { val: batch.coordinator_name ? 1 : 0, label: 'Coordinator' },
              { val: 'Auto', label: 'Parents' },
            ].map(p => (
              <div key={p.label} className="rounded-xl bg-white border border-gray-100 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-gray-900">{p.val}</p>
                <p className="text-xs text-gray-400">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2.5">LiveKit room &amp; join links are auto-generated when you start the session</p>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-700">
            <Zap className="h-4 w-4 inline-block mr-1.5 align-text-bottom" />
            {totalSessions > 1
              ? `${totalSessions} sessions will be created. Start each from the Sessions tab to generate LiveKit rooms.`
              : 'Once scheduled, start the session from the Sessions tab to generate LiveKit room & join links.'}
          </p>
        </div>
      </>
    );
  };

  // ── Full-screen step-by-step overlay ──
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Left sidebar */}
        <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <Video className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Schedule Session</h2>
            <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {SCHEDULE_STEPS.length}</p>
          </div>
          <div className="space-y-1 flex-1">
            {SCHEDULE_STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button key={step.key} type="button" onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
                  className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all text-left ${
                    isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-emerald-200 hover:bg-white/10 cursor-pointer' : 'text-emerald-400/50 cursor-default'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-400 text-emerald-900' : isCurrent ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-emerald-300/70'
                  }`}>
                    {isDone ? '✓' : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium block">{step.label}</span>
                    <span className="text-[10px] opacity-70">{step.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
            <X className="h-3.5 w-3.5" /> Cancel &amp; Close
          </button>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
            {currentStep === 'batch' && renderBatchStep()}
            {currentStep === 'class' && renderClassStep()}
            {currentStep === 'schedule' && renderScheduleStep()}
            {currentStep === 'details' && renderDetailsStep()}
            {currentStep === 'review' && renderReviewStep()}
          </div>
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
            <div className="flex items-center gap-3">
              {currentStep !== 'review' ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
              ) : (
                <Button variant="primary" icon={PlusCircle} loading={submitting} disabled={submitting} onClick={handleSubmit} size="lg">
                  {form.recurring && recurringDates.length > 1 ? `Schedule ${recurringDates.length} Sessions` : 'Schedule Session'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Batch Wizard (same design as owner's) ───────────
type WizardStep = 'template' | 'students' | 'details' | 'teachers' | 'review';

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'students', label: 'Students' },
  { key: 'details', label: 'Details' },
  { key: 'teachers', label: 'Subjects & Teachers' },
  { key: 'review', label: 'Review' },
];

function CreateBatchWizard({ batches, userRole, userEmail, onClose, onCreated }: {
  batches: Batch[];
  userRole: string;
  userEmail: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('template');
  const [creating, setCreating] = useState(false);

  // Academic settings
  const [SUBJECTS, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [GRADES] = useState<string[]>(DEFAULT_GRADES);
  const [SECTIONS] = useState<string[]>(DEFAULT_SECTIONS);
  const [BOARDS] = useState<string[]>(DEFAULT_BOARDS);

  // Wizard form
  const [formType, setFormType] = useState<BatchType | ''>('');
  const [formName, setFormName] = useState('');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formGrade, setFormGrade] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formBoard, setFormBoard] = useState('');
  const [formCoordinator, setFormCoordinator] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [academicOperators, setAcademicOperators] = useState<Person[]>([]);
  const [formAO, setFormAO] = useState(userRole === 'academic_operator' ? userEmail : '');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserRole, setCreateUserRole] = useState('parent');
  const [parentForStudent, setParentForStudent] = useState('');

  const toast = useToast();

  // Fetch settings + people on mount
  useEffect(() => {
    fetch('/api/v1/academics/settings').then(r => r.json()).then(d => {
      if (d.success && d.data?.subjects?.length) setSubjects(d.data.subjects);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const loadPeople = async () => {
      setPeopleLoading(true);
      try {
        const fetches: Promise<Response>[] = [
          fetch('/api/v1/batches/people?role=student'),
          fetch('/api/v1/batches/people?role=teacher'),
          fetch('/api/v1/hr/users?role=batch_coordinator&limit=500'),
        ];
        if (userRole === 'owner') fetches.push(fetch('/api/v1/hr/users?role=academic_operator&limit=500'));
        const responses = await Promise.all(fetches.map(f => f.then(r => r.json())));
        const [studRes, teachRes, coordRes] = responses;
        if (studRes.success) setStudents(studRes.data.people);
        if (teachRes.success) setTeachers(teachRes.data.people);
        if (coordRes.success) setCoordinators(coordRes.data.users);
        if (userRole === 'owner' && responses[3]?.success) setAcademicOperators(responses[3].data.users);
      } catch { /* ignore */ }
      setPeopleLoading(false);
    };
    loadPeople();
  }, []);

  const stepIdx = WIZARD_STEPS.findIndex(s => s.key === wizardStep);

  // Helpers
  const getUsedSections = (grade: string): string[] => batches.filter(b => b.grade === grade && b.section).map(b => b.section as string);
  const getNextSection = (grade: string): string => { const used = getUsedSections(grade); return SECTIONS.find(s => !used.includes(s)) || ''; };
  const autoName = (grade: string, section: string) => { if (grade && section) return `Class ${grade} ${section}`; if (grade) return `Class ${grade}`; return ''; };

  const handleGradeChange = (g: string) => {
    setFormGrade(g);
    const nextSection = g ? getNextSection(g) : '';
    setFormSection(nextSection);
    setFormName(autoName(g, nextSection));
  };

  const getMaxForType = (type: BatchType | ''): number => {
    if (!type) return 0;
    if (type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromTemplate = formType !== '';
  const canProceedFromDetails = formName.trim() !== '' && formGrade !== '';
  const canProceedFromTeachers = formSubjects.length > 0;
  const canSubmit = formType !== '' && formName.trim() !== '' && formGrade !== '';

  // Student selection
  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const isStudentSelected = (email: string) => selectedStudents.some(s => s.email === email);
  const maxReached = selectedStudents.length >= getMaxForType(formType);

  const toggleStudent = (person: Person) => {
    if (isStudentSelected(person.email)) {
      setSelectedStudents(prev => prev.filter(s => s.email !== person.email));
    } else {
      if (maxReached) { toast.error(`Max ${getMaxForType(formType)} students for this batch type.`); return; }
      setSelectedStudents(prev => [...prev, { email: person.email, name: person.full_name, parent_email: person.parent_email || null, parent_name: person.parent_name || null }]);
    }
  };

  const removeStudent = (email: string) => setSelectedStudents(prev => prev.filter(s => s.email !== email));

  const toggleSubject = (subj: string) => {
    setFormSubjects(prev => {
      if (prev.includes(subj)) {
        setSubjectTeachers(st => { const copy = { ...st }; delete copy[subj]; return copy; });
        return prev.filter(s => s !== subj);
      }
      return [...prev, subj];
    });
  };

  // Create parent
  const openCreateParent = (studentEmail: string) => { setParentForStudent(studentEmail); setCreateUserRole('parent'); setShowCreateUser(true); };
  const handleUserCreated = async (data?: { email: string; full_name: string; temp_password: string }) => {
    if (data && parentForStudent) {
      setSelectedStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      setStudents(prev => prev.map(s => s.email === parentForStudent ? { ...s, parent_email: data.email, parent_name: data.full_name } : s));
      try {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(parentForStudent)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_email: data.email }),
        });
      } catch { /* ignore */ }
    }
  };

  // Submit
  const submitBatch = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const body = {
        batch_name: formName.trim(),
        batch_type: formType,
        subjects: formSubjects.length > 0 ? formSubjects : null,
        grade: formGrade || null,
        section: formSection || null,
        board: formBoard || null,
        coordinator_email: formCoordinator || null,
        academic_operator_email: formAO || null,
        max_students: formType === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(formType),
        notes: formNotes || null,
        teachers: formSubjects.filter(s => subjectTeachers[s]).map(s => ({ email: subjectTeachers[s], subject: s })),
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch('/api/v1/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) { toast.success('Batch created successfully!'); onCreated(); }
      else toast.error(json.error || 'Failed to create batch');
    } catch { toast.error('Failed to create batch'); }
    setCreating(false);
  };

  // Navigation
  const goNext = () => { if (stepIdx < WIZARD_STEPS.length - 1) setWizardStep(WIZARD_STEPS[stepIdx + 1].key); };
  const goPrev = () => { if (stepIdx > 0) setWizardStep(WIZARD_STEPS[stepIdx - 1].key); };
  const canGoNext = (): boolean => {
    if (wizardStep === 'template') return canProceedFromTemplate;
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'teachers') return canProceedFromTeachers;
    if (wizardStep === 'students') return true;
    return false;
  };

  // ── Step renderers ──

  const renderTemplateStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Choose Batch Type</h3>
      <p className="text-gray-500 mb-8">Select the type of batch you want to create</p>
      <div className="grid grid-cols-2 gap-5">
        {BATCH_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          const isSelected = formType === tpl.type;
          return (
            <button key={tpl.type} type="button" onClick={() => setFormType(tpl.type)}
              className={`group relative p-6 rounded-2xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                isSelected ? 'border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md ring-2 ring-emerald-200' : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
              }`}
            >
              {isSelected && <div className="absolute top-3 right-3"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h4 className={`text-base font-bold mb-1 ${isSelected ? 'text-emerald-800' : 'text-gray-800'}`}>{tpl.label}</h4>
              <p className="text-sm text-gray-500 mb-3">{tpl.description}</p>
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                Max: {tpl.maxStudents === 999 ? 'Custom' : `${tpl.maxStudents} student${tpl.maxStudents > 1 ? 's' : ''}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStudentsStep = () => {
    const max = getMaxForType(formType);
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Add Students</h3>
        <p className="text-gray-500 mb-6">Select students for this batch</p>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-sm font-semibold text-emerald-700">{selectedStudents.length}</span>
              <span className="text-xs text-emerald-500 ml-1">/ {max === 999 ? '∞' : max}</span>
            </div>
            <span className="text-sm text-gray-500">students selected</span>
          </div>
          <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="w-72!" />
        </div>

        {selectedStudents.length > 0 && (
          <div className="mb-5 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Students</h4>
            {selectedStudents.map(s => (
              <div key={s.email} className="rounded-xl border-2 border-emerald-200 overflow-hidden">
                <div className="flex items-center justify-between bg-emerald-50/80 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.parent_email ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="h-3.5 w-3.5" /> Parent: {s.parent_name || s.parent_email}
                      </span>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openCreateParent(s.email); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-200 transition-all cursor-pointer"
                      >
                        <AlertCircle className="h-4 w-4" /> No Parent — Click to Add
                      </button>
                    )}
                    <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border rounded-xl max-h-72 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0"><tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
              </tr></thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  return (
                    <tr key={s.email} className={`border-t hover:bg-emerald-50/30 cursor-pointer transition-colors ${selected ? 'bg-emerald-50/50' : ''}`} onClick={() => toggleStudent(s)}>
                      <td className="px-4 py-3"><p className="font-medium text-gray-800">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></td>
                      <td className="px-4 py-3 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-4 py-3">{s.parent_email ? <span className="text-xs text-emerald-600">{s.parent_name || s.parent_email}</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded"><AlertCircle className="h-3 w-3" /> No parent</span>}</td>
                      <td className="px-4 py-3 text-right">{selected ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="h-3.5 w-3.5" /> Selected</span> : maxReached ? <span className="text-xs text-gray-300">Max reached</span> : <span className="text-xs text-gray-400 hover:text-emerald-600">+ Add</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Batch Details</h3>
      <p className="text-gray-500 mb-8">Configure the basic information for this batch</p>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Grade" required>
            <Select value={formGrade} onChange={handleGradeChange}
              options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
            />
          </FormField>
          <FormField label="Section (auto-assigned)">
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${formSection ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
              {formSection ? (
                <>
                  <span className="text-2xl font-bold text-emerald-700">{formSection}</span>
                  <div className="text-sm">
                    <p className="font-semibold text-emerald-800">Section {formSection}</p>
                    <p className="text-xs text-emerald-500">{getUsedSections(formGrade).length} section{getUsedSections(formGrade).length !== 1 ? 's' : ''} already used</p>
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Select a grade to auto-assign section</p>}
            </div>
          </FormField>
        </div>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Class 10 A" />
        </FormField>
        <div className="grid grid-cols-2 gap-6">
          <FormField label="Board">
            <Select value={formBoard} onChange={setFormBoard}
              options={[{ value: '', label: 'Select Board' }, ...BOARDS.map(b => ({ value: b, label: b }))]}
            />
          </FormField>
          <FormField label="Coordinator">
            <Select value={formCoordinator} onChange={setFormCoordinator}
              options={[
                { value: '', label: 'Select Coordinator' },
                ...coordinators.map(c => {
                  const bc = batches.filter(b => b.coordinator_email === c.email).length;
                  return { value: c.email, label: `${c.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        </div>
        {userRole === 'owner' && (
          <FormField label="Academic Operator">
            <Select value={formAO} onChange={setFormAO}
              options={[
                { value: '', label: 'Select Academic Operator' },
                ...academicOperators.map(ao => {
                  const bc = batches.filter(b => b.academic_operator_email === ao.email).length;
                  return { value: ao.email, label: `${ao.full_name}${bc > 0 ? ` — ${bc} batch${bc > 1 ? 'es' : ''}` : ' — No batches'}` };
                }),
              ]}
            />
          </FormField>
        )}
        {formType === 'custom' && (
          <FormField label="Max Students">
            <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
          </FormField>
        )}
        <FormField label="Notes">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
        </FormField>
      </div>
    </div>
  );

  const renderTeachersStep = () => (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-1">Subjects &amp; Teachers</h3>
      <p className="text-gray-500 mb-8">Select subjects and assign a teacher to each one</p>
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Select Subjects *</label>
        <div className="flex flex-wrap gap-2.5">
          {SUBJECTS.map(subj => {
            const isSelected = formSubjects.includes(subj);
            return (
              <button key={subj} type="button" onClick={() => toggleSubject(subj)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                }`}
              >
                {isSelected && <span className="mr-1.5">✓</span>}{subj}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">{formSubjects.length} of {SUBJECTS.length} subjects selected</p>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Assign Teachers <span className="ml-2 text-xs font-normal text-gray-400">{formSubjects.filter(s => subjectTeachers[s]).length} / {formSubjects.length} assigned</span>
          </label>
          <div className="space-y-3">
            {formSubjects.map(subj => {
              const assigned = !!subjectTeachers[subj];
              return (
                <div key={subj} className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 transition-all ${assigned ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${assigned ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-30"><span className="text-sm font-semibold text-gray-800">{subj}</span></div>
                  <div className="flex-1">
                    <Select
                      value={subjectTeachers[subj] || ''}
                      onChange={(val) => setSubjectTeachers(prev => ({ ...prev, [subj]: val }))}
                      options={[
                        { value: '', label: 'Select Teacher…' },
                        ...teachers.filter(t => { const ts = t.subjects || []; return ts.length === 0 || ts.some(x => x.toLowerCase() === subj.toLowerCase()); })
                          .map(t => ({ value: t.email, label: `${t.full_name}${t.subjects ? ` (${t.subjects.join(', ')})` : ''}` })),
                      ]}
                    />
                  </div>
                  {assigned && <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Review &amp; Create</h3>
        <p className="text-gray-500 mb-6">Confirm the batch details before creating</p>
      </div>
      <div className="bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
        <h4 className="text-sm font-bold text-emerald-800 mb-4">Batch Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{formName}</span></div>
          <div><span className="text-gray-400">Type:</span> <Badge label={batchTypeLabel(formType)} variant={batchTypeBadgeVariant(formType)} /></div>
          <div><span className="text-gray-400">Grade / Section:</span> <span className="font-medium text-gray-800">Grade {formGrade}{formSection ? ` ${formSection}` : ''}</span></div>
          <div><span className="text-gray-400">Board:</span> <span className="font-medium text-gray-800">{formBoard || '—'}</span></div>
          <div><span className="text-gray-400">Coordinator:</span> <span className="font-medium text-gray-800">{coordinators.find(c => c.email === formCoordinator)?.full_name || formCoordinator || '—'}</span></div>
          {userRole === 'owner' && <div><span className="text-gray-400">Academic Operator:</span> <span className="font-medium text-gray-800">{academicOperators.find(a => a.email === formAO)?.full_name || formAO || '—'}</span></div>}
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
        </div>
      </div>
      {formSubjects.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subjects &amp; Teachers ({formSubjects.length})</h4>
          <div className="space-y-2">
            {formSubjects.map(subj => {
              const teacherEmail = subjectTeachers[subj];
              const teacher = teachers.find(t => t.email === teacherEmail);
              return (
                <div key={subj} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${teacher ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-gray-700 min-w-30">{subj}</span>
                  <span className="text-gray-300">→</span>
                  {teacher ? <span className="text-emerald-600">{teacher.full_name}</span> : <span className="text-amber-500 italic">No teacher assigned</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedStudents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Enrolled Students ({selectedStudents.length})</h4>
          <div className="space-y-2">
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center gap-3 bg-white border rounded-xl px-4 py-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">{s.name.charAt(0).toUpperCase()}</div>
                <span className="font-semibold text-gray-700">{s.name}</span>
                <span className="text-gray-400 text-xs">{s.email}</span>
                {s.parent_email ? <span className="ml-auto text-xs text-emerald-600">Parent: {s.parent_name || s.parent_email}</span> : <span className="ml-auto text-xs text-amber-500">No parent assigned</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {formNotes && (
        <div className="bg-gray-50 rounded-xl p-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-sm text-gray-600">{formNotes}</p>
        </div>
      )}
    </div>
  );

  // ── Wizard overlay ──
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Left sidebar */}
          <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">New Batch</h2>
              <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {WIZARD_STEPS.length}</p>
            </div>
            <div className="space-y-1 flex-1">
              {WIZARD_STEPS.map((step, idx) => {
                const isDone = idx < stepIdx;
                const isCurrent = idx === stepIdx;
                return (
                  <div key={step.key}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isCurrent ? 'bg-white/20 text-white shadow-lg shadow-black/10' : isDone ? 'text-emerald-200' : 'text-emerald-400/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isDone ? 'bg-emerald-400 text-emerald-900' : isCurrent ? 'bg-white text-emerald-700' : 'bg-emerald-500/30 text-emerald-300/70'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Cancel &amp; Close
            </button>
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              {wizardStep === 'template' && renderTemplateStep()}
              {wizardStep === 'students' && renderStudentsStep()}
              {wizardStep === 'details' && renderDetailsStep()}
              {wizardStep === 'teachers' && renderTeachersStep()}
              {wizardStep === 'review' && renderReviewStep()}
            </div>
            <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
              <div>{stepIdx > 0 && <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>}</div>
              <div className="flex items-center gap-3">
                {wizardStep !== 'review' ? (
                  <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">Continue</Button>
                ) : (
                  <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || creating} size="lg">
                    {creating ? 'Creating…' : 'Create Batch'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Modal (for parents) */}
      <CreateUserModal
        role={createUserRole}
        open={showCreateUser}
        onClose={() => { setShowCreateUser(false); setParentForStudent(''); }}
        onCreated={handleUserCreated}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AO MONITORING TAB
   ═══════════════════════════════════════════════════════════════ */

const SEVERITY_STYLE: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-600' },
  warning:  { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-600' },
  info:     { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600' },
};

function AOMonitoringTab({ alerts, loading, onRefresh }: {
  alerts: MonitoringAlertAO[]; loading: boolean; onRefresh: () => void;
}) {
  const [filterSev, setFilterSev] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filtered = alerts
    .filter(a => filterSev === 'all' || a.severity === filterSev)
    .filter(a => filterType === 'all' || a.alert_type === filterType);

  const types = [...new Set(alerts.map(a => a.alert_type))];

  const dismissAlert = async (id: string) => {
    try {
      await fetch('/api/v1/monitoring/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alert_id: id }),
      });
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      {/* Alert counts */}
      <div className="grid grid-cols-3 gap-3">
        {(['critical', 'warning', 'info'] as const).map(sev => {
          const sty = SEVERITY_STYLE[sev];
          const count = alerts.filter(a => a.severity === sev).length;
          return (
            <div key={sev} className={`rounded-xl border ${sty.border} ${sty.bg} p-3`}>
              <div className="flex items-center justify-between">
                <AlertTriangle className={`h-4 w-4 ${sty.text}`} />
                <span className={`text-2xl font-bold ${sty.text}`}>{count}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 capitalize">{sev}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900">
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900">
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Alert list */}
      {loading && alerts.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="No active alerts — all sessions are running smoothly" />
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const sty = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info;
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${sty.border} ${sty.bg}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${sty.text}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${sty.text}`}>{alert.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${sty.text}`}>{alert.severity}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                      {alert.target_email && <span>{alert.target_email}</span>}
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => dismissAlert(alert.id)}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-900 shrink-0">
                    <XCircle className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// AO REQUESTS TAB — Session requests approval + Teacher leave review
// ═══════════════════════════════════════════════════════════════

function AORequestsTab({ sessionRequests, leaveRequests, loadingRequests, loadingLeave, onRefresh, toast }: {
  sessionRequests: AOSessionRequest[];
  leaveRequests: AOLeaveRequest[];
  loadingRequests: boolean;
  loadingLeave: boolean;
  onRefresh: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
}) {
  const [view, setView] = useState<'sessions' | 'leave'>('sessions');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);

  const handleAction = async (type: 'session' | 'leave', id: string, action: 'approve' | 'reject', reason?: string) => {
    setActionId(id);
    try {
      const url = type === 'session' ? '/api/v1/session-requests' : '/api/v1/teacher-leave';
      const body: Record<string, string> = type === 'session'
        ? { action, request_id: id, ...(reason ? { rejection_reason: reason } : {}) }
        : { action, request_id: id, ...(reason ? { notes: reason } : {}) };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) { toast.success(`Request ${action}d successfully`); onRefresh(); setShowReject(null); setRejectReason(''); }
      else toast.error(data.error || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setActionId(null); }
  };

  const pendingSessionCount = sessionRequests.filter(r => r.status === 'pending').length;
  const pendingLeaveCount = leaveRequests.filter(r => r.ao_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('sessions')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
            ${view === 'sessions' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <CalendarClock className="h-4 w-4" />Session Requests{pendingSessionCount > 0 && <Badge label={String(pendingSessionCount)} variant="warning" />}
          </button>
          <button onClick={() => setView('leave')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
            ${view === 'leave' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'}`}>
            <Briefcase className="h-4 w-4" />Teacher Leave{pendingLeaveCount > 0 && <Badge label={String(pendingLeaveCount)} variant="warning" />}
          </button>
        </div>
        <RefreshButton loading={loadingRequests || loadingLeave} onClick={onRefresh} />
      </div>

      {view === 'sessions' ? (
        /* Session requests */
        (loadingRequests ? <LoadingState /> : sessionRequests.length === 0 ? (
          <EmptyState icon={CalendarClock} message="No session requests" />
        ) : (
          <div className="space-y-3">
            {sessionRequests.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                      ${r.request_type === 'cancel' ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {r.request_type === 'cancel'
                        ? <Ban className="h-4.5 w-4.5 text-red-600" />
                        : <CalendarClock className="h-4.5 w-4.5 text-blue-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">{r.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} Request</span>
                        <StatusBadge status={r.status} />
                        <Badge label={r.requester_role} variant="secondary" />
                      </div>
                      <p className="text-xs text-gray-500">
                        By <span className="font-medium">{r.requester_name || r.requester_email}</span>
                        {r.batch_name && ` · ${r.batch_name}`}
                        {r.subject && ` · ${r.subject}`}
                        {r.session_date && ` · ${new Date(r.session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                      </p>
                      {r.proposed_date && <p className="text-xs text-blue-500 mt-0.5">Proposed: {r.proposed_date}{r.proposed_time ? ` at ${r.proposed_time}` : ''}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-1">Rejected: {r.rejection_reason}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button disabled={actionId === r.id} onClick={() => handleAction('session', r.id, 'approve')}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[11px] text-white font-medium hover:bg-green-700 disabled:opacity-50 transition">
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </button>
                        {showReject === r.id ? (
                          <div className="flex items-center gap-1">
                            <input placeholder="Reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              className="w-32 rounded border border-gray-200 bg-white px-2 py-1 text-[11px]" />
                            <button disabled={actionId === r.id || !rejectReason} onClick={() => handleAction('session', r.id, 'reject', rejectReason)}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] text-white font-medium hover:bg-red-700 disabled:opacity-50">Go</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowReject(r.id)}
                            className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1 text-[11px] text-red-500 font-medium hover:bg-red-50 transition">
                            <XCircle className="h-3 w-3" />Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        /* Teacher Leave requests */
        (loadingLeave ? <LoadingState /> : leaveRequests.length === 0 ? (
          <EmptyState icon={Briefcase} message="No teacher leave requests" />
        ) : (
          <div className="space-y-3">
            {leaveRequests.map(lr => (
              <div key={lr.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                      <Briefcase className="h-4.5 w-4.5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold">{lr.teacher_name || lr.teacher_email}</span>
                        <Badge label={lr.leave_type} variant="secondary" />
                        <StatusBadge status={lr.status} />
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(lr.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(lr.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {lr.affected_sessions?.length > 0 && ` · ${lr.affected_sessions.length} sessions affected`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{lr.reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                        <span className={lr.ao_status === 'approved' ? 'text-green-500' : lr.ao_status === 'rejected' ? 'text-red-500' : 'text-yellow-500'}>
                          AO: {lr.ao_status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-[10px] text-gray-500">{new Date(lr.created_at).toLocaleDateString('en-IN')}</p>
                    {lr.ao_status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button disabled={actionId === lr.id} onClick={() => handleAction('leave', lr.id, 'approve')}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[11px] text-white font-medium hover:bg-green-700 disabled:opacity-50 transition">
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </button>
                        {showReject === lr.id ? (
                          <div className="flex items-center gap-1">
                            <input placeholder="Reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              className="w-32 rounded border border-gray-200 bg-white px-2 py-1 text-[11px]" />
                            <button disabled={actionId === lr.id || !rejectReason} onClick={() => handleAction('leave', lr.id, 'reject', rejectReason)}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] text-white font-medium hover:bg-red-700 disabled:opacity-50">Go</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowReject(lr.id)}
                            className="flex items-center gap-1 rounded-lg border border-red-600/50 px-2.5 py-1 text-[11px] text-red-500 font-medium hover:bg-red-50 transition">
                            <XCircle className="h-3 w-3" />Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}