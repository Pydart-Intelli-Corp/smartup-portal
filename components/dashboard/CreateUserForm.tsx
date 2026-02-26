// ═══════════════════════════════════════════════════════════════
// Reusable Create User Form — used by HR Module & Batch Wizard
// Contains all role-specific fields, email check, credentials panel
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FormField, FormGrid, Input, Textarea, Select, Alert, Button,
  RoleBadge,
} from '@/components/dashboard/shared';
import {
  UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2, CheckCircle,
  ChevronDown, ChevronLeft, ChevronRight, X, GraduationCap, Users, User, BookOpen, Shield, Ghost,
  FileText,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────

export const SUBJECTS = [
  'Physics', 'Chemistry', 'Mathematics', 'Social Science',
  'English', 'Malayalam', 'Arabic',
];
export const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
export const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'Others'];
export const GCC_REGIONS = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Qatar', 'Saudi Arabia', 'Oman', 'Kuwait', 'Bahrain', 'Other'];
export const QUALIFICATIONS = [
  'B.Ed', 'M.Ed', 'B.Sc', 'M.Sc', 'B.A', 'M.A', 'B.Com', 'M.Com',
  'MBA', 'BBA', 'Ph.D', 'D.El.Ed', 'B.Tech', 'M.Tech', 'PGDM',
];

export const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  batch_coordinator: 'Batch Coordinator',
  coordinator: 'Batch Coordinator',
  academic_operator: 'Academic Operator',
  hr: 'HR Associate',
  ghost: 'Ghost Observer',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  teacher: GraduationCap,
  student: BookOpen,
  parent: Users,
  batch_coordinator: Shield,
  coordinator: Shield,
  academic_operator: Shield,
  hr: User,
  ghost: Ghost,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  teacher: 'Teach subjects, conduct classes, grade students',
  student: 'Enroll in batches, attend classes, view grades',
  parent: 'Monitor student progress, receive notifications',
  batch_coordinator: 'Manage batches, coordinate teachers & students',
  coordinator: 'Manage batches, coordinate teachers & students',
  academic_operator: 'Oversee academic operations and quality',
  hr: 'Manage users, onboarding, accounts',
  ghost: 'Silent observer, audit & monitoring access',
};

// ─── PwdInput ───────────────────────────────────────────────

export function PwdInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Leave blank to auto-generate'}
      />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── SubjectSelector ────────────────────────────────────────

