// ═══════════════════════════════════════════════════════════════
// Teacher Exams — Client Component
// Create exams, view results, manage question bank
// Theme: light / emerald — shared UI components
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  StatCardSmall, Card, Badge, StatusBadge, Avatar,
  TableWrapper, THead, TH, TRow,
  LoadingState, EmptyState,
} from '@/components/dashboard/shared';
import {
  GraduationCap, FileText, Plus, Eye, Clock,
  Trophy, Users, CheckCircle2, Trash2, ChevronLeft,
  BookOpen, Award, BarChart2, TrendingUp, TrendingDown, ArrowUp, ArrowDown,
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

// ── Helpers ─────────────────────────────────────────────────

const GRADE_BADGE: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'A':  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'B+': 'bg-blue-100   text-blue-700    border-blue-200',
  'B':  'bg-blue-100   text-blue-700    border-blue-200',
  'C+': 'bg-amber-100  text-amber-700   border-amber-200',
  'C':  'bg-amber-100  text-amber-700   border-amber-200',
  'D':  'bg-orange-100 text-orange-700  border-orange-200',
  'F':  'bg-red-100    text-red-700     border-red-200',
};

const DIFFICULTY_STYLE: Record<string, string> = {
  easy:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  medium: 'bg-amber-50   text-amber-600   border-amber-200',
  hard:   'bg-red-50     text-red-600     border-red-200',
};

