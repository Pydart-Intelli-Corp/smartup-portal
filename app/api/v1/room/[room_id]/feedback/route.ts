import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/v1/room/[room_id]/feedback
 *
 * Submit student feedback for a class session.
 * Called by the FeedbackDialog when student leaves.
 *
 * Body: { student_email, student_name, rating (1-5), feedback_text?, tags? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const body = await req.json();
    const { student_email, student_name, rating, feedback_text, tags } = body;

    if (!student_email || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Missing student_email and valid rating (1-5)' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO student_feedback
         (room_id, student_email, student_name, rating, feedback_text, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (room_id, student_email) DO UPDATE SET
         rating = EXCLUDED.rating,
         feedback_text = EXCLUDED.feedback_text,
         tags = EXCLUDED.tags,
         created_at = NOW()`,
      [room_id, student_email, student_name || '', rating, feedback_text || '', tags || ''],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[feedback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/room/[room_id]/feedback
 *
 * Get all feedback for a room session.
 * Accessible to teacher, coordinator, academic_operator, owner, ghost, hr.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;

    const result = await db.query(
      `SELECT student_email, student_name, rating, feedback_text, tags, created_at
       FROM student_feedback
       WHERE room_id = $1
       ORDER BY created_at DESC`,
      [room_id],
    );

    // Compute summary
    const feedbacks = result.rows;
    const totalRating = feedbacks.reduce((sum, f) => sum + Number((f as Record<string, unknown>).rating ?? 0), 0);
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    return NextResponse.json({
      feedback: feedbacks,
      summary: {
        total_responses: feedbacks.length,
        average_rating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (err) {
    console.error('[feedback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
