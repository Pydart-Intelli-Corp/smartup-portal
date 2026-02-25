// ═══════════════════════════════════════════════════════════════
// Users & HR Management — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FormPanel, FormField, FormGrid, FormActions,
  Input, Select, Modal,
  TableWrapper, THead, TH, TRow,
  DetailPanel, DetailHeader, InfoCard,
  LoadingState, EmptyState, Alert,
  RoleBadge, ActiveIndicator, Avatar, ROLE_CONFIG,
  useToast, useConfirm,
} from '@/components/dashboard/shared';
import {
  Users, Plus, X, CheckCircle, XCircle,
  KeyRound, UserPlus, Mail, Phone, Calendar,
  GraduationCap, Briefcase, BookOpen, MapPin, Hash, Building,
  Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface PortalUser {
  email: string;
  full_name: string;
  portal_role: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface UserProfile {
  email: string;
  full_name: string;
  portal_role: string;
  phone: string | null;
  whatsapp: string | null;
  date_of_birth: string | null;
  address: string | null;
  qualification: string | null;
  notes: string | null;
  subjects: string[] | null;
  experience_years: number | null;
  grade: string | null;
  section: string | null;
  board: string | null;
  parent_email: string | null;
  admission_date: string | null;
  assigned_region: string | null;
  is_active: boolean;
}

interface RoleStats {
  portal_role: string;
  count: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const ROLES = ['teacher', 'student', 'batch_coordinator', 'academic_operator', 'parent', 'hr', 'ghost', 'owner'];

// ── Main Component ───────────────────────────────────────────

export default function UsersClient({ userName, userEmail, userRole }: Props) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Detail panel
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('student');
  const [formPhone, setFormPhone] = useState('');

  // Reset password
  const [resetting, setResetting] = useState<string | null>(null);

  const toast = useToast();

  const fetchUsers = useCallback(async (role?: string) => {
    setLoading(true);
    try {
      const url = role && role !== 'all' ? `/api/v1/hr/users?role=${role}` : '/api/v1/hr/users';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setUsers(json.data?.users || []);
    } catch (e) { console.error('Failed to fetch users:', e); }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/owner/user-stats');
      const json = await res.json();
      if (json.success) setRoleStats(json.data?.stats || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchProfile = useCallback(async (email: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`);
      const json = await res.json();
      if (json.success) setProfile(json.data?.user || json.data);
    } catch (e) { console.error(e); }
    setProfileLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); fetchStats(); }, [fetchUsers, fetchStats]);
  useEffect(() => { fetchUsers(roleFilter); }, [roleFilter, fetchUsers]);
  useEffect(() => {
    if (selectedUser) fetchProfile(selectedUser);
    else setProfile(null);
  }, [selectedUser, fetchProfile]);

  const createUser = async () => {
    if (!formEmail.trim() || !formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/hr/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, full_name: formName, portal_role: formRole, phone: formPhone || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setFormEmail(''); setFormName(''); setFormPhone('');
        toast.success('User created successfully');
        fetchUsers(roleFilter); fetchStats();
      } else {
        toast.error(json.error || 'Failed to create user');
      }
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  const { confirm } = useConfirm();

  const resetPassword = async (email: string) => {
    const ok = await confirm({
      title: 'Reset Password',
      message: `Reset password for ${email}? A new password will be emailed.`,
      confirmLabel: 'Reset',
      variant: 'warning',
    });
    if (!ok) return;
    setResetting(email);
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}/reset-password`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success('Password reset successfully. New credentials emailed.');
      } else {
        toast.error(json.error || 'Failed to reset');
      }
    } catch (e) { console.error(e); }
    setResetting(null);
  };

  const toggleActive = async (email: string, active: boolean) => {
    try {
      const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`, {
        method: active ? 'DELETE' : 'PATCH',
        ...(active ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(active ? 'User deactivated' : 'User reactivated');
        fetchUsers(roleFilter); fetchStats();
      }
    } catch (e) { console.error(e); }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const totalUsers = roleStats.reduce((a, b) => a + b.count, 0);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* ── Header ── */}
        <PageHeader icon={Users} title="Users & HR Management" subtitle={`${totalUsers} total users across ${roleStats.length} roles`}>
          <RefreshButton loading={loading} onClick={() => { fetchUsers(roleFilter); fetchStats(); }} />
          <Button variant="primary" icon={UserPlus} onClick={() => setShowCreate(true)}>Add User</Button>
        </PageHeader>

        {/* ── Role distribution cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {ROLES.map((role) => {
            const stat = roleStats.find((s) => s.portal_role === role);
            const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.ghost;
            const Icon = cfg.icon;
            const isActive = roleFilter === role;
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
                className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${
                  isActive ? 'border-emerald-300 bg-emerald-50/80 ring-1 ring-emerald-200' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Icon className={`h-5 w-5 mb-2 ${cfg.color}`} />
                <p className="text-xl font-bold text-gray-900">{stat?.count || 0}</p>
                <p className="text-xs text-gray-500 truncate">{cfg.label}</p>
              </button>
            );
          })}
        </div>

        {/* ── Search ── */}
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or phone…" />
          {roleFilter !== 'all' && (
            <Button variant="outline" icon={X} size="sm" onClick={() => setRoleFilter('all')}>Clear filter</Button>
          )}
        </div>

        {/* ── Create form (modal) ── */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New User" subtitle="A temporary password will be generated and emailed.">
          <FormGrid cols={2}>
            <FormField label="Email" required>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@smartup.com" />
            </FormField>
            <FormField label="Full Name" required>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="John Doe" />
            </FormField>
            <FormField label="Role">
              <Select
                value={formRole}
                onChange={setFormRole}
                options={ROLES.filter((r) => r !== 'owner').map((r) => ({
                  value: r,
                  label: ROLE_CONFIG[r]?.label || r,
                }))}
              />
            </FormField>
            <FormField label="Phone">
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+91 98765 43210" />
            </FormField>
          </FormGrid>
          <FormActions onCancel={() => setShowCreate(false)} onSubmit={createUser} submitLabel="Create User" submitDisabled={!formEmail.trim() || !formName.trim()} submitting={creating} />
        </Modal>

        {/* ── Users table ── */}
        {loading && users.length === 0 ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} message="No users found" />
        ) : (
          <TableWrapper
            footer={
              <>
                <span>Showing {filtered.length} of {users.length} users</span>
                <span>{roleFilter !== 'all' ? `Filtered: ${ROLE_CONFIG[roleFilter]?.label}` : 'All roles'}</span>
              </>
            }
          >
            <THead>
              <TH>User</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Last Login</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {filtered.map((u) => (
                <TRow
                  key={u.email}
                  selected={selectedUser === u.email}
                  onClick={() => setSelectedUser(selectedUser === u.email ? null : u.email)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} size="sm" className="bg-gray-100 text-gray-600" />
                      <span className="font-medium text-gray-800">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.portal_role} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.phone || '—'}</td>
                  <td className="px-4 py-3"><ActiveIndicator active={u.is_active} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={KeyRound}
                        onClick={() => resetPassword(u.email)}
                        disabled={resetting === u.email}
                        className="text-amber-600 hover:bg-amber-50"
                        title="Reset password"
                      />
                      <IconButton
                        icon={u.is_active ? XCircle : CheckCircle}
                        onClick={() => toggleActive(u.email, u.is_active)}
                        className={u.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
                        title={u.is_active ? 'Deactivate' : 'Reactivate'}
                      />
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {/* ── Profile detail panel ── */}
        {selectedUser && (
          <DetailPanel loading={profileLoading} emptyMessage="Could not load user profile">
            {profile && (
              <>
                <DetailHeader
                  title={profile.full_name}
                  subtitle={profile.email}
                  onClose={() => setSelectedUser(null)}
                >
                  <RoleBadge role={profile.portal_role} />
                </DetailHeader>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    { label: 'Phone', value: profile.phone, icon: Phone },
                    { label: 'WhatsApp', value: profile.whatsapp, icon: Phone },
                    { label: 'DOB', value: profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN') : null, icon: Calendar },
                    { label: 'Qualification', value: profile.qualification, icon: GraduationCap },
                    { label: 'Experience', value: profile.experience_years ? `${profile.experience_years} yrs` : null, icon: Briefcase },
                    { label: 'Subjects', value: profile.subjects?.join(', '), icon: BookOpen },
                    { label: 'Grade', value: profile.grade, icon: Hash },
                    { label: 'Section', value: profile.section, icon: Hash },
                    { label: 'Board', value: profile.board, icon: Building },
                    { label: 'Region', value: profile.assigned_region, icon: MapPin },
                    { label: 'Parent Email', value: profile.parent_email, icon: Mail },
                    { label: 'Admission', value: profile.admission_date ? new Date(profile.admission_date).toLocaleDateString('en-IN') : null, icon: Calendar },
                  ].filter((f) => f.value).map((field) => (
                    <InfoCard key={field.label} label={field.label} icon={field.icon}>
                      <p className="text-sm font-medium text-gray-800">{field.value}</p>
                    </InfoCard>
                  ))}
                </div>

                {profile.address && (
                  <InfoCard label="Address" icon={MapPin}>
                    <p className="text-sm text-gray-800">{profile.address}</p>
                  </InfoCard>
                )}

                {profile.notes && (
                  <InfoCard label="Notes">
                    <p className="text-sm text-gray-800">{profile.notes}</p>
                  </InfoCard>
                )}
              </>
            )}
          </DetailPanel>
        )}
      </div>
    </DashboardShell>
  );
}
