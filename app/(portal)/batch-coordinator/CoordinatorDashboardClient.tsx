// 
// Coordinator Dashboard — Complete Rebuild
// 
// Tabs: Overview, Batches, Live Sessions, Monitoring, Reports, Students
// Features: AI monitoring alerts, live session reports, student/teacher
// performance tracking, report generation, parent notification.
// 

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtSmartDateIST, fmtDateTimeIST } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Clock, Users, Send, Radio, CheckCircle2,
  XCircle, Search, RefreshCw, Eye, Loader2, ChevronDown, ChevronRight,
  BookOpen, GraduationCap, Mail, UserCheck, UserX, AlertCircle,
  BarChart2, Bell, Activity,
  FileText, AlertTriangle, Brain, Video, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* 
   TYPES
    */

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

interface StudentPerf {
  email: string;
  name: string;
  batch_id: string;
  batch_name: string;
  grade: string | null;
  section: string | null;
  total_sessions: number;
  sessions_present: number;
  attendance_rate: number;
  exams_taken: number;
  avg_exam_score: number | null;
}

interface PerfBatch {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  student_count: number;
  completed_sessions: number;
}

interface MonitoringAlert {
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

interface SessionMonitoring {
  room_id: string;
  total_events: number;
  class_engagement_score: number;
  students: Array<{
    email: string;
    name: string;
    current_state: string;
    attention_score: number;
    looking_away_minutes: number;
    eyes_closed_minutes: number;
    not_in_frame_minutes: number;
    distracted_minutes: number;
    total_attentive_minutes: number;
    active_alerts: number;
  }>;
  alerts: MonitoringAlert[];
}

interface MonitoringReport {
  id: string;
  report_type: string;
  report_period: string;
  period_start: string;
  period_end: string;
  target_email: string;
  target_role: string;
  target_name: string | null;
  batch_name: string | null;
  metrics: Record<string, unknown>;
  created_at: string;
}

interface CoordinatorDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type TabId = 'overview' | 'batches' | 'sessions' | 'monitoring' | 'reports' | 'students';

/* 
   HELPERS
    */

function effectiveStatus(room: { status: string; scheduled_start: string; duration_minutes: number }): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; dot: string; icon: typeof Radio }> = {
  scheduled: { bg: 'bg-blue-900/40 border-blue-700',  text: 'text-blue-300',  dot: 'bg-blue-500',  icon: Calendar     },
  live:      { bg: 'bg-green-900/40 border-green-700', text: 'text-green-300', dot: 'bg-green-500', icon: Radio        },
  ended:     { bg: 'bg-muted border-border',           text: 'text-muted-foreground', dot: 'bg-muted-foreground', icon: CheckCircle2 },
  cancelled: { bg: 'bg-red-900/40 border-red-700',     text: 'text-red-400',   dot: 'bg-red-500',   icon: XCircle      },
};

