import { db } from '@/lib/db';

/**
 * Attendance management helpers.
 *
 * Core operations:
 *   - recordJoin()    — called when participant connects
 *   - recordLeave()   — called when participant disconnects
 *   - getAttendance() — returns full attendance for a room
 *   - getJoinLogs()   — returns detailed join/leave/rejoin timeline
 */

// ── Record a join event ──────────────────────────────────────
export async function recordJoin(
  roomId: string,
  email: string,
  name: string,
  role: string,
  scheduledStart: string | null,
): Promise<void> {
  const now = new Date();

  // Calculate if late
  let isLate = false;
  let lateBySec = 0;
  if (scheduledStart && role === 'student') {
    const start = new Date(scheduledStart);
    if (!isNaN(start.getTime()) && now > start) {
      isLate = true;
      lateBySec = Math.floor((now.getTime() - start.getTime()) / 1000);
    }
  }

  // Upsert attendance_sessions — first join creates, subsequent joins update
  await db.query(
    `INSERT INTO attendance_sessions (
       room_id, participant_email, participant_name, participant_role,
       first_join_at, join_count, status, late_join, late_by_sec
     )
     VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8)
     ON CONFLICT (room_id, participant_email) DO UPDATE SET
       join_count = attendance_sessions.join_count + 1,
       status = CASE
         WHEN attendance_sessions.status = 'absent' THEN $6
         ELSE attendance_sessions.status
       END,
       late_join = CASE
         WHEN attendance_sessions.first_join_at IS NULL THEN $7
         ELSE attendance_sessions.late_join
       END,
       late_by_sec = CASE
         WHEN attendance_sessions.first_join_at IS NULL THEN $8
         ELSE attendance_sessions.late_by_sec
       END,
       first_join_at = COALESCE(attendance_sessions.first_join_at, $5),
       updated_at = NOW()`,
    [roomId, email, name, role, now, isLate ? 'late' : 'present', isLate, lateBySec],
  );

  // Log the event
  const eventType = await isRejoin(roomId, email) ? 'rejoin' : 'join';
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [roomId, email, name, role, eventType, now],
  );

  // If late, also log
  if (isLate && eventType === 'join') {
    await db.query(
      `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at, payload)
       VALUES ($1, $2, $3, $4, 'late_join', $5, $6)`,
      [roomId, email, name, role, now, JSON.stringify({ late_by_sec: lateBySec })],
    );
  }
}

// ── Check if this is a rejoin ──────────────────────────────
async function isRejoin(roomId: string, email: string): Promise<boolean> {
  const result = await db.query(
    `SELECT join_count FROM attendance_sessions
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, email],
  );
  return result.rows.length > 0 && Number(result.rows[0].join_count) > 0;
}

// ── Record a leave event ─────────────────────────────────────
export async function recordLeave(
  roomId: string,
  email: string,
  name: string,
  role: string,
): Promise<void> {
  const now = new Date();

  // Update session: set last_leave_at + compute duration
  await db.query(
    `UPDATE attendance_sessions SET
       last_leave_at = $3,
       total_duration_sec = total_duration_sec + COALESCE(
         EXTRACT(EPOCH FROM ($3::timestamptz - COALESCE(
           (SELECT event_at FROM attendance_logs
            WHERE room_id = $1 AND participant_email = $2
            AND event_type IN ('join', 'rejoin')
            ORDER BY event_at DESC LIMIT 1),
           first_join_at
         )))::integer, 0
       ),
       updated_at = NOW()
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, email, now],
  );

  // Log the leave
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at)
     VALUES ($1, $2, $3, $4, 'leave', $5)`,
    [roomId, email, name, role, now],
  );
}

// ── Record leave request/approval/denial ─────────────────────
export async function recordLeaveAction(
  roomId: string,
  email: string,
  action: 'leave_request' | 'leave_approved' | 'leave_denied',
  payload?: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, event_type, event_at, payload)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [roomId, email, action, payload ? JSON.stringify(payload) : null],
  );

  if (action === 'leave_approved') {
    await db.query(
      `UPDATE attendance_sessions SET
         leave_approved = true,
         status = 'left_early',
         updated_at = NOW()
       WHERE room_id = $1 AND participant_email = $2`,
      [roomId, email],
    );
  }
}

// ── Get attendance for a room ────────────────────────────────
export interface AttendanceRecord {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  status: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  late_join: boolean;
  late_by_sec: number;
  leave_approved: boolean | null;
  teacher_remarks: string | null;
}

export async function getAttendance(roomId: string): Promise<AttendanceRecord[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_role,
            status, first_join_at, last_leave_at, total_duration_sec,
            join_count, late_join, late_by_sec, leave_approved, teacher_remarks
     FROM attendance_sessions
     WHERE room_id = $1
     ORDER BY first_join_at ASC NULLS LAST`,
    [roomId],
  );
  return result.rows as unknown as AttendanceRecord[];
}

// ── Get join logs timeline ───────────────────────────────────
export interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

export async function getJoinLogs(roomId: string): Promise<JoinLogEntry[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_role,
            event_type, event_at, payload
     FROM attendance_logs
     WHERE room_id = $1
     ORDER BY event_at ASC`,
    [roomId],
  );
  return result.rows as unknown as JoinLogEntry[];
}

// ── Mark all absent students who never joined ────────────────
export async function finalizeAttendance(roomId: string): Promise<void> {
  // Get all assigned students
  const assigned = await db.query(
    `SELECT participant_email, participant_name FROM room_assignments
     WHERE room_id = $1 AND participant_type = 'student'`,
    [roomId],
  );

  for (const row of assigned.rows) {
    const r = row as { participant_email: string; participant_name: string };
    await db.query(
      `INSERT INTO attendance_sessions (room_id, participant_email, participant_name, participant_role, status)
       VALUES ($1, $2, $3, 'student', 'absent')
       ON CONFLICT (room_id, participant_email) DO NOTHING`,
      [roomId, r.participant_email, r.participant_name],
    );
  }
}
