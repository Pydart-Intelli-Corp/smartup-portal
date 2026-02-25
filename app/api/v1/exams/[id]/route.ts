// ═══════════════════════════════════════════════════════════════
// Exam Detail API — GET, PUT /api/v1/exams/[id]
// Also: /api/v1/exams/[id]/start (POST) and /api/v1/exams/[id]/submit (POST)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getExamWithQuestions, startExamAttempt, submitAndGradeExam, getExamResults } from '@/lib/exam';
import { db } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/v1/exams/[id] — Get exam detail
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get results
    if (action === 'results') {
      if (!['teacher', 'owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      const results = await getExamResults(id);
      return NextResponse.json({ success: true, data: results });
    }

    // Include correct answers only for creators
    const includeAnswers = ['teacher', 'owner', 'academic_operator'].includes(user.role);
    const exam = await getExamWithQuestions(id, includeAnswers);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: exam });
  } catch (err) {
    console.error('[exams/[id]] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/v1/exams/[id] — Update exam (publish, update details)
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { published, results_published, title, scheduled_at, ends_at } = body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (published !== undefined) {
      params.push(published);
      updates.push(`published = $${params.length}`);
    }
    if (results_published !== undefined) {
      params.push(results_published);
      updates.push(`results_published = $${params.length}`);
    }
    if (title) {
      params.push(title);
      updates.push(`title = $${params.length}`);
    }
    if (scheduled_at) {
      params.push(scheduled_at);
      updates.push(`scheduled_at = $${params.length}`);
    }
    if (ends_at) {
      params.push(ends_at);
      updates.push(`ends_at = $${params.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const result = await db.query(
      `UPDATE exams SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[exams/[id]] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/exams/[id] — Start attempt or submit answers
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const { action, attempt_id, answers } = body;

    // Start attempt
    if (action === 'start') {
      if (user.role !== 'student' && user.role !== 'owner') {
        return NextResponse.json({ success: false, error: 'Only students can start exams' }, { status: 403 });
      }
      try {
        const attempt = await startExamAttempt(id, user.id, user.name);
        return NextResponse.json({ success: true, data: attempt });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start exam';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    // Submit answers
    if (action === 'submit') {
      if (!attempt_id || !answers) {
        return NextResponse.json({ success: false, error: 'attempt_id and answers required' }, { status: 400 });
      }
      try {
        const result = await submitAndGradeExam(attempt_id, answers);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit exam';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use "start" or "submit"' }, { status: 400 });
  } catch (err) {
    console.error('[exams/[id]] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
