// ═══════════════════════════════════════════════════════════════
// Take Exam — Client Component
// Full exam-taking UI with timer, question nav, auto-submit
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Flag, Send, ArrowLeft, Loader2,
} from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'descriptive';
  options: string[];
  marks: number;
  sort_order: number;
}

interface ExamData {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  questions: Question[];
}

interface AttemptData {
  id: string;
  started_at: string;
  status: string;
}

interface ResultData {
  score: number;
  total_marks: number;
  percentage: number;
  grade_letter: string;
}

interface Props {
  examId: string;
  userName: string;
  userEmail: string;
}

export default function TakeExamClient({ examId, userName, userEmail }: Props) {
  const router = useRouter();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'instructions' | 'exam' | 'submitting' | 'result'>('loading');
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch exam data
  const fetchExam = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/exams/${examId}`);
      const json = await res.json();
      if (json.success) {
        setExam(json.data);
        setPhase('instructions');
      } else {
        setError(json.error || 'Failed to load exam');
      }
    } catch { setError('Network error'); }
  }, [examId]);

  useEffect(() => { fetchExam(); }, [fetchExam]);

  // Start exam attempt
  const startExam = async () => {
    try {
      const res = await fetch(`/api/v1/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const json = await res.json();
      if (json.success) {
        setAttempt(json.data);
        setTimeLeft((exam?.duration_minutes || 60) * 60);
        setPhase('exam');
      } else {
        setError(json.error);
      }
    } catch { setError('Failed to start exam'); }
  };

  // Timer
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Submit
  const handleSubmit = async () => {
    if (!attempt || phase === 'submitting') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('submitting');
    try {
      const answerPayload = Object.entries(answers).map(([qid, selected]) => ({
        question_id: qid,
        selected_option: selected,
      }));

      const res = await fetch(`/api/v1/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', attemptId: attempt.id, answers: answerPayload }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setPhase('result');
      } else {
        setError(json.error);
        setPhase('exam');
      }
    } catch {
      setError('Failed to submit exam');
      setPhase('exam');
    }
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      return next;
    });
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 rounded-xl border border-red-800 p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Error</h2>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <button onClick={() => router.push('/student/exams')}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // ── Instructions Screen ──────────────────────────────────
  if (phase === 'instructions' && exam) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-lg w-full">
          <h1 className="text-2xl font-bold text-white mb-2">{exam.title}</h1>
          <p className="text-sm text-gray-400 mb-6">{exam.subject} · Grade {exam.grade}</p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-400">Duration</span>
              <span className="text-sm font-semibold text-white">{exam.duration_minutes} minutes</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-400">Total Marks</span>
              <span className="text-sm font-semibold text-white">{exam.total_marks}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-400">Passing Marks</span>
              <span className="text-sm font-semibold text-white">{exam.passing_marks}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
              <span className="text-sm text-gray-400">Questions</span>
              <span className="text-sm font-semibold text-white">{exam.questions?.length || 0}</span>
            </div>
          </div>

          <div className="rounded-lg bg-yellow-900/20 border border-yellow-800/50 p-4 mb-6">
            <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Instructions
            </h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Each question carries marks as indicated</li>
              <li>• Auto-submit when time runs out</li>
              <li>• You can flag questions for review</li>
              <li>• Once submitted, you cannot retake this exam</li>
              <li>• Do not refresh or close the browser during the exam</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/student/exams')}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition">
              <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
            </button>
            <button onClick={startExam}
              className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
              Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Result Screen ────────────────────────────────────────
  if (phase === 'result' && result) {
    const passed = result.percentage >= ((exam?.passing_marks || 0) / (exam?.total_marks || 1)) * 100;
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md w-full text-center">
          <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-4 ${passed ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
            {passed
              ? <CheckCircle2 className="h-10 w-10 text-green-400" />
              : <AlertTriangle className="h-10 w-10 text-red-400" />
            }
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {passed ? 'Congratulations!' : 'Keep Trying!'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {passed ? 'You passed the exam' : 'You did not meet the passing criteria'}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-xs text-gray-500">Score</p>
              <p className="text-xl font-bold text-white">{result.score}/{result.total_marks}</p>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-xs text-gray-500">Percentage</p>
              <p className="text-xl font-bold text-white">{result.percentage}%</p>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-xs text-gray-500">Grade</p>
              <p className="text-xl font-bold text-violet-400">{result.grade_letter}</p>
            </div>
            <div className="rounded-lg bg-gray-800 p-4">
              <p className="text-xs text-gray-500">Status</p>
              <p className={`text-xl font-bold ${passed ? 'text-green-400' : 'text-red-400'}`}>
                {passed ? 'PASS' : 'FAIL'}
              </p>
            </div>
          </div>

          <button onClick={() => router.push('/student/exams')}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  // ── Exam Screen ──────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-sm text-gray-400">Submitting your exam...</p>
        </div>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-white">{exam?.title}</h1>
            <p className="text-xs text-gray-400">{userName} · {exam?.subject}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-bold
              ${timeLeft <= 300 ? 'bg-red-900/40 text-red-400 animate-pulse' : 'bg-gray-800 text-white'}`}>
              <Clock className="h-4 w-4" />
              {fmtTime(timeLeft)}
            </div>
            <button onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500 transition">
              <Send className="h-4 w-4" /> Submit
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-4 p-4">
        {/* Question Area */}
        <div className="space-y-4">
          {q && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">Question {currentQ + 1} of {questions.length}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-violet-400">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                  <button onClick={() => toggleFlag(q.id)}
                    className={`rounded p-1 hover:bg-gray-800 ${flagged.has(q.id) ? 'text-yellow-400' : 'text-gray-600'}`}>
                    <Flag className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-white text-base mb-6 leading-relaxed">{q.question_text}</p>

              {q.question_type === 'mcq' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt: string, idx: number) => (
                    <button key={idx} onClick={() => selectAnswer(q.id, idx)}
                      className={`w-full text-left rounded-lg border p-3 text-sm transition
                        ${answers[q.id] === idx
                          ? 'border-violet-500 bg-violet-900/30 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'}`}>
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-gray-600 mr-3 text-xs font-semibold">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
              className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-xs text-gray-500">{answeredCount}/{questions.length} answered</span>
            <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
              disabled={currentQ === questions.length - 1}
              className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Question Navigation Sidebar */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 h-fit lg:sticky lg:top-20">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">Questions</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((question, idx) => {
              const answered = answers[question.id] !== undefined;
              const isFlagged = flagged.has(question.id);
              const isCurrent = idx === currentQ;
              return (
                <button key={question.id} onClick={() => setCurrentQ(idx)}
                  className={`h-9 w-9 rounded-lg text-xs font-semibold transition border
                    ${isCurrent ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-gray-700'}
                    ${answered ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-400'}
                    ${isFlagged ? 'ring-2 ring-yellow-500/40' : ''}
                    hover:bg-gray-700`}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 text-[10px] text-gray-500">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-green-900/40 border border-green-700" /> Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-gray-800 border border-gray-700" /> Not Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-gray-800 border border-gray-700 ring-2 ring-yellow-500/40" /> Flagged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
