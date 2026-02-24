// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Exam Service
// ═══════════════════════════════════════════════════════════════
// Core exam logic: creation, grading, results
//
// Usage:
//   import { createExam, gradeAttempt, ... } from '@/lib/exam';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────

export interface ExamQuestion {
  id?: string;
  question_text: string;
  question_type: 'mcq' | 'descriptive';
  options: string[];
  correct_answer: number; // 0-based index
  marks: number;
  difficulty?: string;
  topic?: string;
  sort_order?: number;
}

export interface CreateExamInput {
  title: string;
  subject: string;
  grade: string;
  examType?: string;
  durationMinutes: number;
  passingMarks: number;
  totalMarks: number;
  scheduledAt?: string;
  endsAt?: string;
  createdBy: string;
  questions: ExamQuestion[];
  batchIds?: string[]; // room_ids to assign
}

// ── Create Exam ─────────────────────────────────────────────

export async function createExam(input: CreateExamInput) {
  return db.withTransaction(async (client) => {
    // Insert exam
    const examResult = await client.query(
      `INSERT INTO exams (
         title, subject, grade, exam_type, duration_minutes,
         passing_marks, total_marks, scheduled_at, ends_at, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.title, input.subject, input.grade,
        input.examType || 'online', input.durationMinutes,
        input.passingMarks, input.totalMarks,
        input.scheduledAt || null, input.endsAt || null,
        input.createdBy,
      ]
    );
    const exam = examResult.rows[0];

    // Insert questions
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      await client.query(
        `INSERT INTO exam_questions (
           exam_id, question_text, question_type, options,
           correct_answer, marks, difficulty, topic,
           subject, grade, sort_order, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          exam.id, q.question_text, q.question_type || 'mcq',
          JSON.stringify(q.options), q.correct_answer,
          q.marks || 1, q.difficulty || 'medium',
          q.topic || null, input.subject, input.grade,
          q.sort_order ?? i, input.createdBy,
        ]
      );
    }

    // Assign to batches
    if (input.batchIds && input.batchIds.length > 0) {
      for (const roomId of input.batchIds) {
        await client.query(
          `INSERT INTO exam_batch_assignments (exam_id, room_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [exam.id, roomId]
        );
      }
    }

    // Recalculate total_marks from questions
    const marksResult = await client.query(
      `SELECT COALESCE(SUM(marks), 0) AS total FROM exam_questions WHERE exam_id = $1`,
      [exam.id]
    );
    const totalFromQuestions = Number(marksResult.rows[0].total);
    if (totalFromQuestions > 0) {
      await client.query(
        `UPDATE exams SET total_marks = $1 WHERE id = $2`,
        [totalFromQuestions, exam.id]
      );
    }

    return { ...exam, total_marks: totalFromQuestions || exam.total_marks };
  });
}

// ── Get Exam with Questions ─────────────────────────────────

export async function getExamWithQuestions(examId: string, includeAnswers: boolean = false) {
  const examResult = await db.query(
    `SELECT * FROM exams WHERE id = $1`,
    [examId]
  );
  if (examResult.rows.length === 0) return null;

  const exam = examResult.rows[0];

  let questionSql = `SELECT id, question_text, question_type, options, marks, difficulty, topic, sort_order`;
  if (includeAnswers) questionSql += `, correct_answer`;
  questionSql += ` FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order`;

  const questionsResult = await db.query(questionSql, [examId]);

  return { ...exam, questions: questionsResult.rows };
}

// ── Start Exam Attempt ──────────────────────────────────────

export async function startExamAttempt(examId: string, studentEmail: string, studentName: string) {
  // Check if already attempted
  const existing = await db.query(
    `SELECT * FROM exam_attempts WHERE exam_id = $1 AND student_email = $2`,
    [examId, studentEmail]
  );
  if (existing.rows.length > 0) {
    const attempt = existing.rows[0] as Record<string, unknown>;
    if (attempt.status === 'submitted' || attempt.status === 'graded') {
      throw new Error('You have already taken this exam');
    }
    // Return existing in-progress attempt
    return attempt;
  }

  const result = await db.query(
    `INSERT INTO exam_attempts (exam_id, student_email, student_name, status)
     VALUES ($1, $2, $3, 'in_progress')
     RETURNING *`,
    [examId, studentEmail, studentName]
  );
  return result.rows[0];
}

// ── Submit and Grade Exam ───────────────────────────────────

export interface SubmitAnswerInput {
  question_id: string;
  selected_option: number | null;
  text_answer?: string;
}

export async function submitAndGradeExam(
  attemptId: string,
  answers: SubmitAnswerInput[]
) {
  return db.withTransaction(async (client) => {
    // Get attempt details
    const attemptResult = await client.query(
      `SELECT * FROM exam_attempts WHERE id = $1 AND status = 'in_progress'`,
      [attemptId]
    );
    if (attemptResult.rows.length === 0) {
      throw new Error('Attempt not found or already submitted');
    }
    const attempt = attemptResult.rows[0] as Record<string, unknown>;

    // Get all questions with correct answers
    const questionsResult = await client.query(
      `SELECT id, correct_answer, marks, question_type FROM exam_questions WHERE exam_id = $1`,
      [attempt.exam_id]
    );
    const questionMap = new Map<string, { correct_answer: number; marks: number; question_type: string }>();
    for (const q of questionsResult.rows as Array<Record<string, unknown>>) {
      questionMap.set(q.id as string, {
        correct_answer: q.correct_answer as number,
        marks: q.marks as number,
        question_type: q.question_type as string,
      });
    }

    let totalScore = 0;
    let totalPossible = 0;

    // Insert answers and grade MCQs
    for (const ans of answers) {
      const q = questionMap.get(ans.question_id);
      if (!q) continue;

      totalPossible += q.marks;
      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      if (q.question_type === 'mcq' && ans.selected_option !== null) {
        isCorrect = ans.selected_option === q.correct_answer;
        marksAwarded = isCorrect ? q.marks : 0;
        totalScore += marksAwarded;
      }

      await client.query(
        `INSERT INTO exam_answers (attempt_id, question_id, selected_option, text_answer, is_correct, marks_awarded)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (attempt_id, question_id) DO UPDATE
         SET selected_option = $3, text_answer = $4, is_correct = $5, marks_awarded = $6`,
        [attemptId, ans.question_id, ans.selected_option, ans.text_answer || null, isCorrect, marksAwarded]
      );
    }

    // Calculate grade letter
    const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const gradeLetter = getGradeLetter(percentage);

    // Update attempt
    await client.query(
      `UPDATE exam_attempts
       SET submitted_at = NOW(), score = $1, total_marks = $2,
           percentage = $3, grade_letter = $4, status = 'graded'
       WHERE id = $5`,
      [totalScore, totalPossible, percentage.toFixed(2), gradeLetter, attemptId]
    );

    return {
      score: totalScore,
      total_marks: totalPossible,
      percentage: Number(percentage.toFixed(2)),
      grade_letter: gradeLetter,
      status: 'graded',
    };
  });
}

// ── Grade Letter Calculator ─────────────────────────────────

function getGradeLetter(percentage: number): string {
  if (percentage >= 95) return 'A+';
  if (percentage >= 85) return 'A';
  if (percentage >= 75) return 'B+';
  if (percentage >= 65) return 'B';
  if (percentage >= 55) return 'C+';
  if (percentage >= 45) return 'C';
  if (percentage >= 35) return 'D';
  return 'F';
}

// ── Get Student Results ─────────────────────────────────────

export async function getStudentExamResults(studentEmail: string) {
  const result = await db.query(
    `SELECT ea.*, e.title, e.subject, e.grade, e.passing_marks,
            e.scheduled_at, e.results_published
     FROM exam_attempts ea
     JOIN exams e ON e.id = ea.exam_id
     WHERE ea.student_email = $1
     ORDER BY ea.created_at DESC`,
    [studentEmail]
  );
  return result.rows;
}

// ── Get Exam Results (for teacher) ──────────────────────────

export async function getExamResults(examId: string) {
  const result = await db.query(
    `SELECT ea.*, u.full_name AS student_display_name
     FROM exam_attempts ea
     LEFT JOIN portal_users u ON u.email = ea.student_email
     WHERE ea.exam_id = $1
     ORDER BY ea.score DESC`,
    [examId]
  );

  // Class stats
  const scores = result.rows.map((r: Record<string, unknown>) => Number(r.percentage || 0));
  const average = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
  const highest = scores.length > 0 ? Math.max(...scores) : 0;
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;

  return {
    results: result.rows,
    stats: {
      total_students: result.rows.length,
      average_percentage: Number(average.toFixed(2)),
      highest_percentage: highest,
      lowest_percentage: lowest,
    },
  };
}

// ── List Exams for Teacher ──────────────────────────────────

export async function getTeacherExams(teacherEmail: string) {
  const result = await db.query(
    `SELECT e.*,
            (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) AS question_count,
            (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id) AS attempt_count
     FROM exams e
     WHERE e.created_by = $1
     ORDER BY e.created_at DESC`,
    [teacherEmail]
  );
  return result.rows;
}

// ── List Exams for Student ──────────────────────────────────

export async function getStudentExams(studentEmail: string) {
  // Get exams assigned to batches this student belongs to
  const result = await db.query(
    `SELECT DISTINCT e.*,
            ea.status AS attempt_status,
            ea.score AS attempt_score,
            ea.percentage AS attempt_percentage,
            ea.grade_letter AS attempt_grade
     FROM exams e
     JOIN exam_batch_assignments eba ON eba.exam_id = e.id
     JOIN room_assignments ra ON ra.room_id = eba.room_id
     LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.student_email = $1
     WHERE ra.participant_email = $1
       AND ra.participant_type = 'student'
       AND e.published = true
     ORDER BY e.scheduled_at DESC NULLS LAST`,
    [studentEmail]
  );
  return result.rows;
}

// ── Question Bank ───────────────────────────────────────────

export async function getQuestionBank(filters: {
  subject?: string;
  grade?: string;
  difficulty?: string;
  topic?: string;
  createdBy?: string;
  limit?: number;
}) {
  let sql = `SELECT * FROM exam_questions WHERE exam_id IS NULL`;
  const params: unknown[] = [];

  if (filters.subject) {
    params.push(filters.subject);
    sql += ` AND subject = $${params.length}`;
  }
  if (filters.grade) {
    params.push(filters.grade);
    sql += ` AND grade = $${params.length}`;
  }
  if (filters.difficulty) {
    params.push(filters.difficulty);
    sql += ` AND difficulty = $${params.length}`;
  }
  if (filters.topic) {
    params.push(`%${filters.topic}%`);
    sql += ` AND topic ILIKE $${params.length}`;
  }
  if (filters.createdBy) {
    params.push(filters.createdBy);
    sql += ` AND created_by = $${params.length}`;
  }

  params.push(filters.limit || 100);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return result.rows;
}

export async function addToQuestionBank(question: ExamQuestion & { subject: string; grade: string; createdBy: string }) {
  const result = await db.query(
    `INSERT INTO exam_questions (
       exam_id, question_text, question_type, options,
       correct_answer, marks, difficulty, topic,
       subject, grade, created_by
     ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      question.question_text, question.question_type || 'mcq',
      JSON.stringify(question.options), question.correct_answer,
      question.marks || 1, question.difficulty || 'medium',
      question.topic || null, question.subject, question.grade,
      question.createdBy,
    ]
  );
  return result.rows[0];
}
