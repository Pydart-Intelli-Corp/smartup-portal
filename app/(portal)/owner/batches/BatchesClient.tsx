// ═══════════════════════════════════════════════════════════════
// Batch Management — Client Component (Complete Rewrite)
// Template-based batch creation with multi-step wizard flow
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button, IconButton,
  SearchInput, FilterSelect, TabBar, Modal,
  FormField, FormGrid, FormActions, Input, Select, Textarea,
  TableWrapper, THead, TH, TRow,
  DetailPanel, DetailHeader, InfoCard,
  LoadingState, EmptyState, Badge, StatusBadge,
  useToast, useConfirm,
} from '@/components/dashboard/shared';
import {
  Database, Plus, Filter, Users, BookOpen,
  GraduationCap, User, X, Trash2,
  ChevronRight, ChevronLeft,
  UserCheck, CheckCircle, AlertCircle, Layers,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Social Science', 'English', 'Malayalam', 'Arabic'];
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const BOARDS = ['CBSE', 'ICSE', 'State Board'];

const BATCH_TEMPLATES = [
  {
    type: 'one_to_one' as const,
    label: 'One-to-One',
    description: '1 Student — 1 Teacher. Personal tuition.',
    maxStudents: 1,
    icon: User,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    selectedColor: 'bg-blue-100 border-blue-500 ring-2 ring-blue-300',
  },
  {
    type: 'one_to_three' as const,
    label: 'One-to-Three',
    description: 'Up to 3 Students — 1 Teacher. Small group.',
    maxStudents: 3,
    icon: Users,
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    selectedColor: 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300',
  },
  {
    type: 'one_to_many' as const,
    label: 'One-to-Many',
    description: 'Multiple Students — 1 Teacher. Classroom style.',
    maxStudents: 50,
    icon: GraduationCap,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    selectedColor: 'bg-purple-100 border-purple-500 ring-2 ring-purple-300',
  },
  {
    type: 'custom' as const,
    label: 'Custom',
    description: 'Custom configuration batch.',
    maxStudents: 999,
    icon: Layers,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    selectedColor: 'bg-amber-100 border-amber-500 ring-2 ring-amber-300',
  },
];

type BatchType = 'one_to_one' | 'one_to_three' | 'one_to_many' | 'custom';

// ── Types ────────────────────────────────────────────────────

interface Batch {
  batch_id: string;
  batch_name: string;
  batch_type: BatchType;
  subject: string | null;
  grade: string | null;
  board: string | null;
  teacher_email: string | null;
  teacher_name: string | null;
  coordinator_email: string | null;
  coordinator_name: string | null;
  max_students: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student_count: number;
}

interface BatchDetail {
  batch: Batch;
  students: BatchStudent[];
}

interface BatchStudent {
  student_email: string;
  student_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  added_at: string;
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

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Wizard Step ──────────────────────────────────────────────

type WizardStep = 'template' | 'details' | 'students' | 'review';

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'details', label: 'Details' },
  { key: 'students', label: 'Students' },
  { key: 'review', label: 'Review' },
];

// ── Helpers ──────────────────────────────────────────────────

function batchTypeLabel(t: string): string {
  const labels: Record<string, string> = {
    one_to_one: 'One-to-One',
    one_to_three: 'One-to-Three',
    one_to_many: 'One-to-Many',
    custom: 'Custom',
  };
  return labels[t] || t;
}

function batchTypeBadgeVariant(t: string): 'primary' | 'success' | 'info' | 'warning' | 'default' {
  const map: Record<string, 'primary' | 'success' | 'info' | 'warning'> = {
    one_to_one: 'primary',
    one_to_three: 'success',
    one_to_many: 'info',
    custom: 'warning',
  };
  return map[t] || 'default';
}

// ── Main Component ───────────────────────────────────────────

