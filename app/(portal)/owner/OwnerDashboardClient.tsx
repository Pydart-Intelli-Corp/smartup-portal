// ═══════════════════════════════════════════════════════════════
// Owner Dashboard — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST } from '@/lib/utils';
import {
  PageHeader, RefreshButton, SearchInput, FilterSelect,
  TableWrapper, THead, TH, TRow,
  StatCardSmall, StatusBadge as SharedStatusBadge,
  RoleBadge, ROLE_CONFIG, Avatar, Button,
  LoadingState,
} from '@/components/dashboard/shared';
import {
  LayoutDashboard, Users, Shield, Calendar, Clock, Radio,
  Activity, Database, Eye, CreditCard, Briefcase, BarChart3,
  BookOpen, GraduationCap, UserCheck, ChevronRight,
  XCircle, CheckCircle2, Bell,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

/* ─── Types ─── */
interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  coordinator_email: string;
  teacher_email: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  student_count?: number;
}

interface UserStat { role: string; count: number; }
interface DailyClass { date: string; total: number; conducted: number; cancelled: number; }
interface SubjectDist { subject: string; count: number; }
interface RecentUser { email: string; display_name: string; portal_role: string; created_at: string; }

interface DashboardData {
  summary: {
    totalBatches: number;
    liveBatches: number;
    scheduledBatches: number;
    completedBatches: number;
    cancelledBatches: number;
    totalUsers: number;
    cancelledLast30: number;
  };
  usersByRole: UserStat[];
  rooms: Room[];
  dailyClasses: DailyClass[];
  subjectDistribution: SubjectDist[];
  gradeDistribution: { grade: string; count: number }[];
  recentUsers: RecentUser[];
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

/* ─── Chart palette ─── */
const COLORS = ['#22C55E', '#14B8A6', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

const ROLE_ICON_MAP: Record<string, React.ElementType> = {
  coordinator: Users,
  batch_coordinator: Users,
  academic_operator: UserCheck,
  hr: Briefcase,
  teacher: BookOpen,
  student: GraduationCap,
  parent: Shield,
  owner: LayoutDashboard,
  ghost: Eye,
};

function fmtRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Treat 'live' rooms past their end time as 'ended' (safety net). */
function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-semibold text-gray-800">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function OwnerDashboardClient({ userName, userEmail, userRole }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/owner/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary;
  const rooms = data?.rooms || [];
  const live = rooms.filter((r) => effectiveStatus(r) === 'live');
  const filteredRooms = rooms.filter((r) => {
    const matchSearch = !searchTerm ||
      r.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.coordinator_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || effectiveStatus(r) === statusFilter;
    return matchSearch && matchStatus;
  });

  const dailyChartData = (data?.dailyClasses || []).map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  }));

  /* ─── Loading skeleton ─── */
  if (loading && !data) {
    return (
      <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded-lg bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-gray-100" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-72 rounded-xl bg-gray-100" />
            <div className="h-72 rounded-xl bg-gray-100" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {userName.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening across SmartUp today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton loading={loading} onClick={fetchData} />
          <button className="relative flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 shadow-sm hover:bg-gray-50 transition-colors">
            <Bell className="h-4 w-4 text-gray-500" />
            {live.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {live.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Batches" value={summary?.totalBatches || 0} icon={Database} variant="primary" pulse={false} />
        <KpiCard label="Live Now" value={summary?.liveBatches || 0} icon={Radio} variant="success" pulse={!!summary?.liveBatches} />
        <KpiCard label="Total Users" value={summary?.totalUsers || 0} icon={Users} variant="info" pulse={false} />
        <KpiCard label="Cancelled (30d)" value={summary?.cancelledLast30 || 0} icon={XCircle} variant="danger" pulse={false} />
      </div>

      {/* Status Mini-Cards */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCardSmall icon={Calendar} label="Scheduled" value={summary?.scheduledBatches || 0} variant="info" />
        <StatCardSmall icon={CheckCircle2} label="Completed" value={summary?.completedBatches || 0} variant="success" />
        <StatCardSmall icon={Radio} label="Live" value={summary?.liveBatches || 0} variant="success" />
        <StatCardSmall icon={XCircle} label="Cancelled" value={summary?.cancelledBatches || 0} variant="danger" />
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Area Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Class Activity (30 Days)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Daily conducted vs cancelled classes</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Conducted</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Cancelled</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradConducted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradCancelled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="conducted" name="Conducted" stroke="#22C55E" strokeWidth={2} fill="url(#gradConducted)" />
              <Area type="monotone" dataKey="cancelled" name="Cancelled" stroke="#EF4444" strokeWidth={1.5} fill="url(#gradCancelled)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Subject Distribution</h3>
          <p className="text-xs text-gray-400 mb-3">Batches by subject</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data?.subjectDistribution || []} dataKey="count" nameKey="subject" cx="50%" cy="50%" outerRadius={75} innerRadius={40} strokeWidth={2} stroke="#fff">
                {(data?.subjectDistribution || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {(data?.subjectDistribution || []).slice(0, 5).map((s, i) => (
              <span key={s.subject} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {s.subject}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row: Grade bar + Users by Role */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Batches by Grade</h3>
          <p className="text-xs text-gray-400 mb-3">Distribution across grade levels</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.gradeDistribution || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Batches" fill="#14B8A6" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Users by Role</h3>
              <p className="text-xs text-gray-400 mt-0.5">{summary?.totalUsers || 0} total active users</p>
            </div>
            <a href="/owner/users" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(data?.usersByRole || []).map((u) => {
              const Icon = ROLE_ICON_MAP[u.role] || Users;
              const cfg = ROLE_CONFIG[u.role];
              const colorCls = cfg ? `${cfg.bg} ${cfg.color} border-gray-200` : 'bg-gray-50 text-gray-500 border-gray-200';
              return (
                <div key={u.role} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${colorCls}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight">{u.count}</p>
                    <p className="text-[11px] opacity-70 capitalize">{fmtRole(u.role)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Classes Alert */}
      {live.length > 0 && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold text-green-800">
              {live.length} Live {live.length === 1 ? 'Class' : 'Classes'} in Progress
            </h3>
          </div>
          <div className="space-y-2">
            {live.map((room) => (
              <div key={room.room_id} className="flex items-center gap-3 rounded-lg bg-white border border-green-100 p-3">
                <div className="relative">
                  <Radio className="h-5 w-5 text-green-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 animate-ping" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{room.room_name}</p>
                  <p className="text-xs text-gray-500">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <Button variant="success" size="sm" icon={Eye} onClick={() => window.location.href = `/classroom/${room.room_id}?mode=ghost`}>
                  Ghost View
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Batches Table */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Recent Batches</h3>
            <p className="text-xs text-gray-400 mt-0.5">Latest {filteredRooms.length} of {rooms.length} batches</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search batches..." className="w-48" />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'live', label: 'Live' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'ended', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <THead>
            <TH>Batch</TH>
            <TH>Subject</TH>
            <TH>Grade</TH>
            <TH>Coordinator</TH>
            <TH>Teacher</TH>
            <TH className="text-center">Students</TH>
            <TH>Status</TH>
            <TH>Scheduled</TH>
          </THead>
          <tbody className="divide-y divide-gray-100">
            {filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {rooms.length === 0 ? 'No batches in the system yet' : 'No batches match your filter'}
                </td>
              </tr>
            ) : (
              filteredRooms.slice(0, 25).map((room) => (
                <TRow key={room.room_id}>
                  <td className="px-4 py-3"><p className="font-medium text-gray-800 truncate max-w-45">{room.room_name}</p></td>
                  <td className="px-4 py-3 text-gray-600">{room.subject || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{room.grade || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-35">{room.coordinator_email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-35">{room.teacher_email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-center">{room.student_count || 0}</td>
                  <td className="px-4 py-3"><SharedStatusBadge status={effectiveStatus(room)} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateBriefIST(new Date(room.scheduled_start))}</div>
                  </td>
                </TRow>
              ))
            )}
          </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          <span>Showing {filteredRooms.length} of {rooms.length} batches</span>
        </div>
      </div>

      {/* Recent Users */}
      {(data?.recentUsers?.length || 0) > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Recently Added Users</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest team members and students</p>
            </div>
            <a href="/hr" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
              HR Panel <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {data!.recentUsers.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                <Avatar name={u.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <RoleBadge role={u.portal_role} />
                <span className="text-[11px] text-gray-400">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="/owner/fees" icon={CreditCard} label="Fee Management" desc="Invoices & payments" variant="warning" />
          <QuickLink href="/owner/reports" icon={BarChart3} label="Reports" desc="Analytics & exports" variant="primary" />
          <QuickLink href="/hr" icon={Briefcase} label="HR & Payroll" desc="Staff management" variant="info" />
          <QuickLink href="/ghost" icon={Eye} label="Ghost Mode" desc="Silent class monitoring" variant="default" />
        </div>
      </div>
    </DashboardShell>
  );
}

/* ═══ Sub-components (dashboard-specific) ═══ */

const KPI_VARIANTS: Record<string, { icon: string; light: string }> = {
  primary: { icon: 'text-emerald-500', light: 'bg-emerald-50' },
  success: { icon: 'text-green-500', light: 'bg-green-50' },
  info:    { icon: 'text-teal-500', light: 'bg-teal-50' },
  warning: { icon: 'text-amber-500', light: 'bg-amber-50' },
  danger:  { icon: 'text-red-500', light: 'bg-red-50' },
};

function KpiCard({ label, value, icon: Icon, variant = 'primary', pulse }: {
  label: string; value: number; icon: React.ElementType; variant?: string; pulse: boolean;
}) {
  const v = KPI_VARIANTS[variant] || KPI_VARIANTS.primary;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${v.light}`}>
          <Icon className={`h-5 w-5 ${v.icon}`} />
        </div>
        {pulse && (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

const QUICK_VARIANT: Record<string, string> = {
  primary: 'bg-emerald-50 text-emerald-600',
  info:    'bg-teal-50 text-teal-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-600',
  success: 'bg-green-50 text-green-600',
  default: 'bg-gray-50 text-gray-600',
};

function QuickLink({ href, icon: Icon, label, desc, variant = 'primary' }: {
  href: string; icon: React.ElementType; label: string; desc: string; variant?: string;
}) {
  const color = QUICK_VARIANT[variant] || QUICK_VARIANT.primary;
  return (
    <a href={href} className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 hover:border-emerald-200 hover:shadow-md transition-all">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700 transition-colors">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </a>
  );
}
