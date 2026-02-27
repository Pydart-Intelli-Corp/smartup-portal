// ═══════════════════════════════════════════════════════════════
// Teacher Ratings API — /api/v1/teacher/ratings
// Returns aggregate averages + recent individual ratings
// for the authenticated teacher.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({ success: false, error: 'Teacher access only' }, { status: 403 });
    }

    const email = user.id;

    // ── Aggregate averages ───────────────────────────────────
    const avgResult = await db.query(
      `SELECT
         ROUND(AVG(punctuality)::numeric,      2) AS punctuality,
         ROUND(AVG(teaching_quality)::numeric, 2) AS teaching_quality,
         ROUND(AVG(communication)::numeric,    2) AS communication,
         ROUND(AVG(overall)::numeric,          2) AS overall,
         COUNT(*)                                  AS total_count
       FROM session_ratings
       WHERE teacher_email = $1`,
      [email]
    );

    const avgRow = avgResult.rows[0];
    const averages = {
      punctuality:      parseFloat(String(avgRow.punctuality     ?? 0)),
      teaching_quality: parseFloat(String(avgRow.teaching_quality ?? 0)),
      communication:    parseFloat(String(avgRow.communication   ?? 0)),
      overall:          parseFloat(String(avgRow.overall         ?? 0)),
      total_count:      parseInt(  String(avgRow.total_count     ?? 0), 10),
    };

    // ── Recent individual ratings (last 30, with session info) ──
    const recentResult = await db.query(
      `SELECT
         sr.id,
         sr.session_id,
         sr.student_email,
         sr.batch_id,
         sr.punctuality,
         sr.teaching_quality,
         sr.communication,
         sr.overall,
         sr.comment,
         sr.is_anonymous,
         sr.created_at,
         bs.subject,
         bs.scheduled_date,
         b.batch_name
       FROM session_ratings sr
       LEFT JOIN batch_sessions bs ON bs.session_id = sr.session_id
       LEFT JOIN batches b         ON b.batch_id    = sr.batch_id
       WHERE sr.teacher_email = $1
       ORDER BY sr.created_at DESC
       LIMIT 30`,
      [email]
    );

    // ── Monthly trend (last 6 months) ────────────────────────
    const trendResult = await db.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
         ROUND(AVG(overall)::numeric, 2)                       AS avg_overall,
         COUNT(*)                                               AS count
       FROM session_ratings
       WHERE teacher_email = $1
         AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at)`,
      [email]
    );

    return NextResponse.json({
      success: true,
      data: {
        averages,
        recent:  recentResult.rows,
        monthly: trendResult.rows,
      },
    });
  } catch (err) {
    console.error('[teacher/ratings] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST: Submit a rating (students/parents use this) ────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['student', 'parent'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Students/parents only' }, { status: 403 });
    }

    const body = await req.json();
    const {
      session_id, teacher_email, batch_id,
      punctuality, teaching_quality, communication, overall,
      comment, is_anonymous,
    } = body;

    if (!session_id || !teacher_email) {
      return NextResponse.json({ success: false, error: 'session_id and teacher_email required' }, { status: 400 });
    }

    const studentEmail = user.id;

    const result = await db.query(
      `INSERT INTO session_ratings
         (session_id, student_email, teacher_email, batch_id,
          punctuality, teaching_quality, communication, overall,
          comment, is_anonymous)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (session_id, student_email) DO UPDATE
         SET punctuality      = EXCLUDED.punctuality,
             teaching_quality = EXCLUDED.teaching_quality,
             communication    = EXCLUDED.communication,
             overall          = EXCLUDED.overall,
             comment          = EXCLUDED.comment,
             is_anonymous     = EXCLUDED.is_anonymous
       RETURNING *`,
      [
        session_id, studentEmail, teacher_email, batch_id ?? null,
        punctuality ?? null, teaching_quality ?? null, communication ?? null, overall ?? null,
        comment ?? null, is_anonymous ?? false,
      ]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[teacher/ratings] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
