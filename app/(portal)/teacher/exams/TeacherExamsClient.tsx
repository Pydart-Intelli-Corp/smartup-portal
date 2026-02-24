// ═══════════════════════════════════════════════════════════════
// Teacher Exams — Client Component
// Create exams, view results, manage question bank
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, BookOpen, User, FileText, Plus, Eye, Clock,
  Trophy, Users, RefreshCw, CheckCircle2, ChevronDown, Search,
  GraduationCap, Trash2, X,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  exam_type: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  published: boolean;
  results_published: boolean;
  scheduled_at: string | null;
  question_count: number;
  attempt_count: number;
  created_at: string;
}

interface ExamResult {
  student_email: string;
  student_name: string;
  student_display_name: string | null;
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
  status: string;
  submitted_at: string;
}

interface QuestionInput {
  question_text: string;
  question_type: 'mcq' | 'descriptive';
  options: string[];
  correct_answer: number;
  marks: number;
  difficulty: string;
  topic: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

// ── Constants ───────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-green-400', A: 'text-green-400',
  'B+': 'text-blue-400', B: 'text-blue-400',
  'C+': 'text-yellow-400', C: 'text-yellow-400',
  D: 'text-orange-400', F: 'text-red-400',
};

const emptyQuestion = (): QuestionInput => ({
  question_text: '', question_type: 'mcq',
  options: ['', '', '', ''], correct_answer: 0,
  marks: 1, difficulty: 'medium', topic: '',
});

