// ═══════════════════════════════════════════════════════════════
// HR Associate Dashboard — Client Component
// Create & manage teachers, students, parents, coordinators.
// Issue login credentials. All per PDF scope: HR manages staff.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateLongIST, fmtDateTimeIST } from '@/lib/utils';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, UserCheck,
  UserPlus, RefreshCw, Search, X, Loader2, Eye, EyeOff, Save,
  KeyRound, UserX, UserCheck2, Mail, Phone, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, Shield, Award, Briefcase, Pencil,
} from 'lucide-react';

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
  assigned_region?: string;
  admission_date?: string;
  notes?: string;
  date_of_birth?: string;
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
}

// ─── Constants ───────────────────────────────────────────────
type HRTab = 'overview' | 'teachers' | 'students' | 'parents' | 'coordinators' | 'academic_operators';

const SUBJECTS = [
  'Mathematics','Science','Physics','Chemistry','Biology',
  'English','Hindi','Social Science','Computer Science',
  'Economics','Commerce','Accountancy','History','Geography',
  'Sanskrit','Environmental Science','Physical Education','Music','Art',
];
const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const BOARDS = ['CBSE','ICSE','State Board','IB','Cambridge','Others'];
const GCC_REGIONS = ['Dubai','Abu Dhabi','Sharjah','Ajman','Qatar','Saudi Arabia','Oman','Kuwait','Bahrain','Other'];

// ─── Helpers ─────────────────────────────────────────────────
function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  teacher: 'bg-emerald-600', student: 'bg-violet-600',
  parent: 'bg-rose-600', coordinator: 'bg-blue-600',
  academic_operator: 'bg-amber-600',
};

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      active ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'
    }`}>
      {active ? <><CheckCircle2 className="h-2.5 w-2.5" /> Active</> : <><UserX className="h-2.5 w-2.5" /> Inactive</>}
    </span>
  );
}

// ─── Password Input ───────────────────────────────────────────
function PwdInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Leave blank to auto-generate'}
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Subject Pills Selector ───────────────────────────────────
function SubjectSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const toggle = (s: string) => {
    if (selected.includes(s)) onChange(selected.filter((x) => x !== s));
    else onChange([...selected, s]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUBJECTS.map((s) => (
        <button type="button" key={s} onClick={() => toggle(s)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            selected.includes(s) ? 'bg-emerald-700 text-white' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}>{s}</button>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function HRDashboardClient({ userName, userEmail, userRole }: HRDashboardClientProps) {
  const [tab, setTab] = useState<HRTab>('overview');

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={[
      { label: 'Dashboard', href: '/hr', icon: LayoutDashboard, active: true },
    ]}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">HR Associate</h1>
        <p className="text-sm text-muted-foreground">Create accounts, assign roles, issue login credentials</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1.5 flex-wrap border-b border-border pb-3">
        {([
          { key: 'overview',           label: 'Overview',          icon: LayoutDashboard },
          { key: 'teachers',           label: 'Teachers',          icon: BookOpen        },
          { key: 'students',           label: 'Students',          icon: GraduationCap   },
          { key: 'parents',            label: 'Parents',           icon: Shield          },
          { key: 'coordinators',       label: 'Coordinators',      icon: UserCheck       },
          { key: 'academic_operators', label: 'Academic Operators',icon: Briefcase       },
        ] as { key: HRTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-teal-700 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'overview'           && <OverviewTab />}
      {tab === 'teachers'           && <UsersTab role="teacher"           label="Teachers"          />}
      {tab === 'students'           && <UsersTab role="student"           label="Students"          />}
      {tab === 'parents'            && <UsersTab role="parent"            label="Parents"           />}
      {tab === 'coordinators'       && <UsersTab role="coordinator"       label="Coordinators"      />}
      {tab === 'academic_operators' && <UsersTab role="academic_operator" label="Academic Operators" />}
    </DashboardShell>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/hr/stats').then((r) => r.json()).then((d) => {
      if (d.success) setStats(d.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading stats...
      </div>
    );
  }

  const c = stats?.counts ?? {};

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { role: 'teacher',           label: 'Teachers',          icon: BookOpen,     color: 'border-emerald-700 text-emerald-400' },
          { role: 'student',           label: 'Students',          icon: GraduationCap,color: 'border-violet-700  text-violet-400'  },
          { role: 'parent',            label: 'Parents',           icon: Shield,       color: 'border-rose-700    text-rose-400'    },
          { role: 'coordinator',       label: 'Coordinators',      icon: UserCheck,    color: 'border-blue-700    text-blue-400'    },
          { role: 'academic_operator', label: 'Acad. Operators',   icon: Briefcase,    color: 'border-amber-700   text-amber-400'   },
        ].map(({ role, label, icon: Icon, color }) => {
          const d = c[role] || { total: 0, active: 0 };
          return (
            <div key={role} className={`rounded-xl border ${color.split(' ')[0]} bg-card/60 p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${color.split(' ')[1]}`} />
              </div>
              <p className={`text-3xl font-bold ${color.split(' ')[1]}`}>{d.total}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.active} active</p>
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {stats && (stats.alerts.students_without_parent > 0 || stats.alerts.teachers_without_subjects > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention Required</h3>
          {stats.alerts.students_without_parent > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                <strong>{stats.alerts.students_without_parent}</strong> student{stats.alerts.students_without_parent !== 1 ? 's' : ''} without parent linked
              </p>
            </div>
          )}
          {stats.alerts.teachers_without_subjects > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                <strong>{stats.alerts.teachers_without_subjects}</strong> teacher{stats.alerts.teachers_without_subjects !== 1 ? 's' : ''} without subjects assigned
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent users */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recently Added</h3>
        {stats?.recent_users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users yet</p>
        ) : (
          <div className="space-y-1.5">
            {stats?.recent_users.map((u) => (
              <div key={u.email} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <Avatar name={u.full_name} color={ROLE_COLOR[u.portal_role] || 'bg-muted'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold capitalize ${
                    u.portal_role === 'teacher' ? 'text-emerald-400' :
                    u.portal_role === 'student' ? 'text-violet-400' :
                    u.portal_role === 'parent' ? 'text-rose-400' : 'text-blue-400'
                  }`}>{u.portal_role}</span>
                  <Badge active={u.is_active} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab (Teachers / Students / Parents / Coordinators) ─
