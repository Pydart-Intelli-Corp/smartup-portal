// ═══════════════════════════════════════════════════════════════
// HR Associate Dashboard — Client Component
// Uses shared UI components — consistent with Roles screen design
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect, TabBar,
  FormField, FormGrid, Input, Textarea, Select, Modal, Alert,
  TableWrapper, THead, TH, TRow,
  StatCard, StatCardSmall, InfoCard,
  LoadingState, EmptyState, Badge, StatusBadge, RoleBadge, ActiveIndicator,
  useToast, useConfirm, Avatar, money,
} from '@/components/dashboard/shared';
import { fmtDateLongIST, fmtDateTimeIST } from '@/lib/utils';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, UserCheck,
  UserPlus, Search, Eye, EyeOff, Save,
  KeyRound, UserX, UserCheck2, Mail, Phone, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Shield, Award, Briefcase, Pencil,
  XCircle, ClipboardList, CreditCard, Clock, TrendingUp,
  Calendar, DollarSign, FileText, ArrowRight, Ban, Check,
  AlertTriangle, Activity, Zap, X, Trash2,
} from 'lucide-react';
import {
  SUBJECTS, GRADES, BOARDS, GCC_REGIONS, QUALIFICATIONS,
  PwdInput, SubjectSelector, QualificationSelector,
  CredentialsPanel, CreateUserModal,
} from '@/components/dashboard/CreateUserForm';

// ─── Types ──────────────────────────────────────────────────
interface UserRow {
  email: string;
  full_name: string;
  portal_role: string;
  is_active: boolean;
  created_at: string;
  phone?: string;
  whatsapp?: string;
  subjects?: string[];
  grade?: string;
  section?: string;
  board?: string;
  parent_email?: string;
  parent_name?: string;
  qualification?: string;
  experience_years?: number;
  per_hour_rate?: number;
  assigned_region?: string;
  admission_date?: string;
  notes?: string;
  address?: string;
  children?: { name: string; email: string }[];
}

interface Stats {
  counts: Record<string, { total: number; active: number }>;
  recent_users: UserRow[];
  alerts: { students_without_parent: number; teachers_without_subjects: number };
}

