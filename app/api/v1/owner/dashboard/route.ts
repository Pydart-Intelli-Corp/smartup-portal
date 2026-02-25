// ═══════════════════════════════════════════════════════════════
// Owner API — /api/v1/owner/dashboard
// Single endpoint returning all dashboard metrics, charts data
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getOwner(req);
  if (!user)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // Auto-heal: end rooms that are still 'live' but have exceeded their scheduled duration
    await db.query(
      `UPDATE rooms SET status = 'ended', updated_at = NOW()
       WHERE status = 'live'
         AND NOW() > (scheduled_start + (duration_minutes || ' minutes')::interval)`
    );

    // Run all queries in parallel for speed
    const [
      roomsResult,
      userStatsResult,
      recentRoomsResult,
      dailyClassesResult,
      subjectDistResult,
      gradeDistResult,
      recentUsersResult,
      cancelledResult,
    ] = await Promise.all([
      // 1. Room status counts
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM rooms
        GROUP BY status
        ORDER BY count DESC
      `),

      // 2. User counts by role
      db.query(`
        SELECT portal_role AS role, COUNT(*)::int AS count
        FROM portal_users
        WHERE is_active = true
        GROUP BY portal_role
        ORDER BY count DESC
      `),

      // 3. Recent rooms (last 100)
      db.query(`
        SELECT r.room_id, r.room_name, r.subject, r.grade,
               r.coordinator_email, r.teacher_email, r.status,
               r.scheduled_start, r.duration_minutes,
               (SELECT COUNT(*) FROM room_assignments ra
                WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
        FROM rooms r
        ORDER BY r.scheduled_start DESC
        LIMIT 100
      `),

      // 4. Classes per day (last 30 days) for area chart
      db.query(`
        SELECT DATE(scheduled_start) AS date,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'live' OR status = 'ended')::int AS conducted,
               COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM rooms
        WHERE scheduled_start >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(scheduled_start)
        ORDER BY date ASC
      `),

      // 5. Subject distribution
      db.query(`
        SELECT COALESCE(subject, 'Unassigned') AS subject, COUNT(*)::int AS count
        FROM rooms
        GROUP BY subject
        ORDER BY count DESC
        LIMIT 10
      `),

      // 6. Grade distribution
      db.query(`
        SELECT COALESCE(grade, 'Unassigned') AS grade, COUNT(*)::int AS count
        FROM rooms
        GROUP BY grade
        ORDER BY grade ASC
      `),

      // 7. Recently added users (last 10)
      db.query(`
        SELECT email, display_name, portal_role, created_at
        FROM portal_users
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 10
      `),

      // 8. Cancellation stats (last 30 days)
      db.query(`
        SELECT COUNT(*)::int AS total_cancelled
        FROM rooms
        WHERE status = 'cancelled'
          AND scheduled_start >= NOW() - INTERVAL '30 days'
      `),
    ]);

    // Process status counts into a map
    const statusCounts: Record<string, number> = {};
    for (const row of roomsResult.rows as { status: string; count: number }[]) {
      statusCounts[row.status] = row.count;
    }

    const totalRooms = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const totalUsers = (userStatsResult.rows as { count: number }[]).reduce(
      (a, b) => a + b.count,
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        // Summary cards
        summary: {
          totalBatches: totalRooms,
          liveBatches: statusCounts['live'] || 0,
          scheduledBatches: statusCounts['scheduled'] || 0,
          completedBatches: statusCounts['ended'] || 0,
          cancelledBatches: statusCounts['cancelled'] || 0,
          totalUsers,
          cancelledLast30: cancelledResult.rows[0]?.total_cancelled || 0,
        },

        // User breakdown
        usersByRole: userStatsResult.rows,

        // Room list
        rooms: recentRoomsResult.rows,

        // Chart: daily classes trend
        dailyClasses: dailyClassesResult.rows.map((r: any) => ({
          date: r.date,
          total: r.total,
          conducted: r.conducted,
          cancelled: r.cancelled,
        })),

        // Chart: subject distribution (pie)
        subjectDistribution: subjectDistResult.rows,

        // Chart: grade distribution (bar)
        gradeDistribution: gradeDistResult.rows,

        // Recent users
        recentUsers: recentUsersResult.rows,
      },
    });
  } catch (err) {
    console.error('Owner dashboard error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 },
    );
  }
}