const emptyQuestion = (): QuestionInput => ({
  question_text: '', question_type: 'mcq',
  options: ['', '', '', ''], correct_answer: 0,
  marks: 1, difficulty: 'medium', topic: '',
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TeacherExamsClient({ userName, userEmail, userRole }: Props) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create' | 'results'>('list');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<{ results: ExamResult[]; stats: Record<string, number> } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Create form
  const [formTitle, setFormTitle]           = useState('');
  const [formSubject, setFormSubject]       = useState('');
  const [formGrade, setFormGrade]           = useState('');
  const [formDuration, setFormDuration]     = useState(60);
  const [formPassing, setFormPassing]       = useState(40);
  const [formScheduled, setFormScheduled]   = useState('');
  const [formQuestions, setFormQuestions]   = useState<QuestionInput[]>([emptyQuestion()]);
  const [creating, setCreating]             = useState(false);

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

  const viewResults = async (exam: Exam) => {
    setSelectedExam(exam);
    setResultsLoading(true);
    setTab('results');
    try {
      const res = await fetch(`/api/v1/exams/${exam.id}?action=results`);
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
          title: formTitle, subject: formSubject, grade: formGrade,
          durationMinutes: formDuration, passingMarks: formPassing, totalMarks,
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

  const updateQuestion = (idx: number, field: string, value: unknown) =>
    setFormQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));

  const updateOption = (qIdx: number, optIdx: number, value: string) =>
    setFormQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options]; opts[optIdx] = value;
      return { ...q, options: opts };
    }));

  // Summary stats
  const published     = exams.filter(e => e.published).length;
  const unpublished   = exams.filter(e => !e.published).length;
  const totalAttempts = exams.reduce((s, e) => s + e.attempt_count, 0);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">

        {/* ── Header ── */}
        <PageHeader icon={GraduationCap} title="Exam Management" subtitle="Create exams, view results and analytics">
          <div className="flex items-center gap-2">
            <RefreshButton loading={loading} onClick={fetchExams} />
            <Button icon={Plus} size="sm" onClick={() => setTab('create')}>
              Create Exam
            </Button>
          </div>
        </PageHeader>

        {/* ── Stats (list only) ── */}
        {tab === 'list' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCardSmall icon={FileText}     label="Total Exams" value={exams.length}   variant="info" />
            <StatCardSmall icon={CheckCircle2} label="Published"   value={published}      variant="success" />
            <StatCardSmall icon={BookOpen}     label="Drafts"      value={unpublished}    variant="warning" />
            <StatCardSmall icon={Users}        label="Attempts"    value={totalAttempts}  variant="default" />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          {([
            { key: 'list',    label: 'My Exams',   icon: FileText  },
            { key: 'create',  label: 'Create New', icon: Plus      },
            ...(selectedExam ? [{ key: 'results', label: 'Results', icon: BarChart2 }] : []),
          ] as { key: 'list'|'create'|'results'; label: string; icon: typeof FileText }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === t.key
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════
            LIST TAB
        ══════════════════════════════════════════════════ */}
        {tab === 'list' && (
          loading ? <LoadingState /> :
          exams.length === 0 ? (
            <div className="py-4">
              <EmptyState icon={FileText} message="No exams created yet — create your first exam to get started" />
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map(exam => (
                <Card key={exam.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                      <GraduationCap className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{exam.title}</h3>
                        {exam.published
                          ? <Badge label="Published" variant="success" icon={CheckCircle2} />
                          : <Badge label="Draft" variant="warning" />}
                        {exam.results_published && <Badge label="Results Out" variant="primary" icon={Award} />}
                      </div>
                      <p className="text-xs text-gray-500">
                        {exam.subject} · Grade {exam.grade} · {exam.question_count} questions · {exam.total_marks} marks
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" /> {exam.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-gray-400" /> {exam.attempt_count} attempt{exam.attempt_count !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-gray-400" /> Pass: {exam.passing_marks}/{exam.total_marks}
                        </span>
                        {exam.scheduled_at && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <Clock className="h-3 w-3" />
                            {new Date(exam.scheduled_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exam.attempt_count > 0 && (
                        <Button size="xs" variant="ghost" icon={Eye} onClick={() => viewResults(exam)}>
                          Results
                        </Button>
                      )}
                      {!exam.published && (
                        <Button size="xs" onClick={() => publishExam(exam.id)}>
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ══════════════════════════════════════════════════
            CREATE TAB
        ══════════════════════════════════════════════════ */}
        {tab === 'create' && (
          <div className="space-y-6">
            {/* Exam details card */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" /> Exam Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldGroup label="Title *">
                  <input
                    value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    placeholder="e.g. Mid-Term Mathematics"
                  />
                </FieldGroup>
                <FieldGroup label="Subject *">
                  <input
                    value={formSubject} onChange={e => setFormSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    placeholder="e.g. Mathematics"
                  />
                </FieldGroup>
                <FieldGroup label="Grade *">
                  <input
                    value={formGrade} onChange={e => setFormGrade(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    placeholder="e.g. 10"
                  />
                </FieldGroup>
                <FieldGroup label="Duration (minutes)">
                  <input
                    type="number" value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </FieldGroup>
                <FieldGroup label="Passing Marks">
                  <input
                    type="number" value={formPassing} onChange={e => setFormPassing(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </FieldGroup>
                <FieldGroup label="Schedule (optional)">
                  <input
                    type="datetime-local" value={formScheduled} onChange={e => setFormScheduled(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </FieldGroup>
              </div>
            </Card>

            {/* Questions card */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  Questions ({formQuestions.length})
                  <span className="text-xs font-normal text-gray-400">
                    — {formQuestions.reduce((s, q) => s + q.marks, 0)} total marks
                  </span>
                </h3>
                <Button size="xs" variant="ghost" icon={Plus}
                  onClick={() => setFormQuestions(prev => [...prev, emptyQuestion()])}>
                  Add Question
                </Button>
              </div>

              <div className="space-y-4">
                {formQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    {/* Question header row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                        Q{qIdx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Difficulty */}
                        <select
                          value={q.difficulty}
                          onChange={e => updateQuestion(qIdx, 'difficulty', e.target.value)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium bg-transparent ${DIFFICULTY_STYLE[q.difficulty] || 'border-gray-200 text-gray-600'}`}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        {/* Marks */}
                        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5">
                          <input
                            type="number" value={q.marks} min={1}
                            onChange={e => updateQuestion(qIdx, 'marks', Number(e.target.value))}
                            className="w-10 text-center text-xs text-gray-700 bg-transparent outline-none"
                            title="Marks"
                          />
                          <span className="text-[10px] text-gray-400">mark{q.marks !== 1 ? 's' : ''}</span>
                        </div>
                        {/* Delete */}
                        {formQuestions.length > 1 && (
                          <button
                            onClick={() => setFormQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                            className="rounded-lg border border-red-200 bg-red-50 p-1 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question text */}
                    <textarea
                      value={q.question_text}
                      onChange={e => updateQuestion(qIdx, 'question_text', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300 mb-3 resize-none"
                      rows={2}
                      placeholder="Enter the question text…"
                    />

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuestion(qIdx, 'correct_answer', optIdx)}
                            className={`h-6 w-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
                              ${q.correct_answer === optIdx
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-gray-300 hover:border-emerald-400'}`}
                          >
                            {q.correct_answer === optIdx && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                          </button>
                          <input
                            value={opt}
                            onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                            className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 transition-colors
                              ${q.correct_answer === optIdx
                                ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-300'
                                : 'border-gray-200 bg-white focus:border-emerald-400 focus:ring-emerald-300'}`}
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Topic */}
                    <input
                      value={q.topic}
                      onChange={e => updateQuestion(qIdx, 'topic', e.target.value)}
                      className="mt-2.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                      placeholder="Topic (optional)"
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Form actions */}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setTab('list')}>Cancel</Button>
              <Button
                onClick={createExam}
                disabled={creating || !formTitle || !formSubject || !formGrade}
                loading={creating}
              >
                {creating ? 'Creating…' : 'Create Exam'}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            RESULTS TAB
        ══════════════════════════════════════════════════ */}
        {tab === 'results' && (
          <div className="space-y-5">
            {/* Back */}
            <button
              onClick={() => { setTab('list'); setSelectedExam(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back to Exams
            </button>

            {/* Exam info */}
            {selectedExam && (
              <Card className="p-4 border-emerald-200 bg-emerald-50/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                    <GraduationCap className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedExam.title}</p>
                    <p className="text-xs text-gray-500">
                      {selectedExam.subject} · Grade {selectedExam.grade} · {selectedExam.total_marks} marks · Pass: {selectedExam.passing_marks}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {resultsLoading ? <LoadingState /> : results ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCardSmall icon={Users}       label="Students" value={results.stats.total_students}            variant="info" />
                  <StatCardSmall icon={BarChart2}   label="Average"  value={`${results.stats.average_percentage}%`}  variant="default" />
                  <StatCardSmall icon={CheckCircle2} label="Highest" value={`${results.stats.highest_percentage}%`}  variant="success" />
                  <StatCardSmall icon={Trophy}      label="Lowest"   value={`${results.stats.lowest_percentage}%`}   variant="warning" />
                </div>

                {/* ── Top & Bottom Performer Highlights ── */}
                {results.results.length > 0 && (() => {
                  const sorted = [...results.results].sort((a, b) => b.percentage - a.percentage);
                  const topPerformers = sorted.slice(0, 3);
                  const passingPct = selectedExam ? (selectedExam.passing_marks / selectedExam.total_marks) * 100 : 40;
                  const belowPassing = sorted.filter(r => r.percentage < passingPct);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Top Performers */}
                      <Card className="p-4 border-emerald-200 bg-emerald-50/30">
                        <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <ArrowUp className="h-3.5 w-3.5" /> Top Performers
                        </h4>
                        <div className="space-y-2">
                          {topPerformers.map((r, i) => (
                            <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/80 border border-emerald-100 p-2.5">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                                i === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 'bg-emerald-100 text-emerald-700'
                              }`}>{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{r.student_display_name || r.student_name}</p>
                                <p className="text-[10px] text-gray-500">{r.score}/{r.total_marks}</p>
                              </div>
                              <span className="text-sm font-bold text-emerald-600">{r.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </Card>

                      {/* Below Passing */}
                      <Card className={`p-4 ${belowPassing.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                        <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <ArrowDown className="h-3.5 w-3.5" /> Needs Improvement
                        </h4>
                        {belowPassing.length === 0 ? (
                          <p className="text-xs text-gray-500 py-3">All students passed! 🎉</p>
                        ) : (
                          <div className="space-y-2">
                            {belowPassing.slice(0, 5).map((r, i) => (
                              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/80 border border-red-100 p-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold shrink-0">!</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{r.student_display_name || r.student_name}</p>
                                  <p className="text-[10px] text-gray-500">{r.score}/{r.total_marks}</p>
                                </div>
                                <span className="text-sm font-bold text-red-600">{r.percentage}%</span>
                              </div>
                            ))}
                            {belowPassing.length > 5 && (
                              <p className="text-[10px] text-gray-400 text-center">+{belowPassing.length - 5} more</p>
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  );
                })()}

                {/* ── Grade Distribution ── */}
                {results.results.length > 0 && (() => {
                  const buckets: Record<string, number> = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 };
                  results.results.forEach((r: ExamResult) => {
                    if (buckets[r.grade_letter] !== undefined) buckets[r.grade_letter]++;
                  });
                  const maxCount = Math.max(...Object.values(buckets), 1);
                  const barColors: Record<string, string> = {
                    'A+': 'bg-emerald-500', 'A': 'bg-emerald-400', 'B+': 'bg-blue-500', 'B': 'bg-blue-400',
                    'C+': 'bg-amber-500', 'C': 'bg-amber-400', 'D': 'bg-orange-500', 'F': 'bg-red-500',
                  };
                  return (
                    <Card className="p-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                        <BarChart2 className="h-3.5 w-3.5" /> Grade Distribution
                      </h4>
                      <div className="flex items-end gap-2 h-28">
                        {Object.entries(buckets).map(([grade, count]) => (
                          <div key={grade} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-gray-700">{count}</span>
                            <div className="w-full rounded-t-md bg-gray-100 relative" style={{ height: '80px' }}>
                              <div
                                className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${barColors[grade] || 'bg-gray-400'}`}
                                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-gray-500">{grade}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })()}

                {/* Results table — with highlight rows */}
                <TableWrapper>
                  <THead>
                    <TH>Student</TH>
                    <TH className="text-center">Score</TH>
                    <TH className="text-center">Percentage</TH>
                    <TH className="text-center">Grade</TH>
                    <TH className="text-center">Status</TH>
                    <TH className="text-right">Submitted</TH>
                  </THead>
                  <tbody>
                    {results.results.map((r: ExamResult, idx: number) => {
                      const isTop = idx === 0;
                      const passingPct = selectedExam ? (selectedExam.passing_marks / selectedExam.total_marks) * 100 : 40;
                      const isFailing = r.percentage < passingPct;
                      return (
                        <TRow key={idx} className={isTop ? 'bg-emerald-50/60' : isFailing ? 'bg-red-50/40' : ''}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={r.student_display_name || r.student_name || r.student_email} size="sm" />
                              <div>
                                <span className="text-sm text-gray-800 font-medium flex items-center gap-1">
                                  {r.student_display_name || r.student_name || r.student_email}
                                  {isTop && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
                                  {isFailing && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-sm font-semibold text-gray-700">
                            {r.score}/{r.total_marks}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-bold ${
                              r.percentage >= 80 ? 'text-emerald-600'
                              : r.percentage >= 60 ? 'text-blue-600'
                              : r.percentage >= 40 ? 'text-amber-600'
                              : 'text-red-600'
                            }`}>{r.percentage}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${GRADE_BADGE[r.grade_letter] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {r.grade_letter}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-400">
                            {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                        </TRow>
                      );
                    })}
                  </tbody>
                </TableWrapper>
              </>
            ) : (
              <EmptyState icon={BarChart2} message="No results found for this exam" />
            )}
          </div>
        )}

      </div>
    </DashboardShell>
  );
}

// ── Small helper: labelled form field ─────────────────────
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