interface HRDashboardClientProps {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

// ─── Constants ───────────────────────────────────────────────
type HRTab = 'overview' | 'teachers' | 'students' | 'parents' | 'coordinators' | 'academic_operators' | 'hr_associates' | 'ghost_observers' | 'cancellations' | 'attendance' | 'payroll';

// Constants, PwdInput, SubjectSelector, QualificationSelector, CredentialsPanel,
// CreateUserModal — all imported from @/components/dashboard/CreateUserForm







// ─── Main Dashboard ───────────────────────────────────────────
export default function HRDashboardClient({ userName, userEmail, userRole, permissions }: HRDashboardClientProps) {
  const [tab, setTab] = useState<HRTab>('overview');

  // Sync tab with URL hash (sidebar nav clicks)
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '') as HRTab;
      const valid: HRTab[] = ['overview','teachers','students','parents','coordinators','academic_operators','hr_associates','ghost_observers','cancellations','attendance','payroll'];
      if (hash && valid.includes(hash)) setTab(hash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const tabs = [
    { key: 'overview',           label: 'Overview',           icon: LayoutDashboard },
    { key: 'teachers',           label: 'Teachers',           icon: BookOpen        },
    { key: 'students',           label: 'Students',           icon: GraduationCap   },
    { key: 'parents',            label: 'Parents',            icon: Shield          },
    { key: 'coordinators',       label: 'Coordinators',       icon: UserCheck       },
    { key: 'academic_operators', label: 'Academic Operators',  icon: Briefcase       },
    { key: 'hr_associates',      label: 'HR Associates',       icon: UserCheck       },
    { key: 'ghost_observers',    label: 'Ghost Observers',     icon: Eye             },
    ...(permissions?.cancellations_manage !== false ? [{ key: 'cancellations', label: 'Cancellations', icon: XCircle }] : []),
    ...(permissions?.attendance_view !== false      ? [{ key: 'attendance',    label: 'Attendance',    icon: ClipboardList }] : []),
    ...(permissions?.payroll_manage !== false        ? [{ key: 'payroll',       label: 'Payroll',       icon: CreditCard }] : []),
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="space-y-6">
        <PageHeader icon={Briefcase} title="HR Associate" subtitle="Create accounts, assign roles, issue login credentials" />

        {userRole === 'owner' && (
          <TabBar
            tabs={tabs}
            active={tab}
            onChange={(k) => setTab(k as HRTab)}
          />
        )}

        {tab === 'overview'           && <OverviewTab />}
        {tab === 'teachers'           && <UsersTab role="teacher"           label="Teachers"           permissions={permissions} />}
        {tab === 'students'           && <UsersTab role="student"           label="Students"           permissions={permissions} />}
        {tab === 'parents'            && <UsersTab role="parent"            label="Parents"            permissions={permissions} />}
        {tab === 'coordinators'       && <UsersTab role="coordinator"       label="Coordinators"       permissions={permissions} />}
        {tab === 'academic_operators' && <UsersTab role="academic_operator" label="Academic Operators"  permissions={permissions} />}
        {tab === 'hr_associates'      && <UsersTab role="hr"                label="HR Associates"       permissions={permissions} />}
        {tab === 'ghost_observers'    && <UsersTab role="ghost"             label="Ghost Observers"     permissions={permissions} />}
        {tab === 'cancellations'      && <CancellationsTab />}
        {tab === 'attendance'         && <AttendanceTab />}
        {tab === 'payroll'            && <PayrollTab />}
      </div>
    </DashboardShell>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelPending, setCancelPending] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/hr/stats').then((r) => r.json()),
      fetch('/api/v1/cancellations').then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([statsData, cancelData]) => {
      if (statsData.success) setStats(statsData.data);
      if (cancelData.success) {
        const pending = (cancelData.data?.requests || []).filter((r: { status: string }) => r.status === 'academic_approved').length;
        setCancelPending(pending);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const c = stats?.counts ?? {};
  const totalUsers = Object.values(c).reduce((sum, d) => sum + d.total, 0);
  const totalActive = Object.values(c).reduce((sum, d) => sum + d.active, 0);
  const alertCount = (stats?.alerts.students_without_parent ?? 0) + (stats?.alerts.teachers_without_subjects ?? 0);
  const urgentCount = cancelPending + alertCount;

  return (
    <div className="space-y-6">

      {/* ── Monitoring Priority Banner ── */}
      {urgentCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800">Requires Attention</h3>
              <p className="text-xs text-amber-600">{urgentCount} item{urgentCount !== 1 ? 's' : ''} need your immediate review</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {cancelPending > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{cancelPending} Cancellation{cancelPending !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Awaiting HR final approval</p>
                </div>
              </div>
            )}
            {(stats?.alerts.students_without_parent ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{stats!.alerts.students_without_parent} Student{stats!.alerts.students_without_parent !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Without parent linked</p>
                </div>
              </div>
            )}
            {(stats?.alerts.teachers_without_subjects ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{stats!.alerts.teachers_without_subjects} Teacher{stats!.alerts.teachers_without_subjects !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-500">Without subjects assigned</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Stats — Monitoring at a Glance ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCardSmall icon={Users}         label="Total Users"      value={totalUsers}                      variant="default" />
        <StatCardSmall icon={Activity}      label="Active"           value={totalActive}                     variant="success" />
        <StatCardSmall icon={BookOpen}      label="Teachers"         value={c.teacher?.total ?? 0}           variant="info" />
        <StatCardSmall icon={GraduationCap} label="Students"         value={c.student?.total ?? 0}           variant="info" />
        <StatCardSmall icon={Shield}        label="Parents"          value={c.parent?.total ?? 0}            variant="default" />
        <StatCardSmall icon={UserCheck}     label="Coordinators"     value={c.coordinator?.total ?? 0}       variant="default" />
      </div>

      {/* ── Role Breakdown Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { role: 'teacher',           label: 'Teachers',          icon: BookOpen    },
          { role: 'student',           label: 'Students',          icon: GraduationCap },
          { role: 'parent',            label: 'Parents',           icon: Shield      },
          { role: 'coordinator',       label: 'Coordinators',      icon: UserCheck   },
          { role: 'academic_operator', label: 'Acad. Operators',   icon: Briefcase   },
        ].map(({ role, label, icon: Icon }) => {
          const d = c[role] || { total: 0, active: 0 };
          const inactive = d.total - d.active;
          return (
            <div key={role} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <Icon className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{d.total}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-green-600 font-medium">{d.active} active</span>
                {inactive > 0 && <span className="text-xs text-red-500 font-medium">{inactive} inactive</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Alerts ── */}
      {stats && (stats.alerts.students_without_parent > 0 || stats.alerts.teachers_without_subjects > 0) && (
        <div className="space-y-2">
          {stats.alerts.students_without_parent > 0 && (
            <Alert variant="warning" message={`${stats.alerts.students_without_parent} student${stats.alerts.students_without_parent !== 1 ? 's' : ''} without parent linked — assign parent accounts for proper monitoring`} />
          )}
          {stats.alerts.teachers_without_subjects > 0 && (
            <Alert variant="warning" message={`${stats.alerts.teachers_without_subjects} teacher${stats.alerts.teachers_without_subjects !== 1 ? 's' : ''} without subjects assigned — update teacher profiles`} />
          )}
        </div>
      )}

      {/* ── Recently Added ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Recently Added</h3>
        {stats?.recent_users.length === 0 ? (
          <EmptyState icon={Users} message="No users yet" />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_users.map((u) => (
                  <tr key={u.email} className="border-b border-gray-50 hover:bg-emerald-50/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} size="sm" />
                        <span className="font-medium text-gray-800">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.portal_role} /></td>
                    <td className="px-4 py-3"><ActiveIndicator active={u.is_active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab (Teachers / Students / Parents / Coordinators) ─
function UsersTab({ role, label, permissions }: { role: string; label: string; permissions?: Record<string, boolean> }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const toast = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ role, ...(search ? { q: search } : {}) });
      const res = await fetch(`/api/v1/hr/users?${qs}`);
      const data = await res.json();
      if (data.success) { setUsers(data.data.users); setTotal(data.data.total); }
    } finally { setLoading(false); }
  }, [role, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const canDeactivate = permissions?.users_deactivate !== false;
  const { confirm } = useConfirm();

  const handleDeactivate = async (email: string, isActive: boolean) => {
    const ok = await confirm({
      title: isActive ? 'Deactivate User' : 'Reactivate User',
      message: `${isActive ? 'Deactivate' : 'Reactivate'} ${email}?`,
      confirmLabel: isActive ? 'Deactivate' : 'Reactivate',
      variant: isActive ? 'danger' : 'info',
    });
    if (!ok) return;
    try {
      if (isActive) {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
      }
      toast.success(`User ${isActive ? 'deactivated' : 'reactivated'} successfully`);
      fetchUsers();
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const handlePermanentDelete = async (email: string, name: string) => {
    const ok = await confirm({
      title: 'Permanently Delete User',
      message: `This will permanently delete ${name} (${email}) and all their profile data. This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}?permanent=true`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Failed to delete user'); return; }
      toast.success(`User ${name} permanently deleted`);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const filtered = users.filter(u => {
    if (statusFilter === 'active') return u.is_active;
    if (statusFilter === 'inactive') return !u.is_active;
    return true;
  });

  const activeCount = users.filter(u => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="space-y-4">
      {/* Search + Filters + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${label.toLowerCase()}…`}
        />
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
          <span className="text-xs text-gray-400">{total} total</span>
          <RefreshButton loading={loading} onClick={fetchUsers} />
          <Button variant="primary" icon={UserPlus} onClick={() => setShowCreate(true)}>
            Add {label.slice(0, -1)}
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading && users.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={role === 'teacher' ? BookOpen : role === 'student' ? GraduationCap : role === 'parent' ? Shield : UserCheck}
          message={users.length === 0 ? `No ${label.toLowerCase()} yet — click "Add ${label.slice(0, -1)}" to create the first account` : `No ${label.toLowerCase()} match the selected filter`}
        />
      ) : (
        <TableWrapper
          footer={
            <>
              <span>Showing {filtered.length} of {total} {label.toLowerCase()}</span>
              <span>{activeCount} active · {inactiveCount} inactive</span>
            </>
          }
        >
          <THead>
            <TH>Name</TH>
            <TH>Contact</TH>
            {role === 'teacher' && <TH>Subjects</TH>}
            {role === 'teacher' && <TH>Rate/hr</TH>}
            {role === 'student' && <TH>Grade</TH>}
            {role === 'parent' && <TH>Children</TH>}
            {(role === 'coordinator' || role === 'academic_operator') && <TH>Region</TH>}
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {filtered.map((u) => {
              const isExpanded = expandedEmail === u.email;
              return (
                <React.Fragment key={u.email}>
                  <TRow
                    selected={isExpanded}
                    onClick={() => setExpandedEmail(isExpanded ? null : u.email)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800 truncate max-w-40">{u.full_name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-40">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                      {!u.phone && <span className="text-gray-300">—</span>}
                    </td>
                    {role === 'teacher' && (
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.subjects && u.subjects.length > 0
                          ? u.subjects.slice(0, 2).join(', ') + (u.subjects.length > 2 ? ` +${u.subjects.length - 2}` : '')
                          : <Badge label="No subjects" variant="warning" icon={AlertCircle} />}
                      </td>
                    )}
                    {role === 'teacher' && (
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                        {u.per_hour_rate != null ? `₹${u.per_hour_rate}` : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {role === 'student' && (
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {u.grade ? `${u.grade}${u.section ? ` · ${u.section}` : ''}` : '—'}
                      </td>
                    )}
                    {role === 'parent' && (
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.children && u.children.length > 0
                          ? u.children.map(c => c.name).join(', ')
                          : <span className="text-gray-300">No children linked</span>}
                      </td>
                    )}
                    {(role === 'coordinator' || role === 'academic_operator') && (
                      <td className="px-4 py-3 text-xs text-gray-500">{u.assigned_region || '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <ActiveIndicator active={u.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <IconButton icon={KeyRound} onClick={() => setResetUser(u)} title="Reset password" className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" />
                        <IconButton icon={Pencil} onClick={() => setEditUser(u)} title="Edit" className="text-gray-400 hover:text-emerald-600 hover:bg-emerald-50" />
                        {canDeactivate && (
                          <IconButton
                            icon={u.is_active ? UserX : UserCheck2}
                            onClick={() => handleDeactivate(u.email, u.is_active)}
                            title={u.is_active ? 'Deactivate' : 'Reactivate'}
                            className={u.is_active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}
                          />
                        )}
                        <IconButton
                          icon={Trash2}
                          onClick={() => handlePermanentDelete(u.email, u.full_name)}
                          title="Delete permanently"
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        />
                      </div>
                    </td>
                  </TRow>
                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={role === 'teacher' || role === 'student' || role === 'parent' || role === 'coordinator' || role === 'academic_operator' ? 6 : 5} className="bg-emerald-50/40 border-b border-emerald-100 px-4 py-4">
                        <UserDetailPanel user={u} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </TableWrapper>
      )}

      {/* Modals */}
      <CreateUserModal role={role} open={showCreate} onClose={() => { setShowCreate(false); fetchUsers(); }} onCreated={() => { fetchUsers(); }} />
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  );
}

// ─── Detail Panel (expanded row) ─────────────────────────────
function UserDetailPanel({ user }: { user: UserRow }) {
  type FieldPair = [string, string | number | null | undefined, React.ComponentType<{ className?: string }>?];
  const fields = ([
    ['Email', user.email, Mail],
    ['Phone', user.phone, Phone],
    ['WhatsApp', user.whatsapp, Phone],
    ['Address', user.address, Calendar],
    ['Qualification', user.qualification, Award],
    ['Experience', user.experience_years != null ? `${user.experience_years} years` : null],
    ['Per Hour Rate', user.per_hour_rate != null ? `₹${user.per_hour_rate}/hr` : null, CreditCard],
    ['Subjects', user.subjects?.join(', '), BookOpen],
    ['Grade', user.grade ? `${user.grade}${user.section ? ` · ${user.section}` : ''}` : null, GraduationCap],
    ['Board', user.board],
    ['Parent', user.parent_name || user.parent_email, Shield],
    ['Admission', user.admission_date ? fmtDateLongIST(user.admission_date) : null, Calendar],
    ['Region', user.assigned_region],
    ['Notes', user.notes],
    ['Account created', fmtDateTimeIST(user.created_at), Clock],
  ] as FieldPair[]).filter(([, v]) => v != null && v !== '');

  return (
    <div className="rounded-xl border border-emerald-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
        <Avatar name={user.full_name} size="md" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RoleBadge role={user.portal_role} />
          <ActiveIndicator active={user.is_active} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {fields.map(([label, value, Icon]) => (
          <InfoCard key={label as string} label={label as string} icon={Icon as React.ComponentType<{ className?: string }> & import('lucide-react').LucideIcon | undefined}>
            <p className="text-sm font-medium text-gray-800">{value as string}</p>
          </InfoCard>
        ))}
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: user.phone || '', whatsapp: user.whatsapp || '',
    address: user.address || '',
    qualification: user.qualification || '', notes: user.notes || '',
    subjects: user.subjects || [],
    experience_years: user.experience_years?.toString() || '',
    per_hour_rate: user.per_hour_rate?.toString() || '',
    grade: user.grade || 'Class 10', section: user.section || '',
    board: user.board || 'CBSE', parent_email: user.parent_email || '',
    admission_date: user.admission_date ? user.admission_date.split('T')[0] : '',
    assigned_region: user.assigned_region || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      qualification: form.qualification.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (user.portal_role === 'teacher') {
      payload.subjects = form.subjects;
      payload.experience_years = form.experience_years ? Number(form.experience_years) : null;
      payload.per_hour_rate = form.per_hour_rate ? Math.round(Number(form.per_hour_rate)) : null;
    }
    if (user.portal_role === 'student') {
      payload.grade = form.grade;
      payload.section = form.section.trim() || null;
      payload.board = form.board;
      payload.parent_email = form.parent_email.trim().toLowerCase() || null;
      payload.admission_date = form.admission_date || null;
    }
    if (user.portal_role === 'coordinator') {
      payload.assigned_region = form.assigned_region || null;
    }
    if (user.portal_role === 'academic_operator') {
      payload.assigned_region = form.assigned_region || null;
      payload.experience_years = form.experience_years ? Number(form.experience_years) : null;
    }

    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { toast.success('User updated successfully'); setTimeout(onSaved, 500); }
      else setError(data.error || 'Failed to save');
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${user.full_name}`} subtitle={`${user.email} · ${user.portal_role}`} maxWidth="xl">
      <div className="space-y-4 max-h-[65vh] overflow-auto">
        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}

        <FormField label="Full Name">
          <Input type="text" value={form.full_name} onChange={(e) => f('full_name', e.target.value)} />
        </FormField>

        <FormGrid cols={2}>
          <FormField label="Phone">
            <Input type="tel" value={form.phone} onChange={(e) => f('phone', e.target.value)} />
          </FormField>
          <FormField label="WhatsApp">
            <Input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)} />
          </FormField>
        </FormGrid>

        <FormField label="Address">
          <Textarea rows={2} value={form.address} onChange={(e) => f('address', e.target.value)} placeholder="Full address..." />
        </FormField>

        {user.portal_role === 'teacher' && (
          <>
            <FormField label="Subjects">
              <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Qualification">
                <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
              </FormField>
              <FormField label="Experience (years)">
                <Input type="number" min={0} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormField label="Per Hour Rate" hint="Amount per teaching hour">
              <Input type="number" min={0} step={1} value={form.per_hour_rate} onChange={(e) => f('per_hour_rate', e.target.value)} placeholder="e.g. 500" />
            </FormField>
          </>
        )}

        {user.portal_role === 'student' && (
          <>
            <FormGrid cols={2}>
              <FormField label="Grade">
                <Select value={form.grade} onChange={(v) => f('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
              </FormField>
              <FormField label="Section">
                <Input type="text" value={form.section} onChange={(e) => f('section', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Board">
                <Select value={form.board} onChange={(v) => f('board', v)} options={BOARDS.map(b => ({ value: b, label: b }))} />
              </FormField>
              <FormField label="Admission Date">
                <Input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormField label="Parent Email">
              <Input type="email" value={form.parent_email} onChange={(e) => f('parent_email', e.target.value)} />
            </FormField>
          </>
        )}

        {user.portal_role === 'coordinator' && (
          <>
            <FormField label="Assigned Region">
              <Select value={form.assigned_region} onChange={(v) => f('assigned_region', v)}
                options={GCC_REGIONS.map(r => ({ value: r, label: r }))} placeholder="— Select —" />
            </FormField>
            <FormField label="Qualification">
              <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
            </FormField>
          </>
        )}

        {user.portal_role === 'academic_operator' && (
          <>
            <FormGrid cols={2}>
              <FormField label="Assigned Region">
                <Select value={form.assigned_region} onChange={(v) => f('assigned_region', v)}
                  options={GCC_REGIONS.map(r => ({ value: r, label: r }))} placeholder="— Select —" />
              </FormField>
              <FormField label="Experience (years)">
                <Input type="number" min={0} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} />
              </FormField>
            </FormGrid>
            <FormField label="Qualification">
              <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
            </FormField>
          </>
        )}

        <FormField label="Notes (internal)">
          <Textarea rows={2} value={form.notes} onChange={(e) => f('notes', e.target.value)} />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" icon={Save} onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; new_password?: string } | null>(null);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(user.email)}/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(password.trim() ? { password: password.trim() } : {}),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message || data.error, new_password: data.data?.new_password });
    } catch { setResult({ success: false, message: 'Network error' }); }
    finally { setResetting(false); }
  };

  return (
    <Modal open onClose={onClose} title="Reset Password" subtitle={`${user.full_name} · ${user.email}`} maxWidth="sm">
      {result ? (
        <div className="space-y-4">
          <Alert variant={result.success ? 'success' : 'error'} message={result.message} />
          {result.success && result.new_password && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-gray-500 mb-1">New Password</p>
              <p className="font-mono text-lg font-bold text-emerald-700">{result.new_password}</p>
              <p className="mt-1 text-xs text-gray-400">Also emailed to {user.email}</p>
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password or leave blank to auto-generate a secure password. An email will be sent to the user.
          </p>
          <FormField label="New Password" hint="Optional — auto-generated if blank">
            <PwdInput value={password} onChange={setPassword} placeholder="Leave blank to auto-generate" />
          </FormField>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" icon={KeyRound} onClick={handleReset} loading={resetting}>Reset &amp; Email</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// CANCELLATIONS TAB — HR is final approver for teacher-initiated
// ════════════════════════════════════════════════════════════════

interface CancellationRequest {
  id: string;
  room_id: string;
  room_name: string;
  requested_by: string;
  requester_role: string;
  reason: string;
  cancellation_type: string;
  status: string;
  coordinator_decision: string | null;
  coordinator_email: string | null;
  coordinator_at: string | null;
  admin_decision: string | null;
  admin_email: string | null;
  admin_at: string | null;
  academic_decision: string | null;
  academic_email: string | null;
  academic_at: string | null;
  hr_decision: string | null;
  hr_email: string | null;
  hr_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

function CancellationsTab() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { confirm } = useConfirm();
  const toast = useToast();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cancellations');
      const data = await res.json();
      if (data.success) setRequests(data.data.requests || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    const ok = await confirm({
      title: 'Approve Cancellation',
      message: 'This is the final approval. The class will be cancelled permanently.',
      confirmLabel: 'Approve',
      variant: 'warning',
    });
    if (!ok) return;
    setActionLoading(id);
    try {
      await fetch('/api/v1/cancellations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', requestId: id }),
      });
      toast.success('Cancellation approved');
      fetchRequests();
    } finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch('/api/v1/cancellations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', requestId: id, notes: rejectReason }),
      });
      toast.success('Cancellation rejected');
      setRejectId(null);
      setRejectReason('');
      fetchRequests();
    } finally { setActionLoading(null); }
  };

  const filtered = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending_hr') return r.status === 'academic_approved';
    return r.status === filter || r.cancellation_type === filter;
  });

  const pendingHR = requests.filter(r => r.status === 'academic_approved').length;

  if (loading) return <LoadingState />;

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending_hr', label: `Awaiting HR (${pendingHR})` },
    { key: 'teacher_initiated', label: 'Teacher Initiated' },
    { key: 'parent_initiated', label: 'Parent Initiated' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" /> Class Cancellations
          </h2>
          <p className="text-xs text-gray-500">HR is the final approver for teacher-initiated cancellations</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingHR > 0 && (
            <Badge icon={AlertCircle} label={`${pendingHR} awaiting approval`} variant="warning" />
          )}
          <RefreshButton loading={loading} onClick={fetchRequests} />
        </div>
      </div>

      {/* Filter tabs */}
      <TabBar tabs={filterTabs} active={filter} onChange={setFilter} />

      {/* Requests */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={XCircle}
          message={filter === 'pending_hr' ? 'No requests awaiting HR approval' : 'No cancellation requests match the selected filter'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 space-y-2">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{r.room_name || r.room_id}</span>
                      <StatusBadge status={r.cancellation_type.replace(/_/g, ' ')} />
                      <StatusBadge status={r.status.replace(/_/g, ' ')} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested by <strong>{r.requested_by}</strong> ({r.requester_role}) · {fmtDateTimeIST(r.created_at)}
                    </p>
                    {r.reason && (
                      <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{r.reason}&rdquo;</p>
                    )}
                  </div>

                  {/* Action buttons — HR can approve at academic_approved status */}
                  {r.status === 'academic_approved' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="success" size="sm" icon={Check} onClick={() => handleApprove(r.id)}
                        loading={actionLoading === r.id} disabled={actionLoading === r.id}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" icon={Ban} onClick={() => setRejectId(r.id)}
                        disabled={actionLoading === r.id}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Approval chain for teacher-initiated */}
                {r.cancellation_type === 'teacher_initiated' && (
                  <div className="flex items-center gap-1 text-[10px] flex-wrap mt-1">
                    <span className="text-gray-400 font-medium">Chain:</span>
                    {[
                      { label: 'Coordinator', decision: r.coordinator_decision },
                      { label: 'Admin', decision: r.admin_decision },
                      { label: 'Academic', decision: r.academic_decision },
                      { label: 'HR', decision: r.hr_decision },
                    ].map((step, i) => (
                      <span key={step.label} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-gray-300" />}
                        <span className={`rounded px-1.5 py-0.5 border text-[10px] font-medium ${
                          step.decision === 'approved' ? 'bg-green-50 border-green-200 text-green-700' :
                          step.decision === 'rejected' ? 'bg-red-50 border-red-200 text-red-600' :
                          'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                          {step.label}{step.decision ? ' ✓' : ''}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Rejection reason */}
                {r.status === 'rejected' && r.rejection_reason && (
                  <Alert variant="error" message={`Rejection reason: ${r.rejection_reason}`} />
                )}
              </div>

              {/* Inline reject reason form */}
              {rejectId === r.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                  <FormField label="Reason for rejection">
                    <Textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this cancellation is being rejected..."
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
                    <Button variant="danger" size="sm" icon={Ban} onClick={() => handleReject(r.id)} loading={actionLoading === r.id}>Confirm Rejection</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ATTENDANCE TAB — Aggregate attendance monitoring
// ════════════════════════════════════════════════════════════════

interface AttendanceSummary {
  period_days: number;
  rooms: { total: number; completed: number; cancelled: number };
  students: { total_sessions: number; present: number; late: number; absent: number; avg_duration_min: number };
  teachers: { total_sessions: number; present: number; avg_duration_min: number };
}

interface TeacherAttendance {
  participant_email: string;
  participant_name: string;
  total_classes: string;
  attended: string;
  missed: string;
  late: string;
  avg_duration_sec: string;
}

interface StudentAttendance {
  participant_email: string;
  participant_name: string;
  total_classes: string;
  present: string;
  late: string;
  absent: string;
  avg_duration_sec: string;
  avg_late_sec: string;
}

function AttendanceTab() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [teachers, setTeachers] = useState<TeacherAttendance[]>([]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [subTab, setSubTab] = useState<string>('summary');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, teachRes, stuRes] = await Promise.all([
        fetch(`/api/v1/hr/attendance?resource=summary&days=${days}`),
        fetch(`/api/v1/hr/attendance?resource=by_teacher&days=${days}`),
        fetch(`/api/v1/hr/attendance?resource=by_student&days=${days}`),
      ]);
      const [sumData, teachData, stuData] = await Promise.all([sumRes.json(), teachRes.json(), stuRes.json()]);
      if (sumData.success) setSummary(sumData.data);
      if (teachData.success) setTeachers(teachData.data.teachers || []);
      if (stuData.success) setStudents(stuData.data.students || []);
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingState />;

  const attendSubTabs = [
    { key: 'summary',  label: 'Overview',   icon: LayoutDashboard },
    { key: 'teachers', label: 'Teachers',    icon: BookOpen, count: teachers.length },
    { key: 'students', label: 'Students',    icon: GraduationCap, count: students.length },
  ];

  // Compute rates for monitoring indicators
  const studentRate = summary && summary.students.total_sessions > 0
    ? Math.round((summary.students.present / summary.students.total_sessions) * 100) : 0;
  const absentRate = summary && summary.students.total_sessions > 0
    ? Math.round((summary.students.absent / summary.students.total_sessions) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" /> Attendance Monitor
          </h2>
          <p className="text-xs text-gray-500">Aggregate attendance across all rooms</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '14', label: 'Last 14 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '60', label: 'Last 60 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          <RefreshButton loading={loading} onClick={fetchData} />
        </div>
      </div>

      {/* Monitoring Priority — Attendance Health */}
      {summary && absentRate > 15 && (
        <Alert variant="warning" message={`Student absence rate is ${absentRate}% (${summary.students.absent} absent out of ${summary.students.total_sessions} sessions) — investigate and follow up`} />
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCardSmall icon={Calendar}      label="Total Rooms"      value={summary.rooms.total}           variant="info" />
          <StatCardSmall icon={CheckCircle2}   label="Students Present" value={summary.students.present}      variant="success" />
          <StatCardSmall icon={Clock}          label="Students Late"    value={summary.students.late}         variant="warning" />
          <StatCardSmall icon={UserX}          label="Students Absent"  value={summary.students.absent}       variant="danger" />
          <StatCardSmall icon={BookOpen}       label="Teacher Present"  value={summary.teachers.present}      variant="success" />
          <StatCardSmall icon={TrendingUp}     label="Avg Duration"     value={`${summary.students.avg_duration_min}m`} variant="default" />
        </div>
      )}

      {/* Sub-tabs */}
      <TabBar tabs={attendSubTabs} active={subTab} onChange={setSubTab} />

      {/* Summary view */}
      {subTab === 'summary' && summary && (
        <div className="space-y-4">
          {/* Attendance rate bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Student Attendance Rate</h3>
            {summary.students.total_sessions > 0 ? (
              <>
                <div className="relative h-6 rounded-full bg-gray-100 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-green-500" style={{ width: `${(summary.students.present / summary.students.total_sessions) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-amber-500" style={{ left: `${(summary.students.present / summary.students.total_sessions) * 100}%`, width: `${(summary.students.late / summary.students.total_sessions) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-red-500" style={{ left: `${((summary.students.present + summary.students.late) / summary.students.total_sessions) * 100}%`, width: `${(summary.students.absent / summary.students.total_sessions) * 100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Present {Math.round((summary.students.present / summary.students.total_sessions) * 100)}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late {Math.round((summary.students.late / summary.students.total_sessions) * 100)}%</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Absent {Math.round((summary.students.absent / summary.students.total_sessions) * 100)}%</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">No attendance data in this period</p>
            )}
          </div>

          {/* Room statistics */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Calendar} label="Total Rooms" value={summary.rooms.total} variant="info" />
            <StatCard icon={CheckCircle2} label="Completed" value={summary.rooms.completed} variant="success" />
            <StatCard icon={XCircle} label="Cancelled" value={summary.rooms.cancelled} variant="danger" />
          </div>
        </div>
      )}

      {/* Teachers table */}
      {subTab === 'teachers' && (
        teachers.length === 0 ? (
          <EmptyState icon={BookOpen} message="No teacher attendance data" />
        ) : (
          <TableWrapper
            footer={<span>{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</span>}
          >
            <THead>
              <TH>Teacher</TH>
              <TH className="text-center">Classes</TH>
              <TH className="text-center">Attended</TH>
              <TH className="text-center">Missed</TH>
              <TH className="text-center">Late</TH>
              <TH className="text-center">Avg Duration</TH>
              <TH className="text-center">Rate</TH>
            </THead>
            <tbody>
              {teachers.map(t => {
                const total = Number(t.total_classes);
                const attended = Number(t.attended);
                const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
                return (
                  <TRow key={t.participant_email}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.participant_name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{t.participant_name}</p>
                          <p className="text-xs text-gray-400">{t.participant_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{attended}</td>
                    <td className="px-4 py-3 text-center text-red-500">{t.missed}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{t.late}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{Math.round(Number(t.avg_duration_sec) / 60)}m</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        label={`${rate}%`}
                        variant={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger'}
                      />
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrapper>
        )
      )}

      {/* Students table */}
      {subTab === 'students' && (
        students.length === 0 ? (
          <EmptyState icon={GraduationCap} message="No student attendance data" />
        ) : (
          <TableWrapper
            footer={<span>{students.length} student{students.length !== 1 ? 's' : ''}</span>}
          >
            <THead>
              <TH>Student</TH>
              <TH className="text-center">Classes</TH>
              <TH className="text-center">Present</TH>
              <TH className="text-center">Late</TH>
              <TH className="text-center">Absent</TH>
              <TH className="text-center">Avg Duration</TH>
              <TH className="text-center">Rate</TH>
            </THead>
            <tbody>
              {students.map(s => {
                const total = Number(s.total_classes);
                const present = Number(s.present) + Number(s.late);
                const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <TRow key={s.participant_email}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.participant_name} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{s.participant_name}</p>
                          <p className="text-xs text-gray-400">{s.participant_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{total}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{s.present}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{s.late}</td>
                    <td className="px-4 py-3 text-center text-red-500">{s.absent}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{Math.round(Number(s.avg_duration_sec) / 60)}m</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        label={`${rate}%`}
                        variant={rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger'}
                      />
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrapper>
        )
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAYROLL TAB — Manage pay configs, periods, payslips
// ════════════════════════════════════════════════════════════════

interface PayConfig {
  id: string;
  teacher_email: string;
  teacher_name?: string;
  currency: string;
  per_class_rate_paise: number;
  bonus_per_class_paise: number;
  bonus_threshold_classes: number;
  created_at: string;
}

interface PayrollPeriod {
  id: string;
  label: string;
  period_start: string;
  period_end: string;
  status: string;
  payslip_count: number;
  total_paise: number;
  created_at: string;
}

interface Payslip {
  id: string;
  period_id: string;
  teacher_email: string;
  teacher_name?: string;
  classes_conducted: number;
  classes_cancelled: number;
  classes_missed: number;
  base_pay_paise: number;
  incentive_paise: number;
  lop_paise: number;
  total_paise: number;
  status: string;
}

function PayrollTab() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [configs, setConfigs] = useState<PayConfig[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [paySubTab, setPaySubTab] = useState<string>('periods');
  const [actionLoading, setActionLoading] = useState(false);
  const { confirm } = useConfirm();
  const toast = useToast();

  // Create period form
  const [newPeriod, setNewPeriod] = useState({ label: '', startDate: '', endDate: '' });
  // Config form
  const [configForm, setConfigForm] = useState({ teacherEmail: '', ratePerClass: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/v1/payroll?resource=periods'),
        fetch('/api/v1/payroll?resource=configs'),
      ]);
      const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
      if (pData.success) setPeriods(pData.data.periods || []);
      if (cData.success) setConfigs(cData.data.configs || []);
    } finally { setLoading(false); }
  }, []);

  const fetchPayslips = useCallback(async (periodId: string) => {
    const res = await fetch(`/api/v1/payroll?resource=payslips&periodId=${periodId}`);
    const data = await res.json();
    if (data.success) setPayslips(data.data.payslips || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (selectedPeriod) fetchPayslips(selectedPeriod);
    else setPayslips([]);
  }, [selectedPeriod, fetchPayslips]);

  const handleAction = async (action: string, periodId?: string) => {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { action };
      if (periodId) body.periodId = periodId;
      if (action === 'create_period') {
        body.periodLabel = newPeriod.label;
        body.startDate = newPeriod.startDate;
        body.endDate = newPeriod.endDate;
      }
      if (action === 'set_config') {
        body.teacherEmail = configForm.teacherEmail;
        body.ratePerClass = Number(configForm.ratePerClass) * 100;
      }
      const res = await fetch('/api/v1/payroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${action.replace(/_/g, ' ')} completed`);
        fetchAll();
        if (selectedPeriod) fetchPayslips(selectedPeriod);
        if (action === 'create_period') { setNewPeriod({ label: '', startDate: '', endDate: '' }); setPaySubTab('periods'); }
        if (action === 'set_config') setConfigForm({ teacherEmail: '', ratePerClass: '' });
      } else {
        toast.error(data.error || 'Action failed');
      }
    } finally { setActionLoading(false); }
  };

  if (loading) return <LoadingState />;

  const payTabs = [
    { key: 'periods', label: 'Periods',      icon: Calendar,   count: periods.length },
    { key: 'configs', label: 'Pay Configs',   icon: DollarSign, count: configs.length },
    { key: 'create',  label: 'New Period',    icon: FileText },
  ];

  // Quick monitoring: total pending payroll
  const draftPeriods = periods.filter(p => p.status === 'draft').length;
  const finalizedPeriods = periods.filter(p => p.status === 'finalized').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" /> Payroll Management
          </h2>
          <p className="text-xs text-gray-500">Manage teacher pay, generate payslips, process payroll</p>
        </div>
        <div className="flex items-center gap-2">
          {draftPeriods > 0 && <Badge icon={AlertCircle} label={`${draftPeriods} draft`} variant="warning" />}
          {finalizedPeriods > 0 && <Badge icon={CheckCircle2} label={`${finalizedPeriods} ready to pay`} variant="info" />}
          <RefreshButton loading={loading} onClick={fetchAll} />
        </div>
      </div>

      {/* Sub-tabs */}
      <TabBar tabs={payTabs} active={paySubTab} onChange={setPaySubTab} />

      {/* Periods */}
      {paySubTab === 'periods' && (
        <div className="space-y-3">
          {periods.length === 0 ? (
            <EmptyState icon={Calendar} message="No payroll periods — create one to get started" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {periods.map(p => {
                const isSelected = selectedPeriod === p.id;
                return (
                  <div key={p.id}
                    onClick={() => setSelectedPeriod(isSelected ? null : p.id)}
                    className={`rounded-xl border cursor-pointer transition-all shadow-sm ${
                      isSelected ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200' : 'border-gray-200 bg-white hover:border-emerald-200 hover:shadow-md'
                    }`}>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 text-sm">{p.label}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtDateLongIST(p.period_start)} — {fmtDateLongIST(p.period_end)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-gray-400">{p.payslip_count} payslips</span>
                        <span className="font-semibold text-emerald-700">{money(p.total_paise)}</span>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                        {p.status === 'draft' && (
                          <>
                            <Button variant="primary" size="xs" onClick={async () => {
                              const ok = await confirm({ title: 'Generate Payslips', message: 'Generate payslips for all teachers in this period?', confirmLabel: 'Generate', variant: 'info' });
                              if (ok) handleAction('generate', p.id);
                            }} disabled={actionLoading}>Generate</Button>
                            <Button variant="secondary" size="xs" onClick={async () => {
                              const ok = await confirm({ title: 'Finalize Payroll', message: 'Finalize this payroll period? This cannot be undone.', confirmLabel: 'Finalize', variant: 'warning' });
                              if (ok) handleAction('finalize', p.id);
                            }} disabled={actionLoading}>Finalize</Button>
                          </>
                        )}
                        {p.status === 'finalized' && (
                          <Button variant="success" size="xs" onClick={async () => {
                            const ok = await confirm({ title: 'Mark as Paid', message: 'Mark all payslips as paid?', confirmLabel: 'Mark Paid', variant: 'info' });
                            if (ok) handleAction('mark_paid', p.id);
                          }} disabled={actionLoading}>Mark Paid</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payslips for selected period */}
          {selectedPeriod && payslips.length > 0 && (
            <TableWrapper
              footer={
                <>
                  <span>{payslips.length} payslip{payslips.length !== 1 ? 's' : ''}</span>
                  <span>Total: {money(payslips.reduce((s, p) => s + p.total_paise, 0))}</span>
                </>
              }
            >
              <THead>
                <TH>Teacher</TH>
                <TH className="text-center">Classes</TH>
                <TH className="text-center">Cancelled</TH>
                <TH className="text-center">Missed</TH>
                <TH className="text-right">Base</TH>
                <TH className="text-right">Incentive</TH>
                <TH className="text-right">LOP</TH>
                <TH className="text-right">Total</TH>
              </THead>
              <tbody>
                {payslips.map(s => (
                  <TRow key={s.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.teacher_name || s.teacher_email} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{s.teacher_name || s.teacher_email}</p>
                          <p className="text-xs text-gray-400">{s.teacher_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{s.classes_conducted}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{s.classes_cancelled}</td>
                    <td className="px-4 py-3 text-center text-red-500">{s.classes_missed}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{money(s.base_pay_paise)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{s.incentive_paise > 0 ? `+${money(s.incentive_paise)}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-red-500">{s.lop_paise > 0 ? `-${money(s.lop_paise)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{money(s.total_paise)}</td>
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </div>
      )}

      {/* Pay configs */}
      {paySubTab === 'configs' && (
        <div className="space-y-4">
          {/* Add config form */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Set Teacher Pay Rate</h3>
            <FormGrid cols={3}>
              <FormField label="Teacher Email">
                <Input type="email" value={configForm.teacherEmail}
                  onChange={(e) => setConfigForm(f => ({ ...f, teacherEmail: e.target.value }))}
                  placeholder="teacher@email.com" />
              </FormField>
              <FormField label="Rate Per Class (₹)">
                <Input type="number" min={0} step={0.01} value={configForm.ratePerClass}
                  onChange={(e) => setConfigForm(f => ({ ...f, ratePerClass: e.target.value }))}
                  placeholder="e.g. 500" />
              </FormField>
              <div className="flex items-end">
                <Button variant="primary" className="w-full" onClick={() => handleAction('set_config')}
                  disabled={actionLoading || !configForm.teacherEmail || !configForm.ratePerClass}
                  loading={actionLoading}>
                  Set Rate
                </Button>
              </div>
            </FormGrid>
          </div>

          {/* Configs table */}
          {configs.length === 0 ? (
            <EmptyState icon={DollarSign} message="No pay configurations" />
          ) : (
            <TableWrapper footer={<span>{configs.length} configuration{configs.length !== 1 ? 's' : ''}</span>}>
              <THead>
                <TH>Teacher</TH>
                <TH className="text-right">Per Class</TH>
                <TH className="text-right">Bonus/Class</TH>
                <TH className="text-center">Threshold</TH>
                <TH className="text-right">Set On</TH>
              </THead>
              <tbody>
                {configs.map(c => (
                  <TRow key={c.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.teacher_name || c.teacher_email} size="sm" />
                        <div>
                          <p className="font-medium text-gray-800">{c.teacher_name || c.teacher_email}</p>
                          <p className="text-xs text-gray-400">{c.teacher_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{money(c.per_class_rate_paise)}</td>
                    <td className="px-4 py-3 text-right text-teal-600">{money(c.bonus_per_class_paise)}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{c.bonus_threshold_classes} classes</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{fmtDateLongIST(c.created_at)}</td>
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </div>
      )}

      {/* Create period */}
      {paySubTab === 'create' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-md shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Create Payroll Period</h3>
          <FormField label="Period Label">
            <Input type="text" value={newPeriod.label}
              onChange={(e) => setNewPeriod(p => ({ ...p, label: e.target.value }))}
              placeholder="e.g. January 2025" />
          </FormField>
          <FormGrid cols={2}>
            <FormField label="Start Date">
              <Input type="date" value={newPeriod.startDate}
                onChange={(e) => setNewPeriod(p => ({ ...p, startDate: e.target.value }))} />
            </FormField>
            <FormField label="End Date">
              <Input type="date" value={newPeriod.endDate}
                onChange={(e) => setNewPeriod(p => ({ ...p, endDate: e.target.value }))} />
            </FormField>
          </FormGrid>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setPaySubTab('periods')}>Cancel</Button>
            <Button variant="primary" className="flex-1" icon={FileText}
              onClick={() => handleAction('create_period')}
              disabled={actionLoading || !newPeriod.label || !newPeriod.startDate || !newPeriod.endDate}
              loading={actionLoading}>
              Create Period
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