export function SubjectSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (s: string) => {
    if (selected.includes(s)) onChange(selected.filter((x) => x !== s));
    else onChange([...selected, s]);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-left hover:border-gray-300 transition-colors">
        <span className={selected.length ? 'text-gray-900' : 'text-gray-400'}>
          {selected.length ? selected.join(', ') : 'Select subjects...'}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg py-1 max-h-52 overflow-y-auto">
          {SUBJECTS.map((s) => (
            <label key={s}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-gray-700">{s}</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              {s}
              <button type="button" onClick={() => toggle(s)} className="hover:text-emerald-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── QualificationSelector ──────────────────────────────────

export function QualificationSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = QUALIFICATIONS.includes(value);
  const isOther = value !== '' && !isPreset;
  const [showCustom, setShowCustom] = useState(isOther);

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      setShowCustom(true);
      onChange('');
    } else {
      setShowCustom(false);
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={showCustom ? '__other__' : value}
        onChange={handleSelect}
        options={[
          ...QUALIFICATIONS.map((q) => ({ value: q, label: q })),
          { value: '__other__', label: 'Other (type below)' },
        ]}
        placeholder="— Select qualification —"
      />
      {showCustom && (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your qualification..."
          autoFocus
        />
      )}
    </div>
  );
}

// ─── CredentialsPanel ───────────────────────────────────────

export function CredentialsPanel({
  name, email, password, role, onDone, onAddAnother,
}: {
  name: string; email: string; password: string; role: string;
  onDone: () => void; onAddAnother?: () => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const copy = async (text: string, which: 'email' | 'pwd') => {
    await navigator.clipboard.writeText(text);
    if (which === 'email') { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }
    else { setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 2000); }
  };

  return (
    <div className="space-y-5">
      <Alert variant="success" message={`Account created successfully — credentials emailed to ${name}`} />

      <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Account Holder</p>
            <p className="mt-0.5 font-medium text-gray-900">{name}</p>
          </div>
          <RoleBadge role={role} />
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Login Email</p>
            <p className="mt-0.5 font-mono text-sm text-emerald-700 truncate">{email}</p>
          </div>
          <Button variant={copiedEmail ? 'success' : 'secondary'} size="xs" onClick={() => copy(email, 'email')}>
            {copiedEmail ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Temporary Password</p>
            <p className="mt-0.5 font-mono text-base font-bold tracking-widest text-gray-900">{password}</p>
          </div>
          <Button variant={copiedPwd ? 'success' : 'secondary'} size="xs" onClick={() => copy(password, 'pwd')}>
            {copiedPwd ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <Alert variant="info" message={`An email with these credentials has been sent to ${email}. The user should change their password after first login.`} />

      <div className="flex gap-3">
        {onAddAnother && (
          <Button variant="secondary" className="flex-1" icon={UserPlus} onClick={onAddAnother}>Add Another</Button>
        )}
        <Button variant="primary" className="flex-1" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

// ─── CreateUserModal — fully self-contained reusable modal ──

interface CreateUserModalProps {
  role: string;
  open: boolean;
  onClose: () => void;
  onCreated: (data?: { email: string; full_name: string; temp_password: string }) => void;
  /** If true, show a compact version without modal wrapper (for embedding) */
  embedded?: boolean;
  /** Pre-set role is fixed and cannot be changed */
  fixedRole?: boolean;
  /** Title override */
  title?: string;
  /** Subtitle override */
  subtitle?: string;
}

export function CreateUserModal({
  role: initialRole, open, onClose, onCreated, embedded, title, subtitle,
}: CreateUserModalProps) {
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({
    email: '', full_name: '', password: '',
    phone: '', whatsapp: '', address: '', qualification: '', notes: '', experience_years: '',
    per_hour_rate: '',
    subjects: [] as string[],
    grade: 'Class 10', section: '', board: 'CBSE', parent_email: '', parent_name: '', parent_password: '', admission_date: '',
    assigned_region: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ── Step definitions (3 steps) ──
  type StepKey = 'basic' | 'details' | 'review';

  const HAS_ROLE_FIELDS = ['teacher', 'student', 'coordinator', 'batch_coordinator', 'academic_operator'].includes(role);

  const detailsLabel: Record<string, string> = {
    teacher: 'Teaching Details',
    student: 'Academic Details',
    coordinator: 'Coordinator Details',
    batch_coordinator: 'Coordinator Details',
    academic_operator: 'Operator Details',
  };

  const STEPS: { key: StepKey; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'basic', label: 'Basic Info', icon: User, desc: 'Name, email, password & contact' },
    { key: 'details', label: detailsLabel[role] || 'Additional Info', icon: ROLE_ICONS[role] || FileText, desc: 'Role details, address & notes' },
    { key: 'review', label: 'Review', icon: CheckCircle, desc: 'Confirm & create' },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx]?.key || 'basic';

  // Sync role if parent changes it
  useEffect(() => { setRole(initialRole); }, [initialRole]);

  // Reset step when opening
  useEffect(() => {
    if (open) { setStepIdx(0); setCreated(null); resetForm(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const f = (key: string, val: unknown) => setForm((p) => ({ ...p, [key]: val }));

  const resetForm = () => {
    setForm({
      email: '', full_name: '', password: '',
      phone: '', whatsapp: '', address: '', qualification: '', notes: '', experience_years: '',
      per_hour_rate: '',
      subjects: [], grade: 'Class 10', section: '', board: 'CBSE',
      parent_email: '', parent_name: '', parent_password: '', admission_date: '', assigned_region: '',
    });
    setEmailStatus('idle');
    setError('');
  };

  // Debounced email existence check
  useEffect(() => {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    emailTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/hr/users/${encodeURIComponent(email)}`);
        const data = await res.json();
        setEmailStatus(data.success ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);
    return () => { if (emailTimerRef.current) clearTimeout(emailTimerRef.current); };
  }, [form.email]);

  // ── Step validation ──
  const isStepValid = (step: StepKey): boolean => {
    switch (step) {
      case 'basic': return !!(form.full_name.trim() && form.email.trim() && form.email.includes('@') && emailStatus !== 'taken');
      case 'details': return true; // all optional
      case 'review': return isStepValid('basic');
      default: return true;
    }
  };

  const canGoNext = () => isStepValid(currentStep);
  const goNext = () => { if (stepIdx < STEPS.length - 1 && canGoNext()) setStepIdx(stepIdx + 1); };
  const goPrev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  const handleSubmit = async () => {
    setError('');
    if (!form.email.trim() || !form.full_name.trim()) { setError('Email and name are required'); setStepIdx(0); return; }
    if (emailStatus === 'taken') { setError('This email already exists in the system'); setStepIdx(0); return; }

    const payload: Record<string, unknown> = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim(),
      portal_role: role,
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.whatsapp.trim() ? { whatsapp: form.whatsapp.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
      ...(form.qualification.trim() ? { qualification: form.qualification.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    if (role === 'teacher') {
      if (form.subjects.length > 0) payload.subjects = form.subjects;
      if (form.experience_years) payload.experience_years = Number(form.experience_years);
      if (form.per_hour_rate) payload.per_hour_rate = Math.round(Number(form.per_hour_rate));
    }
    if (role === 'student') {
      payload.grade = form.grade;
      if (form.section.trim()) payload.section = form.section.trim();
      payload.board = form.board;
      if (form.parent_email.trim()) {
        payload.parent_email = form.parent_email.trim().toLowerCase();
        if (form.parent_name.trim()) payload.parent_name = form.parent_name.trim();
        if (form.parent_password.trim()) payload.parent_password = form.parent_password.trim();
      }
      if (form.admission_date) payload.admission_date = form.admission_date;
    }
    if (role === 'coordinator' || role === 'batch_coordinator') {
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
      onCreated({
        email: data.data.email,
        full_name: data.data.full_name,
        temp_password: data.data.temp_password || '(emailed)',
      });
      setCreated({
        name: data.data.full_name,
        email: data.data.email,
        password: data.data.temp_password || '(emailed)',
      });
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  if (!open) return null;

  const RoleIcon = ROLE_ICONS[role] || UserPlus;
  const roleLabel = title || (created ? 'Credentials Issued' : `New ${ROLE_LABELS[role] || role}`);
  const roleDesc = subtitle || ROLE_DESCRIPTIONS[role] || 'Fill in the details below';

  // ── Step content renderers ──

  const renderBasicStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
        <p className="text-sm text-gray-500 mt-1">Name, email, password &amp; contact details</p>
      </div>
      {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}
      <FormGrid cols={2}>
        <FormField label="Full Name" required>
          <Input type="text" required value={form.full_name} onChange={(e) => f('full_name', e.target.value)} placeholder="e.g. Priya Sharma" />
        </FormField>
        <FormField label="Email Address" required
          hint={emailStatus === 'checking' ? 'Checking...' : emailStatus === 'taken' ? '⚠ Email already exists' : emailStatus === 'available' ? '✓ Available' : undefined}>
          <div className="relative">
            <Input type="email" required value={form.email} onChange={(e) => f('email', e.target.value)} placeholder="e.g. priya@gmail.com"
              className={emailStatus === 'taken' ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : emailStatus === 'available' ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200' : ''} />
            {emailStatus === 'checking' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            )}
            {emailStatus === 'taken' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />}
            {emailStatus === 'available' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
          </div>
        </FormField>
      </FormGrid>
      <FormField label="Password" hint="Optional — a secure password will be auto-generated if left blank">
        <PwdInput value={form.password} onChange={(v) => f('password', v)} />
      </FormField>
      <FormGrid cols={2}>
        <FormField label="Phone Number">
          <Input type="tel" value={form.phone} onChange={(e) => f('phone', e.target.value)} placeholder="+971 50 123 4567" />
        </FormField>
        <FormField label="WhatsApp Number">
          <Input type="tel" value={form.whatsapp} onChange={(e) => f('whatsapp', e.target.value)} placeholder="+971 50 123 4567" />
        </FormField>
      </FormGrid>
    </div>
  );

  const renderDetailsStep = () => {
    const roleFields = (() => {
      if (role === 'teacher') return (
        <>
          <FormField label="Subjects" hint="Select all that apply">
            <SubjectSelector selected={form.subjects} onChange={(s) => f('subjects', s)} />
          </FormField>
          <FormGrid cols={2}>
            <FormField label="Qualification">
              <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
            </FormField>
            <FormField label="Experience (years)">
              <Input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} placeholder="e.g. 5" />
            </FormField>
          </FormGrid>
          <FormField label="Per Hour Rate" hint="Amount per teaching hour">
            <Input type="number" min={0} step={1} value={form.per_hour_rate} onChange={(e) => f('per_hour_rate', e.target.value)} placeholder="e.g. 500" />
          </FormField>
        </>
      );
      if (role === 'student') return (
        <>
          <FormGrid cols={2}>
            <FormField label="Grade" required>
              <Select value={form.grade} onChange={(v) => f('grade', v)} options={GRADES.map(g => ({ value: g, label: g }))} />
            </FormField>
            <FormField label="Section / Batch">
              <Input type="text" value={form.section} onChange={(e) => f('section', e.target.value)} placeholder="e.g. A, Morning" />
            </FormField>
          </FormGrid>
          <FormGrid cols={2}>
            <FormField label="Board" required>
              <Select value={form.board} onChange={(v) => f('board', v)} options={BOARDS.map(b => ({ value: b, label: b }))} />
            </FormField>
            <FormField label="Admission Date">
              <Input type="date" value={form.admission_date} onChange={(e) => f('admission_date', e.target.value)} />
            </FormField>
          </FormGrid>
          <FormField label="Parent Email" hint="A parent account will be auto-created if it doesn&apos;t exist">
            <Input type="email" value={form.parent_email} onChange={(e) => f('parent_email', e.target.value)} placeholder="parent@gmail.com" />
          </FormField>
          {form.parent_email.trim() && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-4">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Users className="h-4 w-4" /> Parent Account Details
              </p>
              <FormField label="Parent Full Name" required>
                <Input type="text" value={form.parent_name} onChange={(e) => f('parent_name', e.target.value)} placeholder="e.g. Rajesh Sharma" />
              </FormField>
              <FormField label="Parent Password" hint="Leave blank to auto-generate">
                <PwdInput value={form.parent_password} onChange={(v) => f('parent_password', v)} />
              </FormField>
              <div className="rounded-lg bg-blue-100/60 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-700">
                  If a parent account already exists with this email, the student will be linked to it. Otherwise, a new parent account will be created automatically.
                </p>
              </div>
            </div>
          )}
        </>
      );
      if (role === 'coordinator' || role === 'batch_coordinator') return (
        <FormGrid cols={2}>
          <FormField label="Assigned Region (GCC)">
            <Select value={form.assigned_region} onChange={(v) => f('assigned_region', v)}
              options={GCC_REGIONS.map(r => ({ value: r, label: r }))} placeholder="— Select —" />
          </FormField>
          <FormField label="Qualification">
            <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
          </FormField>
        </FormGrid>
      );
      if (role === 'academic_operator') return (
        <>
          <FormGrid cols={2}>
            <FormField label="Assigned Region (GCC)">
              <Select value={form.assigned_region} onChange={(v) => f('assigned_region', v)}
                options={GCC_REGIONS.map(r => ({ value: r, label: r }))} placeholder="— Select —" />
            </FormField>
            <FormField label="Experience (years)">
              <Input type="number" min={0} max={50} value={form.experience_years} onChange={(e) => f('experience_years', e.target.value)} />
            </FormField>
          </FormGrid>
          <FormField label="Qualification">
            <QualificationSelector value={form.qualification} onChange={(v) => f('qualification', v)} />
          </FormField>
        </>
      );
      return null;
    })();

    const heading = HAS_ROLE_FIELDS
      ? (detailsLabel[role] || 'Role Details')
      : 'Additional Information';
    const headingDesc = HAS_ROLE_FIELDS
      ? 'Role-specific fields, address & notes'
      : 'Address and internal notes (optional)';

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{heading}</h2>
          <p className="text-sm text-gray-500 mt-1">{headingDesc}</p>
        </div>
        {roleFields}
        {HAS_ROLE_FIELDS && <div className="border-t border-gray-200 pt-6" />}
        <FormField label="Address">
          <Textarea rows={3} value={form.address} onChange={(e) => f('address', e.target.value)} placeholder="Full address..." />
        </FormField>
        <FormField label="Notes (internal)">
          <Textarea rows={3} value={form.notes} onChange={(e) => f('notes', e.target.value)} placeholder="Any internal HR notes..." />
        </FormField>
      </div>
    );
  };

  const renderReviewStep = () => {
    const rows: { label: string; value: string }[] = [
      { label: 'Full Name', value: form.full_name },
      { label: 'Email', value: form.email },
      { label: 'Role', value: ROLE_LABELS[role] || role },
      { label: 'Password', value: form.password ? '••••••••' : 'Auto-generated' },
    ];
    if (form.phone) rows.push({ label: 'Phone', value: form.phone });
    if (form.whatsapp) rows.push({ label: 'WhatsApp', value: form.whatsapp });
    if (role === 'teacher') {
      if (form.subjects.length) rows.push({ label: 'Subjects', value: form.subjects.join(', ') });
      if (form.qualification) rows.push({ label: 'Qualification', value: form.qualification });
      if (form.experience_years) rows.push({ label: 'Experience', value: `${form.experience_years} years` });
      if (form.per_hour_rate) rows.push({ label: 'Per Hour Rate', value: `₹${form.per_hour_rate}` });
    }
    if (role === 'student') {
      rows.push({ label: 'Grade', value: form.grade });
      if (form.section) rows.push({ label: 'Section', value: form.section });
      rows.push({ label: 'Board', value: form.board });
      if (form.parent_email) {
        rows.push({ label: 'Parent Email', value: form.parent_email });
        if (form.parent_name) rows.push({ label: 'Parent Name', value: form.parent_name });
        rows.push({ label: 'Parent Password', value: form.parent_password ? '••••••••' : 'Auto-generated' });
      }
      if (form.admission_date) rows.push({ label: 'Admission Date', value: form.admission_date });
    }
    if ((role === 'coordinator' || role === 'batch_coordinator') && form.assigned_region) {
      rows.push({ label: 'Region', value: form.assigned_region });
      if (form.qualification) rows.push({ label: 'Qualification', value: form.qualification });
    }
    if (role === 'academic_operator') {
      if (form.assigned_region) rows.push({ label: 'Region', value: form.assigned_region });
      if (form.experience_years) rows.push({ label: 'Experience', value: `${form.experience_years} years` });
      if (form.qualification) rows.push({ label: 'Qualification', value: form.qualification });
    }
    if (form.address) rows.push({ label: 'Address', value: form.address });
    if (form.notes) rows.push({ label: 'Notes', value: form.notes });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review &amp; Create</h2>
          <p className="text-sm text-gray-500 mt-1">Confirm the details below before creating the account</p>
        </div>
        {error && <Alert variant="error" message={error} onDismiss={() => setError('')} />}
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 divide-y divide-gray-100 overflow-hidden">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-500 font-medium">{r.label}</span>
              <span className="text-sm text-gray-900 font-semibold text-right max-w-xs truncate">{r.value || '—'}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm text-emerald-800">
            <strong>Ready to create!</strong> Credentials will be emailed to <strong>{form.email}</strong> automatically.
          </p>
        </div>
      </div>
    );
  };

  // ── Credentials screen (after creation) ──
  if (created) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-white font-bold text-lg">Account Created</h2>
              <p className="text-emerald-200 text-xs mt-1">Credentials issued successfully</p>
            </div>
            <div className="flex-1" />
            <button onClick={onClose} className="mt-4 text-emerald-200 hover:text-white text-xs flex items-center gap-2 transition">
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
              <CredentialsPanel
                name={created.name}
                email={created.email}
                password={created.password}
                role={role}
                onDone={onClose}
                onAddAnother={() => { setCreated(null); resetForm(); setStepIdx(0); }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Embedded mode ──
  if (embedded) {
    return (
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
        {renderBasicStep()}
        {renderDetailsStep()}
      </form>
    );
  }

  // ── Full-screen step-by-step overlay (same design as batch wizard) ──
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left sidebar — step indicator ── */}
        <div className="w-60 bg-linear-to-b from-emerald-600 via-emerald-700 to-teal-800 p-6 flex flex-col shrink-0">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <RoleIcon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">{roleLabel}</h2>
            <p className="text-emerald-200 text-xs mt-1">Step {stepIdx + 1} of {STEPS.length}</p>
          </div>

          <div className="space-y-1 flex-1">
            {STEPS.map((step, idx) => {
              const isDone = idx < stepIdx;
              const isCurrent = idx === stepIdx;
              const StepIcon = step.icon;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => { if (idx < stepIdx) setStepIdx(idx); }}
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

        {/* ── Right content area — one step at a time ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-10 pt-8 pb-6 flex-1 overflow-y-auto">
            {currentStep === 'basic' && renderBasicStep()}
            {currentStep === 'details' && renderDetailsStep()}
            {currentStep === 'review' && renderReviewStep()}
          </div>

          {/* ── Footer navigation (matches batch wizard) ── */}
          <div className="px-10 py-5 border-t bg-gray-50/80 flex items-center justify-between">
            <div>
              {stepIdx > 0 && (
                <Button variant="ghost" icon={ChevronLeft} onClick={goPrev} size="md">Back</Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep !== 'review' ? (
                <Button variant="primary" iconRight={ChevronRight} onClick={goNext} disabled={!canGoNext()} size="lg">
                  Continue
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={UserPlus}
                  loading={submitting}
                  disabled={submitting || emailStatus === 'taken' || !form.full_name.trim() || !form.email.trim()}
                  onClick={handleSubmit}
                  size="lg"
                >
                  Create &amp; Send Credentials
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}