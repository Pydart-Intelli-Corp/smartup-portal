// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Recording Service
// ═══════════════════════════════════════════════════════════════
// LiveKit EgressClient wrapper for class recording
//
// Usage:
//   import { startRecording, stopRecording, ... } from '@/lib/recording';
// ═══════════════════════════════════════════════════════════════

import { EgressClient, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk';
import { db } from '@/lib/db';

// ── Configuration ───────────────────────────────────────────

const livekitHost =
  process.env.LIVEKIT_URL ||
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:7880';
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

const RECORDING_PATH = process.env.RECORDING_PATH || '/var/recordings';

// ── Egress Client ───────────────────────────────────────────

const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);

// ── Start Recording ─────────────────────────────────────────

export async function startRecording(roomName: string, roomId: string) {
  try {
    // Check if already recording
    const existing = await db.query(
      `SELECT recording_status, egress_id FROM rooms WHERE room_id = $1`,
      [roomId]
    );
    if (existing.rows[0]?.recording_status === 'recording') {
      return { alreadyRecording: true, egressId: existing.rows[0].egress_id };
    }

    // Start room composite egress (records full room with all participants)
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `${RECORDING_PATH}/${roomName}_{time}.mp4`,
    });

    const egress = await egressClient.startRoomCompositeEgress(
      roomName,
      { file: output },
      {
        layout: 'grid',
        audioOnly: false,
        videoOnly: false,
      }
    );

    const egressId = egress.egressId;

    // Update room record
    await db.query(
      `UPDATE rooms SET recording_status = 'recording', egress_id = $1 WHERE room_id = $2`,
      [egressId, roomId]
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'recording_started', 'system', $2::jsonb)`,
      [roomId, JSON.stringify({ egress_id: egressId })]
    );

    return { success: true, egressId };
  } catch (err) {
    console.error('[recording] Start recording error:', err);
    throw err;
  }
}

// ── Stop Recording ──────────────────────────────────────────

export async function stopRecording(roomId: string) {
  try {
    const room = await db.query(
      `SELECT egress_id, room_id FROM rooms WHERE room_id = $1`,
      [roomId]
    );

    const egressId = room.rows[0]?.egress_id as string | undefined;
    if (!egressId) {
      return { success: false, error: 'No active recording' };
    }

    await egressClient.stopEgress(egressId);

    // Update room
    await db.query(
      `UPDATE rooms SET recording_status = 'stopped' WHERE room_id = $1`,
      [roomId]
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'recording_stopped', 'system', $2::jsonb)`,
      [roomId, JSON.stringify({ egress_id: egressId })]
    );

    return { success: true, egressId };
  } catch (err) {
    console.error('[recording] Stop recording error:', err);
    throw err;
  }
}

// ── Get Recording Status ────────────────────────────────────

export async function getRecordingStatus(roomId: string) {
  const result = await db.query(
    `SELECT recording_status, egress_id, recording_url FROM rooms WHERE room_id = $1`,
    [roomId]
  );
  return result.rows[0] || null;
}

// ── List Recordings ─────────────────────────────────────────

export async function listRecordings(filters?: { subject?: string; grade?: string; limit?: number }) {
  let sql = `SELECT r.room_id, r.room_name, r.subject, r.grade, r.recording_url,
                    r.recording_status, r.scheduled_start, r.duration_minutes,
                    r.teacher_email
             FROM rooms r
             WHERE r.recording_url IS NOT NULL`;
  const params: unknown[] = [];

  if (filters?.subject) {
    params.push(filters.subject);
    sql += ` AND r.subject = $${params.length}`;
  }
  if (filters?.grade) {
    params.push(filters.grade);
    sql += ` AND r.grade = $${params.length}`;
  }

  sql += ` ORDER BY r.scheduled_start DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await db.query(sql, params);
  return result.rows;
}

// ── Update Recording URL (from webhook) ─────────────────────

export async function updateRecordingUrl(egressId: string, recordingUrl: string) {
  await db.query(
    `UPDATE rooms SET recording_url = $1, recording_status = 'completed'
     WHERE egress_id = $2`,
    [recordingUrl, egressId]
  );
}

// ── Get Student Recordings ──────────────────────────────────

export async function getStudentRecordings(studentEmail: string) {
  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.recording_url,
            r.scheduled_start, r.duration_minutes, r.teacher_email
     FROM rooms r
     JOIN room_assignments ra ON ra.room_id = r.room_id
     WHERE ra.participant_email = $1
       AND ra.participant_type = 'student'
       AND r.recording_url IS NOT NULL
     ORDER BY r.scheduled_start DESC`,
    [studentEmail]
  );
  return result.rows;
}
