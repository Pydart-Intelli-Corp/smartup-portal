import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { resolveRoomId } from '@/lib/db';
import { getAttendance, getJoinLogs, type AttendanceRecord, type JoinLogEntry } from '@/lib/attendance';

/**
 * GET /api/v1/room/[room_id]/attendance
 * Returns attendance records + join logs for a room.
 *
 * Auth: session cookie (teacher, coordinator, academic_operator, owner, ghost)
 *
 * Response: { attendance: AttendanceRecord[], logs: JoinLogEntry[], summary }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

    // Auth
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid session' },
        { status: 401 },
      );
    }

    // Only authorized roles
    const allowedRoles = ['teacher', 'student', 'batch_coordinator', 'academic_operator', 'academic', 'owner', 'ghost', 'hr'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const [attendance, logs] = await Promise.all([
      getAttendance(actualRoomId),
      getJoinLogs(actualRoomId),
    ]);

    // Students only see their own record + limited logs
    const isStudent = user.role === 'student';
    const filteredAttendance = isStudent
      ? attendance.filter((a) => a.participant_email === user.id)
      : attendance;
    const filteredLogs = isStudent
      ? logs.filter((l) => l.participant_email === user.id)
      : logs;

    // Compute summary
    const students = filteredAttendance.filter((a) => a.participant_role === 'student');
    const present = students.filter((a) => a.status === 'present').length;
    const late = students.filter((a) => a.status === 'late').length;
    const absent = students.filter((a) => a.status === 'absent').length;
    const leftEarly = students.filter((a) => a.status === 'left_early').length;
    const totalDuration = students.reduce((sum, a) => sum + a.total_duration_sec, 0);
    const avgDuration = students.length > 0 ? Math.round(totalDuration / students.length) : 0;

    return NextResponse.json<ApiResponse<{
      attendance: AttendanceRecord[];
      logs: JoinLogEntry[];
      summary: {
        total_students: number;
        present: number;
        late: number;
        absent: number;
        left_early: number;
        avg_duration_sec: number;
      };
    }>>({
      success: true,
      data: {
        attendance: filteredAttendance,
        logs: filteredLogs,
        summary: {
          total_students: students.length,
          present,
          late,
          absent,
          left_early: leftEarly,
          avg_duration_sec: avgDuration,
        },
      },
    });
  } catch (err) {
    console.error('[attendance GET] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