export default function TeacherExamsClient({ userName, userEmail, userRole }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create' | 'results'>('list');
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [results, setResults] = useState<{ results: ExamResult[]; stats: Record<string, number> } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formDuration, setFormDuration] = useState(60);
  const [formPassing, setFormPassing] = useState(40);
  const [formScheduled, setFormScheduled] = useState('');
  const [formQuestions, setFormQuestions] = useState<QuestionInput[]>([emptyQuestion()]);
  const [creating, setCreating] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
    { label: 'Exams', href: '/teacher/exams', icon: FileText, active: true },
    { label: 'My Classes', href: '/teacher', icon: BookOpen },
    { label: 'Profile', href: '/teacher', icon: User },
  ];

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/exams?role=teacher');
      const json = await res.json();
      if (json.success) setExams(json.data.exams || []);
    } catch (e) { console.error('Failed to load exams', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const viewResults = async (examId: string) => {
    setSelectedExam(examId);
    setResultsLoading(true);
    setTab('results');
    try {
      const res = await fetch(`/api/v1/exams/${examId}?action=results`);
      const json = await res.json();
      if (json.success) setResults(json.data);
    } catch (e) { console.error('Failed to load results', e); }
    setResultsLoading(false);
  };

  const publishExam = async (examId: string) => {
    try {
      await fetch(`/api/v1/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });
      fetchExams();
    } catch (e) { console.error('Failed to publish', e); }
  };

  const createExam = async () => {
    if (!formTitle || !formSubject || !formGrade) return;
    setCreating(true);
    try {
      const totalMarks = formQuestions.reduce((s, q) => s + q.marks, 0);
      const res = await fetch('/api/v1/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          subject: formSubject,
          grade: formGrade,
          durationMinutes: formDuration,
          passingMarks: formPassing,
          totalMarks,
          scheduledAt: formScheduled || null,
          questions: formQuestions.map((q, i) => ({ ...q, sort_order: i })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFormTitle(''); setFormSubject(''); setFormGrade('');
        setFormQuestions([emptyQuestion()]); setFormDuration(60); setFormPassing(40);
        setTab('list');
        fetchExams();
      } else {
        alert(json.error || 'Failed to create exam');
      }
    } catch (e) { console.error('Create exam failed', e); }
    setCreating(false);
  };

  const updateQuestion = (idx: number, field: string, value: unknown) => {
    setFormQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setFormQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-emerald-400" /> Exam Management
          </h1>
          <div className="flex gap-2">
            <button onClick={fetchExams} disabled={loading}
              className="rounded border border-border bg-muted px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent">
              <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setTab('create')}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
              <Plus className="h-3 w-3 inline mr-1" /> Create Exam
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          {[
            { key: 'list' as const, label: 'My Exams' },
            { key: 'create' as const, label: 'Create' },
            ...(selectedExam ? [{ key: 'results' as const, label: 'Results' }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition
                ${tab === t.key ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── LIST TAB ────────────────────────────────────── */}
        {tab === 'list' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">No exams created yet</p>
              <button onClick={() => setTab('create')} className="mt-3 text-sm text-emerald-400 hover:underline">
                Create your first exam
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map(exam => (
                <div key={exam.id} className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{exam.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exam.subject} · Grade {exam.grade} · {exam.question_count} questions · {exam.total_marks} marks
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {exam.published ? (
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase border border-green-700 text-green-400">
                          Published
                        </span>
                      ) : (
                        <button onClick={() => publishExam(exam.id)}
                          className="rounded px-2 py-1 text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500">
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration_minutes}m</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {exam.attempt_count} attempts</span>
                    <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> Pass: {exam.passing_marks}</span>
                    {exam.attempt_count > 0 && (
                      <button onClick={() => viewResults(exam.id)}
                        className="ml-auto text-emerald-400 hover:underline flex items-center gap-1">
                        <Eye className="h-3 w-3" /> View Results
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ─── CREATE TAB ──────────────────────────────────── */}
        {tab === 'create' && (
          <div className="space-y-6">
            {/* Exam Details */}
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Exam Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Title *</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="Mid-Term Mathematics" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Subject *</label>
                  <input value={formSubject} onChange={e => setFormSubject(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="Mathematics" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Grade *</label>
                  <input value={formGrade} onChange={e => setFormGrade(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                    placeholder="10" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Duration (minutes)</label>
                  <input type="number" value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Passing Marks</label>
                  <input type="number" value={formPassing} onChange={e => setFormPassing(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Schedule (optional)</label>
                  <input type="datetime-local" value={formScheduled} onChange={e => setFormScheduled(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Questions ({formQuestions.length}) — Total: {formQuestions.reduce((s, q) => s + q.marks, 0)} marks
                </h3>
                <button onClick={() => setFormQuestions(prev => [...prev, emptyQuestion()])}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add Question
                </button>
              </div>

              <div className="space-y-4">
                {formQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="rounded-lg border border-border bg-card/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground font-semibold">Q{qIdx + 1}</span>
                      <div className="flex items-center gap-2">
                        <select value={q.difficulty}
                          onChange={e => updateQuestion(qIdx, 'difficulty', e.target.value)}
                          className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground/80">
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        <input type="number" value={q.marks} min={1}
                          onChange={e => updateQuestion(qIdx, 'marks', Number(e.target.value))}
                          className="w-14 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground/80 text-center"
                          title="Marks" />
                        {formQuestions.length > 1 && (
                          <button onClick={() => setFormQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                            className="text-red-500 hover:text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea value={q.question_text}
                      onChange={e => updateQuestion(qIdx, 'question_text', e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground mb-3 resize-none"
                      rows={2} placeholder="Enter question text..." />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <button onClick={() => updateQuestion(qIdx, 'correct_answer', optIdx)}
                            className={`h-6 w-6 rounded-full border-2 shrink-0 flex items-center justify-center
                              ${q.correct_answer === optIdx
                                ? 'border-green-500 bg-green-500'
                                : 'border-muted-foreground/50 hover:border-muted-foreground'}`}>
                            {q.correct_answer === optIdx && <CheckCircle2 className="h-4 w-4 text-white" />}
                          </button>
                          <input value={opt} onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                            className="flex-1 rounded border border-border bg-muted px-2 py-1.5 text-xs text-foreground/80"
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`} />
                        </div>
                      ))}
                    </div>

                    <input value={q.topic} onChange={e => updateQuestion(qIdx, 'topic', e.target.value)}
                      className="mt-2 w-full rounded border border-border bg-muted px-2 py-1.5 text-xs text-foreground/80"
                      placeholder="Topic (optional)" />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <button onClick={() => setTab('list')}
                className="rounded-lg border border-border bg-muted px-6 py-2 text-sm text-foreground/80 hover:bg-accent">
                Cancel
              </button>
              <button onClick={createExam} disabled={creating || !formTitle || !formSubject || !formGrade}
                className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Exam'}
              </button>
            </div>
          </div>
        )}

        {/* ─── RESULTS TAB ─────────────────────────────────── */}
        {tab === 'results' && (
          resultsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : results ? (
            <div className="space-y-4">
              <button onClick={() => { setTab('list'); setSelectedExam(null); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                ← Back to Exams
              </button>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Students', value: results.stats.total_students, color: 'text-blue-400' },
                  { label: 'Average', value: `${results.stats.average_percentage}%`, color: 'text-emerald-400' },
                  { label: 'Highest', value: `${results.stats.highest_percentage}%`, color: 'text-green-400' },
                  { label: 'Lowest', value: `${results.stats.lowest_percentage}%`, color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Results Table */}
              <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-card/50 text-muted-foreground text-xs">
                      <th className="text-left px-4 py-3">Student</th>
                      <th className="text-center px-4 py-3">Score</th>
                      <th className="text-center px-4 py-3">%</th>
                      <th className="text-center px-4 py-3">Grade</th>
                      <th className="text-center px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r: ExamResult, idx: number) => (
                      <tr key={idx} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="text-foreground text-sm">{r.student_display_name || r.student_name || r.student_email}</p>
                          <p className="text-xs text-muted-foreground">{r.student_email}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-foreground font-mono">
                          {r.score}/{r.total_marks}
                        </td>
                        <td className="px-4 py-3 text-center text-foreground">{r.percentage}%</td>
                        <td className={`px-4 py-3 text-center font-bold ${GRADE_COLORS[r.grade_letter] || 'text-muted-foreground'}`}>
                          {r.grade_letter}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            r.status === 'graded' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No results found</p>
          )
        )}
      </div>
    </DashboardShell>
  );
}