export default function BatchesClient({ userName, userEmail, userRole }: Props) {
  // ── List state ──
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // ── Detail state ──
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Create wizard state ──
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('template');
  const [creating, setCreating] = useState(false);

  // Wizard form values
  const [formType, setFormType] = useState<BatchType | ''>('');
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formBoard, setFormBoard] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formCoordinator, setFormCoordinator] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Selected students for the batch
  const [selectedStudents, setSelectedStudents] = useState<{ email: string; name: string; parent_email: string | null; parent_name: string | null }[]>([]);

  // People lists (fetched)
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [coordinators, setCoordinators] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Parent creation inline
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [parentForStudent, setParentForStudent] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [creatingParent, setCreatingParent] = useState(false);

  const toast = useToast();
  const { confirm } = useConfirm();

  // ── Data fetching ──────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/batches');
      const json = await res.json();
      if (json.success) setBatches(json.data?.batches || []);
    } catch (e) { console.error('Failed to fetch batches:', e); }
    setLoading(false);
  }, []);

  const fetchDetail = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/batches/${batchId}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } catch (e) { console.error('Failed to fetch detail:', e); }
    setDetailLoading(false);
  }, []);

  const fetchPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const [studRes, teachRes, coordRes] = await Promise.all([
        fetch('/api/v1/batches/people?role=student').then(r => r.json()),
        fetch('/api/v1/batches/people?role=teacher').then(r => r.json()),
        fetch('/api/v1/batches/people?role=batch_coordinator').then(r => r.json()),
      ]);
      if (studRes.success) setStudents(studRes.data.people);
      if (teachRes.success) setTeachers(teachRes.data.people);
      if (coordRes.success) setCoordinators(coordRes.data.people);
    } catch (e) { console.error('Failed to fetch people:', e); }
    setPeopleLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (selectedBatch) fetchDetail(selectedBatch);
    else setDetail(null);
  }, [selectedBatch, fetchDetail]);

  useEffect(() => {
    if (showCreate) fetchPeople();
  }, [showCreate, fetchPeople]);

  // ── Wizard helpers ─────────────────────────────────────────

  const resetWizard = () => {
    setWizardStep('template');
    setFormType('');
    setFormName('');
    setFormSubject('');
    setFormGrade('');
    setFormBoard('');
    setFormTeacher('');
    setFormCoordinator('');
    setFormMaxStudents('');
    setFormNotes('');
    setSelectedStudents([]);
    setStudentSearch('');
  };

  const openWizard = () => { resetWizard(); setShowCreate(true); };
  const closeWizard = () => { setShowCreate(false); resetWizard(); };

  const getMaxForType = (type: BatchType | ''): number => {
    if (!type) return 0;
    if (type === 'custom') return Number(formMaxStudents) || 50;
    const tpl = BATCH_TEMPLATES.find(t => t.type === type);
    return tpl?.maxStudents ?? 50;
  };

  const canProceedFromTemplate = formType !== '';
  const canProceedFromDetails = formName.trim() !== '';
  const canSubmit = formType !== '' && formName.trim() !== '';

  // ── Student selection ──────────────────────────────────────

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
      if (maxReached) {
        toast.error(`Max ${getMaxForType(formType)} students for this batch type.`);
        return;
      }
      setSelectedStudents(prev => [
        ...prev,
        { email: person.email, name: person.full_name, parent_email: person.parent_email, parent_name: person.parent_name },
      ]);
    }
  };

  const removeStudent = (email: string) => {
    setSelectedStudents(prev => prev.filter(s => s.email !== email));
  };

  // ── Create parent inline ──────────────────────────────────

  const openCreateParent = (studentEmail: string) => {
    setParentForStudent(studentEmail);
    setNewParentName('');
    setNewParentEmail('');
    setNewParentPhone('');
    setShowCreateParent(true);
  };

  const createParent = async () => {
    if (!newParentName.trim() || !newParentEmail.trim()) return;
    setCreatingParent(true);
    try {
      const res = await fetch('/api/v1/hr/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newParentEmail.trim().toLowerCase(),
          full_name: newParentName.trim(),
          portal_role: 'parent',
          phone: newParentPhone || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Parent account created. Password: ${json.data.temp_password}`);
        setSelectedStudents(prev =>
          prev.map(s =>
            s.email === parentForStudent
              ? { ...s, parent_email: newParentEmail.trim().toLowerCase(), parent_name: newParentName.trim() }
              : s
          )
        );
        setShowCreateParent(false);
        fetchPeople();
      } else {
        toast.error(json.error || 'Failed to create parent');
      }
    } catch (e) { console.error(e); toast.error('Failed to create parent'); }
    setCreatingParent(false);
  };

  // ── Create batch ──────────────────────────────────────────

  const submitBatch = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const body = {
        batch_name: formName.trim(),
        batch_type: formType,
        subject: formSubject || null,
        grade: formGrade || null,
        board: formBoard || null,
        teacher_email: formTeacher || null,
        coordinator_email: formCoordinator || null,
        max_students: formType === 'custom' ? (Number(formMaxStudents) || 50) : getMaxForType(formType),
        notes: formNotes || null,
        students: selectedStudents.map(s => ({ email: s.email, parent_email: s.parent_email })),
      };
      const res = await fetch('/api/v1/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Batch created successfully!');
        closeWizard();
        fetchBatches();
      } else {
        toast.error(json.error || 'Failed to create batch');
      }
    } catch (e) { console.error(e); toast.error('Failed to create batch'); }
    setCreating(false);
  };

  // ── Delete batch ──────────────────────────────────────────

  const deleteBatch = async (batchId: string) => {
    const ok = await confirm({
      title: 'Delete Batch',
      message: 'Permanently delete this batch and remove all student assignments?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/batches/${batchId}?permanent=true`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Batch deleted');
        fetchBatches();
        if (selectedBatch === batchId) setSelectedBatch(null);
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch (e) { console.error(e); }
  };

  // ── Filtering ─────────────────────────────────────────────

  const filtered = batches.filter(b => {
    const matchSearch = !search ||
      b.batch_name.toLowerCase().includes(search.toLowerCase()) ||
      b.batch_id.toLowerCase().includes(search.toLowerCase()) ||
      b.subject?.toLowerCase().includes(search.toLowerCase()) ||
      b.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.coordinator_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchType = typeFilter === 'all' || b.batch_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const counts = {
    all: batches.length,
    active: batches.filter(b => b.status === 'active').length,
    inactive: batches.filter(b => b.status === 'inactive').length,
    archived: batches.filter(b => b.status === 'archived').length,
  };

  // ── Wizard step indicator ─────────────────────────────────

  const stepIdx = WIZARD_STEPS.findIndex(s => s.key === wizardStep);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {WIZARD_STEPS.map((step, idx) => {
        const isDone = idx < stepIdx;
        const isCurrent = idx === stepIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            {idx > 0 && <div className={`w-8 h-0.5 ${idx <= stepIdx ? 'bg-blue-400' : 'bg-gray-200'}`} />}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCurrent ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                isDone ? 'bg-blue-50 text-blue-600' :
                'bg-gray-50 text-gray-400'
              }`}
            >
              {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="w-4 text-center">{idx + 1}</span>}
              <span>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Step 1: Template selection ─────────────────────────────

  const renderTemplateStep = () => (
    <div>
      <p className="text-sm text-gray-500 mb-4 text-center">Choose a batch template to get started</p>
      <div className="grid grid-cols-2 gap-4">
        {BATCH_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          const isSelected = formType === tpl.type;
          return (
            <button
              key={tpl.type}
              type="button"
              onClick={() => setFormType(tpl.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected ? tpl.selectedColor : tpl.color} hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-6 w-6 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{tpl.label}</p>
                  <p className="text-xs mt-1 opacity-80">{tpl.description}</p>
                  <p className="text-xs mt-2 font-medium">Max students: {tpl.maxStudents === 999 ? 'Custom' : tpl.maxStudents}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Step 2: Batch details ─────────────────────────────────

  const renderDetailsStep = () => (
    <div>
      <FormGrid cols={2}>
        <FormField label="Batch Name" required>
          <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Physics Grade 10 Batch A" />
        </FormField>
        <FormField label="Subject">
          <Select value={formSubject} onChange={setFormSubject}
            options={[{ value: '', label: 'Select Subject' }, ...SUBJECTS.map(s => ({ value: s, label: s }))]}
          />
        </FormField>
        <FormField label="Grade">
          <Select value={formGrade} onChange={setFormGrade}
            options={[{ value: '', label: 'Select Grade' }, ...GRADES.map(g => ({ value: g, label: `Grade ${g}` }))]}
          />
        </FormField>
        <FormField label="Board">
          <Select value={formBoard} onChange={setFormBoard}
            options={[{ value: '', label: 'Select Board' }, ...BOARDS.map(b => ({ value: b, label: b }))]}
          />
        </FormField>
        <FormField label="Teacher">
          <Select value={formTeacher} onChange={setFormTeacher}
            options={[
              { value: '', label: 'Select Teacher' },
              ...teachers.map(t => ({ value: t.email, label: `${t.full_name} (${t.email})` })),
            ]}
          />
        </FormField>
        <FormField label="Coordinator">
          <Select value={formCoordinator} onChange={setFormCoordinator}
            options={[
              { value: '', label: 'Select Coordinator' },
              ...coordinators.map(c => ({ value: c.email, label: `${c.full_name} (${c.email})` })),
            ]}
          />
        </FormField>
        {formType === 'custom' && (
          <FormField label="Max Students">
            <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} placeholder="50" />
          </FormField>
        )}
        <FormField label="Notes" className="sm:col-span-2">
          <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes…" rows={2} />
        </FormField>
      </FormGrid>
    </div>
  );

  // ── Step 3: Add students + auto-assign parents ────────────

  const renderStudentsStep = () => {
    const max = getMaxForType(formType);
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Add students to this batch
            <span className="ml-2 font-medium text-gray-800">{selectedStudents.length} / {max === 999 ? '∞' : max}</span>
          </p>
          <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" className="!w-64" />
        </div>

        {/* Selected students with parent info */}
        {selectedStudents.length > 0 && (
          <div className="mb-4 space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selected Students</h4>
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </div>
                  <div className="ml-4">
                    {s.parent_email ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3" /> Parent: {s.parent_name || s.parent_email}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCreateParent(s.email)}
                        className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
                      >
                        <AlertCircle className="h-3 w-3" /> No Parent — Add
                      </button>
                    )}
                  </div>
                </div>
                <IconButton icon={X} onClick={() => removeStudent(s.email)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
              </div>
            ))}
          </div>
        )}

        {/* Available students list */}
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          {peopleLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No students found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grade</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Parent</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const selected = isStudentSelected(s.email);
                  return (
                    <tr
                      key={s.email}
                      className={`border-t hover:bg-gray-50 cursor-pointer transition-colors ${selected ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleStudent(s)}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800">{s.full_name}</p>
                        <p className="text-xs text-gray-400">{s.email}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.grade || '—'}</td>
                      <td className="px-3 py-2">
                        {s.parent_email ? (
                          <span className="text-xs text-emerald-600">{s.parent_name || s.parent_email}</span>
                        ) : (
                          <span className="text-xs text-amber-500">No parent</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {selected ? (
                          <span className="text-xs text-blue-600 font-medium">✓ Selected</span>
                        ) : maxReached ? (
                          <span className="text-xs text-gray-300">Max reached</span>
                        ) : (
                          <span className="text-xs text-gray-400">Click to add</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Parent Modal */}
        <Modal open={showCreateParent} onClose={() => setShowCreateParent(false)} title="Add Parent Account" maxWidth="sm">
          <p className="text-sm text-gray-500 mb-4">
            Create a parent account for student: <strong>{parentForStudent}</strong>
          </p>
          <FormGrid cols={1}>
            <FormField label="Parent Full Name" required>
              <Input value={newParentName} onChange={e => setNewParentName(e.target.value)} placeholder="Parent name" />
            </FormField>
            <FormField label="Parent Email" required>
              <Input type="email" value={newParentEmail} onChange={e => setNewParentEmail(e.target.value)} placeholder="parent@email.com" />
            </FormField>
            <FormField label="Phone">
              <Input value={newParentPhone} onChange={e => setNewParentPhone(e.target.value)} placeholder="+91 …" />
            </FormField>
          </FormGrid>
          <FormActions
            onCancel={() => setShowCreateParent(false)}
            onSubmit={createParent}
            submitLabel="Create Parent"
            submitDisabled={!newParentName.trim() || !newParentEmail.trim()}
            submitting={creatingParent}
          />
        </Modal>
      </div>
    );
  };

  // ── Step 4: Review & submit ───────────────────────────────

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Batch Summary</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{formName}</span></div>
          <div><span className="text-gray-400">Type:</span> <Badge label={batchTypeLabel(formType)} variant={batchTypeBadgeVariant(formType)} /></div>
          <div><span className="text-gray-400">Subject:</span> <span className="font-medium text-gray-800">{formSubject || '—'}</span></div>
          <div><span className="text-gray-400">Grade:</span> <span className="font-medium text-gray-800">{formGrade ? `Grade ${formGrade}` : '—'}</span></div>
          <div><span className="text-gray-400">Board:</span> <span className="font-medium text-gray-800">{formBoard || '—'}</span></div>
          <div><span className="text-gray-400">Teacher:</span> <span className="font-medium text-gray-800">{teachers.find(t => t.email === formTeacher)?.full_name || formTeacher || '—'}</span></div>
          <div><span className="text-gray-400">Coordinator:</span> <span className="font-medium text-gray-800">{coordinators.find(c => c.email === formCoordinator)?.full_name || formCoordinator || '—'}</span></div>
          <div><span className="text-gray-400">Students:</span> <span className="font-medium text-gray-800">{selectedStudents.length}</span></div>
        </div>
      </div>

      {selectedStudents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enrolled Students</h4>
          <div className="space-y-1.5">
            {selectedStudents.map(s => (
              <div key={s.email} className="flex items-center gap-3 bg-white border rounded px-3 py-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">{s.name}</span>
                <span className="text-gray-400">{s.email}</span>
                {s.parent_email ? (
                  <span className="ml-auto text-xs text-emerald-600">Parent: {s.parent_name || s.parent_email}</span>
                ) : (
                  <span className="ml-auto text-xs text-amber-500">No parent assigned</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {formNotes && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</h4>
          <p className="text-sm text-gray-600">{formNotes}</p>
        </div>
      )}
    </div>
  );

  // ── Wizard navigation ─────────────────────────────────────

  const goNext = () => {
    if (stepIdx < WIZARD_STEPS.length - 1) setWizardStep(WIZARD_STEPS[stepIdx + 1].key);
  };

  const goPrev = () => {
    if (stepIdx > 0) setWizardStep(WIZARD_STEPS[stepIdx - 1].key);
  };

  const canGoNext = (): boolean => {
    if (wizardStep === 'template') return canProceedFromTemplate;
    if (wizardStep === 'details') return canProceedFromDetails;
    if (wizardStep === 'students') return true;
    return false;
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* ── Header ── */}
        <PageHeader icon={Database} title="Batch Management" subtitle="Create and manage batches with template-based flow">
          <RefreshButton loading={loading} onClick={fetchBatches} />
          <Button variant="primary" icon={Plus} onClick={openWizard}>New Batch</Button>
        </PageHeader>

        {/* ── Status tabs ── */}
        <TabBar
          tabs={[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'active', label: `Active (${counts.active})` },
            { key: 'inactive', label: `Inactive (${counts.inactive})` },
            { key: 'archived', label: `Archived (${counts.archived})` },
          ]}
          active={statusFilter}
          onChange={setStatusFilter}
        />

        {/* ── Filters row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search batches by name, subject, teacher…" />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'one_to_one', label: 'One-to-One' },
                { value: 'one_to_three', label: 'One-to-Three' },
                { value: 'one_to_many', label: 'One-to-Many' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </div>
        </div>

        {/* ── Create Wizard Modal ── */}
        <Modal open={showCreate} onClose={closeWizard} title="Create New Batch" maxWidth="lg">
          {renderStepIndicator()}

          {wizardStep === 'template' && renderTemplateStep()}
          {wizardStep === 'details' && renderDetailsStep()}
          {wizardStep === 'students' && renderStudentsStep()}
          {wizardStep === 'review' && renderReviewStep()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div>
              {stepIdx > 0 && (
                <Button variant="ghost" icon={ChevronLeft} onClick={goPrev}>Back</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={closeWizard}>Cancel</Button>
              {wizardStep !== 'review' ? (
                <Button variant="primary" icon={ChevronRight} onClick={goNext} disabled={!canGoNext()}>
                  Next
                </Button>
              ) : (
                <Button variant="primary" icon={CheckCircle} onClick={submitBatch} disabled={!canSubmit || creating}>
                  {creating ? 'Creating…' : 'Create Batch'}
                </Button>
              )}
            </div>
          </div>
        </Modal>

        {/* ── Table ── */}
        {loading && batches.length === 0 ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Database} message="No batches found" />
        ) : (
          <TableWrapper
            footer={
              <>
                <span>Showing {filtered.length} of {batches.length} batches</span>
                <span>{counts.active} active · {counts.inactive} inactive</span>
              </>
            }
          >
            <THead>
              <TH>Batch</TH>
              <TH>Type</TH>
              <TH>Subject</TH>
              <TH>Grade</TH>
              <TH>Teacher</TH>
              <TH>Coordinator</TH>
              <TH>Students</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {filtered.map(batch => (
                <TRow
                  key={batch.batch_id}
                  selected={selectedBatch === batch.batch_id}
                  onClick={() => setSelectedBatch(selectedBatch === batch.batch_id ? null : batch.batch_id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-52">{batch.batch_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{batch.batch_id.slice(0, 18)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={batchTypeLabel(batch.batch_type)} variant={batchTypeBadgeVariant(batch.batch_type)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <BookOpen className="h-3.5 w-3.5 text-gray-400" /> {batch.subject || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> {batch.grade || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 truncate max-w-36">{batch.teacher_name || '—'}</p>
                    {batch.teacher_email && <p className="text-xs text-gray-400">{batch.teacher_email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 truncate max-w-36">{batch.coordinator_name || '—'}</p>
                    {batch.coordinator_email && <p className="text-xs text-gray-400">{batch.coordinator_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Users className="h-3.5 w-3.5 text-gray-400" /> {batch.student_count}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={Trash2}
                        onClick={() => deleteBatch(batch.batch_id)}
                        className="text-red-500 hover:bg-red-50"
                        title="Delete batch"
                      />
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {/* ── Detail panel ── */}
        {selectedBatch && (
          <DetailPanel loading={detailLoading} emptyMessage="Could not load batch details">
            {detail && (
              <>
                <DetailHeader title={detail.batch.batch_name} subtitle={detail.batch.batch_id} onClose={() => setSelectedBatch(null)} />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <InfoCard label="Status"><StatusBadge status={detail.batch.status} /></InfoCard>
                  <InfoCard label="Type"><Badge label={batchTypeLabel(detail.batch.batch_type)} variant={batchTypeBadgeVariant(detail.batch.batch_type)} /></InfoCard>
                  <InfoCard label="Subject / Grade">
                    <p className="text-sm font-medium text-gray-800">{detail.batch.subject || '—'} — Grade {detail.batch.grade || '—'}</p>
                  </InfoCard>
                  <InfoCard label="Board">
                    <p className="text-sm font-medium text-gray-800">{detail.batch.board || '—'}</p>
                  </InfoCard>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InfoCard label="Teacher">
                    <p className="text-sm font-medium text-gray-800">{detail.batch.teacher_name || '—'}</p>
                    {detail.batch.teacher_email && <p className="text-xs text-gray-400">{detail.batch.teacher_email}</p>}
                  </InfoCard>
                  <InfoCard label="Coordinator">
                    <p className="text-sm font-medium text-gray-800">{detail.batch.coordinator_name || '—'}</p>
                    {detail.batch.coordinator_email && <p className="text-xs text-gray-400">{detail.batch.coordinator_email}</p>}
                  </InfoCard>
                </div>

                {/* Students */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" /> Students ({detail.students.length})
                  </h4>
                  {detail.students.length === 0 ? (
                    <EmptyState message="No students enrolled yet" />
                  ) : (
                    <TableWrapper>
                      <THead>
                        <TH>Student</TH>
                        <TH>Email</TH>
                        <TH>Parent</TH>
                        <TH>Added</TH>
                      </THead>
                      <tbody>
                        {detail.students.map(s => (
                          <TRow key={s.student_email}>
                            <td className="px-3 py-2 font-medium text-gray-800">{s.student_name || s.student_email}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{s.student_email}</td>
                            <td className="px-3 py-2">
                              {s.parent_email ? (
                                <span className="text-xs text-emerald-600">{s.parent_name || s.parent_email}</span>
                              ) : (
                                <span className="text-xs text-amber-500">Not assigned</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400">
                              {new Date(s.added_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                          </TRow>
                        ))}
                      </tbody>
                    </TableWrapper>
                  )}
                </div>

                {detail.batch.notes && (
                  <InfoCard label="Notes">
                    <p className="text-sm text-gray-600">{detail.batch.notes}</p>
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