function Avatar({ name, size = 7, color = 'bg-primary' }: { name: string; size?: number; color?: string }) {
  return (
    <div className={cn(`flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground`, color, `h-${size} w-${size}`)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const SEVERITY_COLOR: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: 'border-red-700', bg: 'bg-red-950/40', text: 'text-red-400' },
  warning:  { border: 'border-amber-700', bg: 'bg-amber-950/40', text: 'text-amber-400' },
  info:     { border: 'border-blue-700', bg: 'bg-blue-950/40', text: 'text-blue-400' },
};

const attColor = (s: number) => s >= 75 ? 'text-green-400' : s >= 50 ? 'text-amber-400' : 'text-red-400';
const attBg    = (s: number) => s >= 75 ? 'bg-green-500'   : s >= 50 ? 'bg-amber-500'   : 'bg-red-500';

/* 
   MAIN COMPONENT
    */

export default function CoordinatorDashboardClient({
  userName, userEmail, userRole, permissions,
}: CoordinatorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [perfStudents, setPerfStudents] = useState<StudentPerf[]>([]);
  const [perfBatches, setPerfBatches] = useState<PerfBatch[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [reports, setReports] = useState<MonitoringReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  // End-class request state
  const [endClassRequests, setEndClassRequests] = useState<{ room_id: string; room_name: string; teacher_name: string; reason: string; requested_at: string }[]>([]);
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

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await fetch('/api/v1/monitoring/alerts');
      const data = await res.json();
      if (data.success) setAlerts(data.data?.alerts || []);
    } catch (err) { console.error('Failed to fetch alerts:', err); }
    finally { setLoadingAlerts(false); }
  }, []);

  const fetchPerformance = useCallback(async () => {
    setLoadingPerf(true);
    try {
      const res = await fetch('/api/v1/coordinator/student-performance');
      const data = await res.json();
      if (data.success) {
        setPerfStudents(data.data?.students ?? []);
        setPerfBatches(data.data?.batches ?? []);
      }
    } catch (err) { console.error('Failed to fetch performance:', err); }
    finally { setLoadingPerf(false); }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/v1/monitoring/reports');
      const data = await res.json();
      if (data.success) setReports(data.data?.reports || []);
    } catch (err) { console.error('Failed to fetch reports:', err); }
    finally { setLoadingReports(false); }
  }, []);

  // Fetch pending end-class requests from all live rooms
  const fetchEndClassRequests = useCallback(async () => {
    try {
      // Get live rooms, then check each for pending end-class requests
      const res = await fetch('/api/v1/coordinator/rooms');
      const data = await res.json();
      if (!data.success) return;
      const liveRooms = (data.data?.rooms || []).filter((r: Room) => effectiveStatus(r) === 'live');
      const requests: { room_id: string; room_name: string; teacher_name: string; reason: string; requested_at: string }[] = [];
      await Promise.all(liveRooms.map(async (r: Room) => {
        try {
          const reqRes = await fetch(`/api/v1/room/${r.room_id}/end-request`);
          const reqData = await reqRes.json();
          if (reqData?.data?.status === 'pending') {
            requests.push({
              room_id: r.room_id,
              room_name: r.room_name,
              teacher_name: r.teacher_email || 'Teacher',
              reason: reqData.data.reason || '',
              requested_at: reqData.data.requested_at || new Date().toISOString(),
            });
          }
        } catch {}
      }));
      setEndClassRequests(requests);
    } catch (err) { console.error('Failed to fetch end-class requests:', err); }
  }, []);

  const handleEndClassDecision = useCallback(async (roomId: string, action: 'approve' | 'deny') => {
    try {
      await fetch(`/api/v1/room/${roomId}/end-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setEndClassRequests((prev) => prev.filter((r) => r.room_id !== roomId));
      if (action === 'approve') fetchRooms(); // Refresh rooms to show ended status
    } catch (err) { console.error('Failed to process end-class decision:', err); }
  }, [fetchRooms]);

  useEffect(() => { fetchRooms(); fetchAlerts(); fetchEndClassRequests(); }, [fetchRooms, fetchAlerts]);

  useEffect(() => {
    if (activeTab === 'students' && perfStudents.length === 0) fetchPerformance();
    if (activeTab === 'reports' && reports.length === 0) fetchReports();
  }, [activeTab, perfStudents.length, reports.length, fetchPerformance, fetchReports]);

  useEffect(() => {
    const iv = setInterval(() => { fetchAlerts(); fetchEndClassRequests(); }, 30_000);
    return () => clearInterval(iv);
  }, [fetchAlerts, fetchEndClassRequests]);

  // Sync activeTab with URL hash so sidebar nav links work
  useEffect(() => {
    const validTabs: TabId[] = ['overview', 'batches', 'sessions', 'monitoring', 'reports', 'students'];
    const hash = window.location.hash.replace('#', '') as TabId;
    if (hash && validTabs.includes(hash)) setActiveTab(hash);
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as TabId;
      if (h && validTabs.includes(h)) setActiveTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Update hash when tab changes
  useEffect(() => {
    const h = activeTab === 'overview' ? '' : `#${activeTab}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h || window.location.pathname);
  }, [activeTab]);

  const stats = useMemo(() => ({
    total: rooms.length,
    live: rooms.filter((r) => effectiveStatus(r) === 'live').length,
    scheduled: rooms.filter((r) => effectiveStatus(r) === 'scheduled').length,
    ended: rooms.filter((r) => effectiveStatus(r) === 'ended').length,
    cancelled: rooms.filter((r) => effectiveStatus(r) === 'cancelled').length,
    criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
    totalAlerts: alerts.length,
  }), [rooms, alerts]);

  const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'overview',   label: 'Overview',       icon: LayoutDashboard },
    { id: 'batches',    label: 'Batches',        icon: BookOpen },
    { id: 'sessions',   label: 'Live Sessions',  icon: Radio, badge: stats.live },
    { id: 'monitoring', label: 'Monitoring',     icon: Brain, badge: stats.totalAlerts },
    { id: 'reports',    label: 'Reports',        icon: FileText },
    { id: 'students',   label: 'Students',       icon: Users },
  ];

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await fetch('/api/v1/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', alert_id: alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch { /* ignore */ }
  }, []);

  const [generating, setGenerating] = useState(false);
  const generateReport = useCallback(async (
    targetEmail: string,
    targetRole: 'student' | 'teacher',
    period: 'daily' | 'weekly' | 'monthly',
  ) => {
    setGenerating(true);
    const now = new Date();
    let periodStart: string;
    let periodEnd: string;
    if (period === 'daily') {
      periodStart = now.toISOString().split('T')[0];
      periodEnd = periodStart;
    } else if (period === 'weekly') {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      periodStart = s.toISOString().split('T')[0];
      periodEnd = now.toISOString().split('T')[0];
    } else {
      const s = new Date(now); s.setMonth(s.getMonth() - 1);
      periodStart = s.toISOString().split('T')[0];
      periodEnd = now.toISOString().split('T')[0];
    }
    try {
      await fetch('/api/v1/monitoring/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_email: targetEmail, target_role: targetRole, period, period_start: periodStart, period_end: periodEnd }),
      });
      fetchReports();
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  }, [fetchReports]);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Batch Coordinator Dashboard</h1>
        <p className="text-sm text-muted-foreground">Monitor batches, track attendance, AI session monitoring, generate reports</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-primary bg-primary/5 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn(
                  'ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold',
                  tab.id === 'monitoring' && alerts.some(a => a.severity === 'critical')
                    ? 'bg-red-600 text-white' : 'bg-primary/20 text-primary',
                )}>{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Critical alerts banner */}
      {stats.criticalAlerts > 0 && activeTab !== 'monitoring' && (
        <div className="mb-4 rounded-xl border border-red-700 bg-red-950/40 p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">{stats.criticalAlerts} Critical Alert{stats.criticalAlerts > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-300/70">{alerts.find(a => a.severity === 'critical')?.message}</p>
          </div>
          <button onClick={() => setActiveTab('monitoring')} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">View Alerts</button>
        </div>
      )}

      {/* End-class requests banner */}
      {endClassRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          {endClassRequests.map((req) => (
            <div key={req.room_id} className="rounded-xl border border-amber-700 bg-amber-950/40 p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-400">End Session Request — {req.room_name}</p>
                <p className="text-xs text-amber-300/70">{req.teacher_name} wants to end the session early{req.reason ? `: ${req.reason}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEndClassDecision(req.room_id, 'deny')}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50">Deny</button>
                <button onClick={() => handleEndClassDecision(req.room_id, 'approve')}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Approve End</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'overview' && <OverviewTab stats={stats} rooms={rooms} alerts={alerts} loading={loading} onRefresh={fetchRooms} onTab={setActiveTab} router={router} />}
      {activeTab === 'batches' && <BatchesTab rooms={rooms} loading={loading} onRefresh={fetchRooms} router={router} />}
      {activeTab === 'sessions' && <LiveSessionsTab rooms={rooms} loading={loading} onRefresh={fetchRooms} router={router} />}
      {activeTab === 'monitoring' && <MonitoringTab alerts={alerts} loadingAlerts={loadingAlerts} onRefreshAlerts={fetchAlerts} onDismiss={dismissAlert} rooms={rooms} router={router} />}
      {activeTab === 'reports' && <ReportsTab reports={reports} loadingReports={loadingReports} onRefresh={fetchReports} perfStudents={perfStudents} generating={generating} onGenerate={generateReport} />}
      {activeTab === 'students' && <StudentsTab students={perfStudents} batches={perfBatches} loading={loadingPerf} onRefresh={fetchPerformance} onGenerate={generateReport} generating={generating} />}
    </DashboardShell>
  );
}

/* 
   OVERVIEW TAB
    */

function OverviewTab({ stats, rooms, alerts, loading, onRefresh, onTab, router }: {
  stats: { total: number; live: number; scheduled: number; ended: number; cancelled: number; criticalAlerts: number; totalAlerts: number };
  rooms: Room[]; alerts: MonitoringAlert[]; loading: boolean; onRefresh: () => void;
  onTab: (t: TabId) => void; router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Sessions', value: stats.total, icon: Calendar, color: 'border-border text-foreground' },
          { label: 'Live Now', value: stats.live, icon: Radio, color: 'border-green-700 text-green-400' },
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'border-cyan-700 text-cyan-400' },
          { label: 'Ended', value: stats.ended, icon: CheckCircle2, color: 'border-border text-muted-foreground' },
          { label: 'Alerts', value: stats.totalAlerts, icon: Bell, color: stats.criticalAlerts > 0 ? 'border-red-700 text-red-400' : 'border-amber-700 text-amber-400' },
          { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'border-red-700/50 text-red-400/70' },
        ].map((s) => {
          const Ic = s.icon;
          return (
            <div key={s.label} className={cn('rounded-xl border bg-card/60 p-3', s.color.split(' ')[0])}>
              <div className="flex items-center justify-between">
                <Ic className={cn('h-4 w-4', s.color.split(' ')[1])} />
                <p className={cn('text-2xl font-bold', s.color.split(' ')[1])}>{s.value}</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Live Sessions */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Radio className="h-4 w-4 text-green-400" /> Live Sessions</h3>
            <button onClick={() => onTab('sessions')} className="text-[10px] text-primary hover:underline">View All</button>
          </div>
          {rooms.filter(r => effectiveStatus(r) === 'live').length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No live sessions right now</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto">
              {rooms.filter(r => effectiveStatus(r) === 'live').slice(0, 5).map((r) => (
                <div key={r.room_id} className="flex items-center gap-3 rounded-lg border border-green-800/50 bg-green-950/20 p-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-900/40"><Radio className="h-4 w-4 text-green-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.room_name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.subject} &middot; {r.grade}</p>
                  </div>
                  <button onClick={() => router.push(`/classroom/${r.room_id}?mode=observe`)}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700">
                    <Eye className="h-3 w-3" /> Observe
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bell className="h-4 w-4 text-amber-400" /> Recent Alerts</h3>
            <button onClick={() => onTab('monitoring')} className="text-[10px] text-primary hover:underline">View All</button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No active alerts</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-auto">
              {alerts.slice(0, 6).map((a) => {
                const sev = SEVERITY_COLOR[a.severity] || SEVERITY_COLOR.info;
                return (
                  <div key={a.id} className={cn('rounded-lg border p-2.5', sev.border, sev.bg)}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', sev.text)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium', sev.text)}>{a.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>
    </div>
  );
}

/* 
   BATCHES TAB
    */

function BatchesTab({ rooms, loading, onRefresh, router }: {
  rooms: Room[]; loading: boolean; onRefresh: () => void; router: ReturnType<typeof useRouter>;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

  const filtered = rooms
    .filter((r) => filter === 'all' || effectiveStatus(r) === filter)
    .filter((r) => !search || r.room_name.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase()) || r.grade.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'live', 'scheduled', 'ended', 'cancelled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>{f}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search batches, subject, grade..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
        </div>
        <button onClick={onRefresh} className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading batches...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Calendar className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-foreground font-medium">No batches found</p>
          </div>
        ) : (
          filtered.map((room) => (
            <MonitorRoomCard key={room.room_id} room={room} expanded={expandedRoom === room.room_id}
              onToggle={() => setExpandedRoom(expandedRoom === room.room_id ? null : room.room_id)} onRefresh={onRefresh} router={router} />
          ))
        )}
      </div>
    </div>
  );
}

/* 
   LIVE SESSIONS TAB
    */

function LiveSessionsTab({ rooms, loading, onRefresh, router }: {
  rooms: Room[]; loading: boolean; onRefresh: () => void; router: ReturnType<typeof useRouter>;
}) {
  const liveRooms = rooms.filter((r) => effectiveStatus(r) === 'live');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionMonitoring | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const fetchSessionData = useCallback(async (roomId: string) => {
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/v1/monitoring/session/${roomId}`);
      const data = await res.json();
      if (data.success) setSessionData(data.data);
    } catch { /* ignore */ }
    finally { setLoadingSession(false); }
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    fetchSessionData(selectedRoom);
    const iv = setInterval(() => fetchSessionData(selectedRoom), 10_000);
    return () => clearInterval(iv);
  }, [selectedRoom, fetchSessionData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Radio className="h-4 w-4 text-green-400 animate-pulse" /> {liveRooms.length} Live Session{liveRooms.length !== 1 ? 's' : ''}
        </h3>
        <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {liveRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Video className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-foreground font-medium">No live sessions</p>
          <p className="text-xs text-muted-foreground mt-1">Sessions will appear here when they go live</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {liveRooms.map((r) => (
              <button key={r.room_id} onClick={() => setSelectedRoom(r.room_id)}
                className={cn('w-full rounded-xl border p-3 text-left transition-colors',
                  selectedRoom === r.room_id ? 'border-green-600 bg-green-950/30' : 'border-border bg-card hover:border-green-800',
                )}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-foreground truncate">{r.room_name}</span>
                </div>
                <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{r.subject}</span><span>&middot;</span><span>{r.grade}</span>
                  {r.student_count && <span>&middot; {r.student_count} students</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!selectedRoom ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Select a live session to see monitoring data</p>
              </div>
            ) : loadingSession && !sessionData ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading session data...</div>
            ) : sessionData ? (
              <div className="space-y-4">
                {/* Engagement score */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Session Engagement</span>
                    <button onClick={() => router.push(`/classroom/${selectedRoom}?mode=observe`)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-700">
                      <Eye className="h-3 w-3" /> Observe Live
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', attBg(sessionData.class_engagement_score))}
                        style={{ width: `${sessionData.class_engagement_score}%` }} />
                    </div>
                    <span className={cn('text-xl font-bold', attColor(sessionData.class_engagement_score))}>{sessionData.class_engagement_score}%</span>
                  </div>
                </div>

                {/* Student attention */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3">Student Attention (AI)</h4>
                  <div className="space-y-1.5 max-h-64 overflow-auto">
                    {sessionData.students.sort((a, b) => a.attention_score - b.attention_score).map((s) => (
                      <div key={s.email} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2',
                        s.attention_score < 30 ? 'border-red-700 bg-red-950/30' : s.attention_score < 60 ? 'border-amber-700 bg-amber-950/20' : 'border-border bg-muted/30')}>
                        <Avatar name={s.name} size={6} color={s.attention_score < 30 ? 'bg-red-600' : s.attention_score < 60 ? 'bg-amber-600' : 'bg-green-600'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            {s.current_state === 'eyes_closed' && <span className="text-red-400">&#x1F634; Sleeping</span>}
                            {s.current_state === 'looking_away' && <span className="text-amber-400">&#x1F440; Looking Away</span>}
                            {s.current_state === 'not_in_frame' && <span className="text-amber-400">&#x1F6AB; Not in Frame</span>}
                            {s.current_state === 'distracted' && <span className="text-amber-400">&#x1F635; Distracted</span>}
                            {s.current_state === 'attentive' && <span className="text-green-400">&#x2705; Attentive</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full', attBg(s.attention_score))} style={{ width: `${s.attention_score}%` }} />
                          </div>
                          <span className={cn('text-xs font-bold w-8 text-right', attColor(s.attention_score))}>{s.attention_score}%</span>
                        </div>
                        {s.active_alerts > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">{s.active_alerts}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {sessionData.alerts.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3">Session Alerts</h4>
                    <div className="space-y-1.5">
                      {sessionData.alerts.slice(0, 10).map((a) => {
                        const sev = SEVERITY_COLOR[a.severity] || SEVERITY_COLOR.info;
                        return (
                          <div key={a.id} className={cn('rounded-lg border p-2.5', sev.border, sev.bg)}>
                            <div className="flex items-center justify-between">
                              <span className={cn('text-xs font-medium', sev.text)}>{a.title}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{a.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* 
   MONITORING TAB
    */

function MonitoringTab({ alerts, loadingAlerts, onRefreshAlerts, onDismiss, rooms, router }: {
  alerts: MonitoringAlert[]; loadingAlerts: boolean; onRefreshAlerts: () => void; onDismiss: (id: string) => void;
  rooms: Room[]; router: ReturnType<typeof useRouter>;
}) {
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const filtered = alerts
    .filter((a) => filterType === 'all' || a.alert_type === filterType)
    .filter((a) => filterSeverity === 'all' || a.severity === filterSeverity);

  const alertTypes = [...new Set(alerts.map((a) => a.alert_type))];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-700 bg-red-950/40 p-3">
          <div className="flex items-center justify-between"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-2xl font-bold text-red-400">{alerts.filter(a => a.severity === 'critical').length}</span></div>
          <p className="text-[10px] text-muted-foreground mt-1">Critical</p>
        </div>
        <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-3">
          <div className="flex items-center justify-between"><AlertCircle className="h-4 w-4 text-amber-400" /><span className="text-2xl font-bold text-amber-400">{alerts.filter(a => a.severity === 'warning').length}</span></div>
          <p className="text-[10px] text-muted-foreground mt-1">Warning</p>
        </div>
        <div className="rounded-xl border border-blue-700 bg-blue-950/40 p-3">
          <div className="flex items-center justify-between"><Bell className="h-4 w-4 text-blue-400" /><span className="text-2xl font-bold text-blue-400">{alerts.filter(a => a.severity === 'info').length}</span></div>
          <p className="text-[10px] text-muted-foreground mt-1">Info</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="all">All Types</option>
          {alertTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <div className="flex-1" />
        <button onClick={onRefreshAlerts} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3.5 w-3.5', loadingAlerts && 'animate-spin')} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
            <p className="text-foreground font-medium">No active alerts</p>
            <p className="text-xs text-muted-foreground mt-1">All monitored sessions are running smoothly</p>
          </div>
        ) : (
          filtered.map((alert) => {
            const sev = SEVERITY_COLOR[alert.severity] || SEVERITY_COLOR.info;
            const room = rooms.find((r) => r.room_id === alert.room_id);
            return (
              <div key={alert.id} className={cn('rounded-xl border p-4', sev.border, sev.bg)}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn('h-5 w-5 mt-0.5 shrink-0', sev.text)} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-semibold', sev.text)}>{alert.title}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase', sev.bg, sev.text)}>{alert.severity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      {room && <span>{room.room_name}</span>}
                      {alert.target_email && <span>&middot; {alert.target_email}</span>}
                      <span>&middot; {fmtDateTimeIST(alert.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {room && effectiveStatus(room) === 'live' && (
                      <button onClick={() => router.push(`/classroom/${room.room_id}?mode=observe`)}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-green-700">
                        <Eye className="h-3 w-3" /> Observe
                      </button>
                    )}
                    <button onClick={() => onDismiss(alert.id)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
                      <XCircle className="h-3 w-3" /> Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* 
   REPORTS TAB
    */

function ReportsTab({ reports, loadingReports, onRefresh, perfStudents, generating, onGenerate }: {
  reports: MonitoringReport[]; loadingReports: boolean; onRefresh: () => void;
  perfStudents: StudentPerf[]; generating: boolean;
  onGenerate: (email: string, role: 'student' | 'teacher', period: 'daily' | 'weekly' | 'monthly') => void;
}) {
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const filtered = reports
    .filter((r) => filterType === 'all' || r.target_role === filterType)
    .filter((r) => filterPeriod === 'all' || r.report_period === filterPeriod);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-primary" /> Quick Generate Report</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Daily Student', role: 'student' as const, period: 'daily' as const, icon: Calendar },
            { label: 'Weekly Student', role: 'student' as const, period: 'weekly' as const, icon: BarChart2 },
            { label: 'Monthly Student', role: 'student' as const, period: 'monthly' as const, icon: FileText },
            { label: 'Daily Teacher', role: 'teacher' as const, period: 'daily' as const, icon: Calendar },
            { label: 'Weekly Teacher', role: 'teacher' as const, period: 'weekly' as const, icon: BarChart2 },
            { label: 'Monthly Teacher', role: 'teacher' as const, period: 'monthly' as const, icon: FileText },
          ].map((item) => {
            const Ic = item.icon;
            return (
              <button key={item.label} disabled={generating}
                onClick={() => { const s = perfStudents[0]; if (s) onGenerate(s.email, item.role, item.period); }}
                className="flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-3 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-50">
                <Ic className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-medium text-foreground">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="all">All Roles</option><option value="student">Students</option><option value="teacher">Teachers</option>
        </select>
        <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="all">All Periods</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
        </select>
        <div className="flex-1" />
        <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn('h-3.5 w-3.5', loadingReports && 'animate-spin')} /> Refresh
        </button>
      </div>

      {loadingReports ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-foreground font-medium">No reports yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate your first report using the quick actions above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const m = r.metrics as Record<string, unknown>;
            const isSt = r.target_role === 'student';
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', isSt ? 'bg-violet-900/40' : 'bg-emerald-900/40')}>
                    {isSt ? <GraduationCap className="h-5 w-5 text-violet-400" /> : <BookOpen className="h-5 w-5 text-emerald-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{r.target_name || r.target_email}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary capitalize">{r.report_period}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground capitalize">{r.target_role}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.period_start} &mdash; {r.period_end}{r.batch_name && ` \u00b7 ${r.batch_name}`}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      {isSt && m.attendance_rate != null && <span className={cn('font-bold', attColor(m.attendance_rate as number))}>{m.attendance_rate as number}% attend.</span>}
                      {isSt && m.avg_attention_score != null && <span className={cn('font-bold', attColor(m.avg_attention_score as number))}>{m.avg_attention_score as number}% attention</span>}
                      {isSt && m.alerts_count != null && <span className="text-muted-foreground">{m.alerts_count as number} alerts</span>}
                      {!isSt && m.sessions_conducted != null && <span className="text-foreground font-bold">{m.sessions_conducted as number} sessions</span>}
                      {!isSt && m.on_time_rate != null && <span className={cn('font-bold', (m.on_time_rate as number) >= 90 ? 'text-green-400' : 'text-amber-400')}>{m.on_time_rate as number}% on-time</span>}
                      {!isSt && m.sessions_cancelled != null && (m.sessions_cancelled as number) > 0 && <span className="text-red-400">{m.sessions_cancelled as number} cancelled</span>}
                    </div>
                    {m.overall_summary ? <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{String(m.overall_summary)}</p> : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{fmtSmartDateIST(r.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* 
   STUDENTS TAB
    */

function StudentsTab({ students, batches, loading, onRefresh, onGenerate, generating }: {
  students: StudentPerf[]; batches: PerfBatch[]; loading: boolean; onRefresh: () => void;
  onGenerate: (email: string, role: 'student' | 'teacher', period: 'daily' | 'weekly' | 'monthly') => void; generating: boolean;
}) {
  const [filterBatch, setFilterBatch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'attendance' | 'exam'>('attendance');
  const [search, setSearch] = useState('');

  const filtered = students
    .filter(s => !filterBatch || s.batch_id === filterBatch)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'attendance' ? b.attendance_rate - a.attendance_rate : (b.avg_exam_score ?? -1) - (a.avg_exam_score ?? -1));

  return (
    <div className="space-y-4">
      {batches.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {batches.map((b) => (
            <div key={b.id} className={cn('rounded-xl border p-3 cursor-pointer transition-colors', filterBatch === b.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50')}
              onClick={() => setFilterBatch(filterBatch === b.id ? '' : b.id)}>
              <p className="text-xs font-semibold text-foreground truncate">{b.name}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                {b.grade && <span>{b.grade}{b.section ? ` \u00b7 ${b.section}` : ''}</span>}
                <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {b.student_count}</span>
                <span>{b.completed_sessions} sessions</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'attendance' | 'exam')}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="attendance">Sort: Attendance</option><option value="exam">Sort: Exam Score</option><option value="name">Sort: Name</option>
        </select>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading student data...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-foreground font-medium">No students found</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold sticky top-0 bg-background z-10">
            <div className="flex-1">Student</div>
            <div className="w-20 text-center">Batch</div>
            <div className="w-24 text-center">Attendance</div>
            <div className="w-16 text-center">Exams</div>
            <div className="w-16 text-center">Avg Score</div>
            <div className="w-20 text-center">Reports</div>
          </div>
          {filtered.map((s) => (
            <div key={`${s.email}-${s.batch_id}`} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <Avatar name={s.name} size={7} color="bg-violet-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
              </div>
              <div className="w-20 text-center"><span className="text-[10px] text-muted-foreground truncate">{s.batch_name}</span></div>
              <div className="w-24">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', attBg(s.attendance_rate))} style={{ width: `${s.attendance_rate}%` }} />
                  </div>
                  <span className={cn('text-xs font-bold w-8 text-right', attColor(s.attendance_rate))}>{s.attendance_rate}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">{s.sessions_present}/{s.total_sessions}</p>
              </div>
              <div className="w-16 text-center"><p className="text-xs font-bold text-foreground">{s.exams_taken}</p></div>
              <div className="w-16 text-center">
                <p className={cn('text-sm font-bold', s.avg_exam_score != null ? attColor(s.avg_exam_score) : 'text-muted-foreground')}>
                  {s.avg_exam_score != null ? `${s.avg_exam_score}%` : '\u2014'}
                </p>
              </div>
              <div className="w-20 flex items-center gap-1 justify-center">
                <button onClick={() => onGenerate(s.email, 'student', 'daily')} disabled={generating} title="Daily Report"
                  className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"><Calendar className="h-3 w-3" /></button>
                <button onClick={() => onGenerate(s.email, 'student', 'weekly')} disabled={generating} title="Weekly Report"
                  className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"><BarChart2 className="h-3 w-3" /></button>
                <button onClick={() => onGenerate(s.email, 'student', 'monthly')} disabled={generating} title="Monthly Report (Parent)"
                  className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"><FileText className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 
   ROOM CARD (used in Batches tab)
    */

function MonitorRoomCard({ room, expanded, onToggle, onRefresh, router }: {
  room: Room; expanded: boolean; onToggle: () => void; onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const badge = STATUS_BADGE[room.status] ?? STATUS_BADGE.scheduled;
  const BadgeIcon = badge.icon;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-border transition-colors">
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={onToggle}>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', badge.bg)}>
          <BadgeIcon className={cn('h-5 w-5', badge.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{room.room_name}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border', badge.bg, badge.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />{room.status}
            </span>
            {!room.teacher_email && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <AlertCircle className="h-2.5 w-2.5" /> No teacher
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{room.subject}</span>
            <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{room.grade}{room.section ? ` \u2014 ${room.section}` : ''}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtSmartDateIST(room.scheduled_start)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{room.duration_minutes}m</span>
            {(room.student_count ?? 0) > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.student_count} student{room.student_count !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {room.status === 'live' && (
            <button onClick={() => router.push(`/classroom/${room.room_id}?mode=observe`)}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
              <Eye className="h-3 w-3" /> Observe
            </button>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">
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
      setMsg(data.success ? `Reminder sent to ${data.data?.sent ?? 0} participants` : `Error: ${data.error}`);
      if (data.success) { fetchDetails(); onRefresh(); }
    } catch { setMsg('Network error'); }
    finally { setNotifying(false); }
  };

  return (
    <div className="border-t border-border bg-background/50 p-4">
      {msg && (
        <div className={cn('mb-4 rounded-lg px-3 py-2 text-xs', msg.startsWith('Reminder') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400')}>{msg}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch Details</h4>
          {[['Subject', room.subject], ['Grade', `${room.grade}${room.section ? ` \u2014 ${room.section}` : ''}`],
            ['Scheduled', fmtDateTimeIST(room.scheduled_start)], ['Duration', `${room.duration_minutes} minutes`]].map(([l, v]) => (
            <div key={l} className="flex items-start gap-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{l}</span>
              <span className="text-foreground">{v}</span>
            </div>
          ))}

          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">Assigned Teacher</p>
            {loadingDetails ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
            ) : teacher ? (
              <div className="flex items-center gap-2">
                <Avatar name={teacher.participant_name} size={7} color="bg-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">{teacher.participant_name}</p>
                  <p className="text-xs text-muted-foreground">{teacher.participant_email}</p>
                  {teacher.notification_sent_at && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-500"><Mail className="h-2.5 w-2.5" /> Notified {fmtDateTimeIST(teacher.notification_sent_at)}</p>}
                  {teacher.joined_at && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-green-400"><UserCheck className="h-2.5 w-2.5" /> Joined {fmtDateTimeIST(teacher.joined_at)}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> No teacher assigned</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</h4>
            {room.status === 'scheduled' && students.length > 0 && (
              <button onClick={handleRemind} disabled={notifying}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {notifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send Reminder
              </button>
            )}
          </div>

          {loadingDetails ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-6 text-center">
              <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No students assigned</p>
            </div>
          ) : (
            <>
              <div className="flex gap-3 text-sm">
                <div className="rounded-lg border border-green-800 bg-green-950/30 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-green-400">{joined.length}</p><p className="text-xs text-muted-foreground">Joined</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-foreground">{notJoined.length}</p><p className="text-xs text-muted-foreground">Not joined</p>
                </div>
                <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 flex-1 text-center">
                  <p className="text-xl font-bold text-amber-400">{notNotified.length}</p><p className="text-xs text-muted-foreground">Unnotified</p>
                </div>
              </div>

              <div className="max-h-52 overflow-auto space-y-1.5">
                {students.map((s) => (
                  <div key={s.participant_email} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', s.joined_at ? 'bg-green-500' : 'bg-muted-foreground')} />
                    <Avatar name={s.participant_name} size={7} color="bg-violet-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.participant_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.participant_email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.joined_at ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-400"><UserCheck className="h-2.5 w-2.5" /> Joined</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><UserX className="h-2.5 w-2.5" /> Absent</span>
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