function UsersTab({ role, label }: { role: string; label: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

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

  const handleDeactivate = async (email: string, isActive: boolean) => {
    if (!confirm(`${isActive ? 'Deactivate' : 'Reactivate'} ${email}?`)) return;
    if (isActive) {
      await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
    }
    fetchUsers();
  };

  const icon = role === 'teacher' ? BookOpen : role === 'student' ? GraduationCap : role === 'parent' ? Shield : UserCheck;
  const Icon = icon;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder={`Search ${label.toLowerCase()}...`} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{total} total</span>
          <button onClick={fetchUsers} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add {label.slice(0, -1)}
          </button>
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Icon className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-foreground/80 font-medium">No {label.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Click &ldquo;Add {label.slice(0, -1)}&rdquo; to create the first account</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.email} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedEmail(expandedEmail === u.email ? null : u.email)}>
                <Avatar name={u.full_name} color={ROLE_COLOR[u.portal_role] || 'bg-muted'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{u.full_name}</span>
                    <Badge active={u.is_active} />
                  </div>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                    {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                    {u.subjects && u.subjects.length > 0 && (
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{u.subjects.slice(0, 2).join(', ')}{u.subjects.length > 2 ? ` +${u.subjects.length - 2}` : ''}</span>
                    )}
                    {u.grade && <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{u.grade}{u.section ? ` · ${u.section}` : ''}</span>}
                    {u.parent_name && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Parent: {u.parent_name}</span>}
                    {u.assigned_region && <span>{u.assigned_region}</span>}
                    {u.qualification && <span className="flex items-center gap-1"><Award className="h-3 w-3" />{u.qualification}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setResetUser(u)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-teal-400 transition-colors" title="Reset password">
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditUser(u)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeactivate(u.email, u.is_active)}
                    className={`rounded p-1.5 transition-colors ${u.is_active
                      ? 'text-muted-foreground hover:bg-red-950/50 hover:text-red-400'
                      : 'text-muted-foreground hover:bg-green-950/50 hover:text-green-400'}`}
                    title={u.is_active ? 'Deactivate' : 'Reactivate'}>
                    {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="text-muted-foreground/60 shrink-0">
                  {expandedEmail === u.email ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </div>
              {expandedEmail === u.email && <UserDetailPanel user={u} />}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateUserModal role={role} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchUsers(); }} />
      )}
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
  type FieldPair = [string, string | number | null | undefined];
  const fields = ([
    ['Email', user.email],
    ['Phone', user.phone],
    ['WhatsApp', user.whatsapp],
    ['Date of Birth', user.date_of_birth ? fmtDateLongIST(user.date_of_birth) : null],
    ['Qualification', user.qualification],
    ['Experience', user.experience_years != null ? `${user.experience_years} years` : null],
    ['Subjects', user.subjects?.join(', ')],
    ['Grade', user.grade ? `${user.grade}${user.section ? ` · ${user.section}` : ''}` : null],
    ['Board', user.board],
    ['Parent', user.parent_name || user.parent_email],
    ['Admission', user.admission_date ? fmtDateLongIST(user.admission_date) : null],
    ['Region', user.assigned_region],
    ['Notes', user.notes],
    ['Account created', fmtDateTimeIST(user.created_at)],
  ] as FieldPair[]).filter(([, v]) => v != null && v !== '');

  return (
    <div className="border-t border-border bg-background/50 px-4 py-3">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-start gap-2 text-xs">
            <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
            <span className="text-foreground/80">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Credentials Success Panel ────────────────────────────────
function CredentialsPanel({
  name, email, password, role, onDone, onAddAnother,
}: {
  name: string; email: string; password: string; role: string;
  onDone: () => void; onAddAnother: () => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const copy = async (text: string, which: 'email' | 'pwd') => {
    await navigator.clipboard.writeText(text);
    if (which === 'email') { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
    else                   { setCopiedPwd(true);   setTimeout(() => setCopiedPwd(false), 2000); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900/60 border border-green-700">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Account Created Successfully</p>
          <p className="text-xs text-muted-foreground">Credentials have been emailed to {name}</p>
        </div>
      </div>

      {/* Credential Cards */}
      <div className="rounded-xl border border-border bg-background divide-y divide-border overflow-hidden">
        {/* Name + Role */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account Holder</p>
            <p className="mt-0.5 font-medium text-foreground">{name}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
            role === 'teacher' ? 'border-emerald-700 text-emerald-400 bg-emerald-950/40' :
            role === 'student' ? 'border-violet-700  text-violet-400  bg-violet-950/40'  :
            role === 'parent'  ? 'border-rose-700    text-rose-400    bg-rose-950/40'    :
            role === 'coordinator' ? 'border-blue-700 text-blue-400  bg-blue-950/40'     :
            'border-amber-700 text-amber-400 bg-amber-950/40'
          }`}>{role.replace('_', ' ')}</span>
        </div>

        {/* Email */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Login Email</p>
            <p className="mt-0.5 font-mono text-sm text-teal-300 truncate">{email}</p>
          </div>
          <button onClick={() => copy(email, 'email')}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              copiedEmail ? 'border-green-700 text-green-400' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}>
            {copiedEmail ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : 'Copy'}
          </button>
        </div>

        {/* Password */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Temporary Password</p>
            <p className="mt-0.5 font-mono text-base font-bold tracking-widest text-foreground">{password}</p>
          </div>
          <button onClick={() => copy(password, 'pwd')}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              copiedPwd ? 'border-green-700 text-green-400' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}>
            {copiedPwd ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : 'Copy'}
          </button>
        </div>
      </div>

      {/* Email sent notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-teal-800 bg-teal-950/30 px-3 py-2.5">
        <Mail className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
        <p className="text-xs text-teal-300">
          An email with these credentials has been sent to <strong>{email}</strong>.
          The user should change their password after first login.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onAddAnother}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:border-border/80 transition-colors">
          <UserPlus className="h-4 w-4" /> Add Another
        </button>
        <button onClick={onDone}
          className="flex-1 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────
function CreateUserModal({ role, onClose, onCreated }: { role: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '', full_name: '', password: '',
    phone: '', whatsapp: '', date_of_birth: '', qualification: '', notes: '', experience_years: '',
    subjects: [] as string[],
    grade: 'Class 10', section: '', board: 'CBSE', parent_email: '', admission_date: '',
    assigned_region: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const resetForm = () => setForm({
    email: '', full_name: '', password: '',
    phone: '', whatsapp: '', date_of_birth: '', qualification: '', notes: '', experience_years: '',
    subjects: [], grade: 'Class 10', section: '', board: 'CBSE',
    parent_email: '', admission_date: '', assigned_region: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.full_name.trim()) { setError('Email and name are required'); return; }

    const payload: Record<string, unknown> = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      portal_role: role,
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.whatsapp.trim() ? { whatsapp: form.whatsapp.trim() } : {}),
      ...(form.date_of_birth ? { date_of_birth: form.date_of_birth } : {}),
      ...(form.qualification.trim() ? { qualification: form.qualification.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    if (role === 'teacher') {
      if (form.subjects.length > 0) payload.subjects = form.subjects;
      if (form.experience_years) payload.experience_years = Number(form.experience_years);
    }
    if (role === 'student') {
      payload.grade = form.grade;
      if (form.section.trim()) payload.section = form.section.trim();
      payload.board = form.board;
      if (form.parent_email.trim()) payload.parent_email = form.parent_email.trim().toLowerCase();
      if (form.admission_date) payload.admission_date = form.admission_date;
    }
    if (role === 'coordinator') {
      if (form.assigned_region) payload.assigned_region = form.assigned_region;
    }
    if (role === 'academic_operator') {
      if (form.assigned_region) payload.assigned_region = form.assigned_region;
      if (form.experience_years) payload.experience_years = Number(form.experience_years);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/hr/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to create account'); return; }
      setCreated({
        name: data.data.full_name,
        email: data.data.email,
        password: data.data.temp_password || '(emailed)',
      });
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  const roleLabels: Record<string, string> = {
    teacher: 'Teacher', student: 'Student', parent: 'Parent',
    coordinator: 'Batch Coordinator', academic_operator: 'Academic Operator',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">

        {/* ── Success: Credentials Panel ── */}
        {created ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-bold text-foreground">Credentials Issued</h2>
              <button onClick={() => { onCreated(); onClose(); }}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <CredentialsPanel
              name={created.name}
              email={created.email}
              password={created.password}
              role={role}
              onDone={() => { onCreated(); onClose(); }}
              onAddAnother={() => { setCreated(null); resetForm(); }}
            />
          </>
        ) : (
          <>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Create {roleLabels[role] || role} Account</h2>
            <p className="text-xs text-muted-foreground">Credentials will be emailed automatically</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-auto">
          {error && <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2.5 text-sm text-red-400">{error}</div>}

          {/* Common fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
              <input type="text" required value={form.full_name} onChange={(e) => f('full_name', e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email Address *</label>
              <input type="email" required value={form.email} onChange={(e) => f('email', e.target.value)}
                placeholder="e.g. priya@gmail.com"
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Password <span className="text-muted-foreground/60">(optional — auto-generated if blank)</span></label>
            <div className="mt-1"><PwdInput value={form.password} onChange={(v) => f('password', v)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => f('phone', e.target.value)}
                placeholder="+971 50 123 4567"
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)}
                placeholder="+971 50 123 4567"
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
            </div>
          </div>

          {/* Teacher-specific */}
          {role === 'teacher' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subjects <span className="text-muted-foreground/60">(select all that apply)</span></label>
                <div className="mt-2">
                  <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                  <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                    placeholder="e.g. M.Sc Mathematics"
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Experience (years)</label>
                  <input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {/* Student-specific */}
          {role === 'student' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Grade *</label>
                  <select value={form.grade} onChange={(e) => f('grade', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    {GRADES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Section / Batch</label>
                  <input type="text" value={form.section} onChange={(e) => f('section', e.target.value)}
                    placeholder="e.g. A, Morning"
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Board *</label>
                  <select value={form.board} onChange={(e) => f('board', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    {BOARDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Admission Date</label>
                  <input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Parent Email <span className="text-muted-foreground/60">(must exist in system)</span></label>
                <input type="email" value={form.parent_email} onChange={(e) => f('parent_email', e.target.value)}
                  placeholder="parent@gmail.com — create parent account first"
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </>
          )}

          {/* Coordinator-specific */}
          {role === 'coordinator' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assigned Region (GCC)</label>
                <select value={form.assigned_region} onChange={(e) => f('assigned_region', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                  <option value="">— Select —</option>
                  {GCC_REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                  placeholder="e.g. B.Ed"
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </div>
          )}

          {/* Academic Operator-specific */}
          {role === 'academic_operator' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Assigned Region (GCC)</label>
                  <select value={form.assigned_region} onChange={(e) => f('assigned_region', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    <option value="">— Select —</option>
                    {GCC_REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Experience (years)</label>
                  <input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                  placeholder="e.g. MBA, B.Ed, M.Sc"
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => f('date_of_birth', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes (internal)</label>
            <textarea rows={2} value={form.notes} onChange={(e) => f('notes', e.target.value)}
              placeholder="Any internal HR notes..."
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><UserPlus className="h-4 w-4" /> Create &amp; Send Credentials</>}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: user.phone || '', whatsapp: user.whatsapp || '',
    date_of_birth: user.date_of_birth ? user.date_of_birth.split('T')[0] : '',
    qualification: user.qualification || '', notes: user.notes || '',
    subjects: user.subjects || [],
    experience_years: user.experience_years?.toString() || '',
    grade: user.grade || 'Class 10', section: user.section || '',
    board: user.board || 'CBSE', parent_email: user.parent_email || '',
    admission_date: user.admission_date ? user.admission_date.split('T')[0] : '',
    assigned_region: user.assigned_region || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setMsg('');
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      date_of_birth: form.date_of_birth || null,
      qualification: form.qualification.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (user.portal_role === 'teacher') {
      payload.subjects = form.subjects;
      payload.experience_years = form.experience_years ? Number(form.experience_years) : null;
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
      if (data.success) { setMsg('✓ Saved'); setTimeout(onSaved, 800); }
      else setMsg(`✗ ${data.error}`);
    } catch { setMsg('✗ Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit {user.full_name}</h2>
            <p className="text-xs text-muted-foreground">{user.email} · {user.portal_role}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-auto">
          {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('✓') ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>{msg}</div>}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Full Name</label>
            <input type="text" value={form.full_name} onChange={(e) => f('full_name', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => f('phone', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => f('date_of_birth', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
          </div>

          {user.portal_role === 'teacher' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subjects</label>
                <div className="mt-2"><SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                  <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Experience (years)</label>
                  <input type="number" min={0} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {user.portal_role === 'student' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Grade</label>
                  <select value={form.grade} onChange={(e) => f('grade', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    {GRADES.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Section</label>
                  <input type="text" value={form.section} onChange={(e) => f('section', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Board</label>
                  <select value={form.board} onChange={(e) => f('board', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    {BOARDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Admission Date</label>
                  <input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Parent Email</label>
                <input type="email" value={form.parent_email} onChange={(e) => f('parent_email', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </>
          )}

          {user.portal_role === 'coordinator' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assigned Region</label>
                <select value={form.assigned_region} onChange={(e) => f('assigned_region', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                  <option value="">— Select —</option>
                  {GCC_REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                  placeholder="e.g. B.Ed, MBA"
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </>
          )}

          {user.portal_role === 'academic_operator' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Assigned Region</label>
                  <select value={form.assigned_region} onChange={(e) => f('assigned_region', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none">
                    <option value="">— Select —</option>
                    {GCC_REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Experience (years)</label>
                  <input type="number" min={0} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Qualification</label>
                <input type="text" value={form.qualification} onChange={(e) => f('qualification', e.target.value)}
                  placeholder="e.g. MBA, B.Ed"
                  className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-teal-500 focus:outline-none" />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes (internal)</label>
            <textarea rows={2} value={form.notes} onChange={(e) => f('notes', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Reset Password</h2>
            <p className="text-xs text-muted-foreground">{user.full_name} · {user.email}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          {result ? (
            <div className="space-y-3">
              <div className={`rounded-lg px-4 py-3 text-sm ${result.success ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-400'}`}>
                {result.message}
              </div>
              {result.success && result.new_password && (
                <div className="rounded-lg border border-teal-800 bg-teal-950/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">New Password</p>
                  <p className="font-mono text-lg font-bold text-teal-300">{result.new_password}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Also emailed to {user.email}</p>
                </div>
              )}
              <button onClick={onClose} className="w-full rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-accent">Close</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground/80">
                Set a new password or leave blank to auto-generate a secure password. An email will be sent to the user.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">New Password <span className="text-muted-foreground/60">(optional)</span></label>
                <div className="mt-1"><PwdInput value={password} onChange={setPassword} placeholder="Leave blank to auto-generate" /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={handleReset} disabled={resetting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                  {resetting ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</> : <><KeyRound className="h-4 w-4" /> Reset &amp; Email</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
