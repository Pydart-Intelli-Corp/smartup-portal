// ═══════════════════════════════════════════════════════════════
// Join Room — /join/[room_id]
// Participants arrive here from email invite links.
// Validates their token/session and routes to classroom.
// If ?token= is in URL (email link), auth is NOT required.
// ═══════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import JoinRoomClient from './JoinRoomClient';

interface Props {
  params: Promise<{ room_id: string }>;
  searchParams: Promise<{ token?: string; device?: string }>;
}

/**
 * Decode a JWT payload without verifying signature.
 * Used to extract display info from the email's LiveKit token.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return payload;
  } catch {
    return null;
  }
}

export default async function JoinRoomPage({ params, searchParams }: Props) {
  const { room_id } = await params;
  const { token: emailToken, device } = await searchParams;

  // Get room info — support both livekit_room_name and batch session_id
  const roomResult = await db.query(
    `SELECT room_id, room_name, subject, grade, status, scheduled_start,
            duration_minutes, teacher_email, open_at, expires_at
     FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
    [room_id]
  );

  if (roomResult.rows.length === 0) {
    // Check if there's a batch_session with this id (teacher hasn't started yet)
    const sessionCheck = await db.query(
      `SELECT session_id, subject, start_time, scheduled_date, status
       FROM batch_sessions WHERE session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (sessionCheck.rows.length > 0) {
      const sess = sessionCheck.rows[0] as { subject: string; start_time: string; scheduled_date: string; status: string };
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center max-w-sm px-6">
            <div className="mb-3 text-4xl">⏳</div>
            <h1 className="text-xl font-bold text-foreground">Teacher hasn&apos;t started yet</h1>
            <p className="mt-2 text-muted-foreground">
              The {sess.subject} class ({sess.scheduled_date?.slice(0,10)} {sess.start_time?.slice(0,5)}) is scheduled but the teacher hasn&apos;t opened the classroom yet.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Please wait a moment and try again.</p>
            <a href={`/join/${room_id}`} className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
              Try Again
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-400">Session Not Found</h1>
          <p className="mt-2 text-muted-foreground">This session does not exist or may have been deleted.</p>
        </div>
      </div>
    );
  }

  const room = roomResult.rows[0] as Record<string, unknown>;

  // Check if room is cancelled
  if (room.status === 'cancelled') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-400">Batch Cancelled</h1>
          <p className="mt-2 text-muted-foreground">This session has been cancelled by the coordinator.</p>
        </div>
      </div>
    );
  }

  // Check if room has ended
  if (room.status === 'ended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-3 text-4xl">✅</div>
          <h1 className="text-xl font-bold text-foreground">Session Ended</h1>
          <p className="mt-2 text-muted-foreground">This session has already ended.</p>
        </div>
      </div>
    );
  }

  // ── Auth: session OR email token ───────────────────────────
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  let user = null;
  if (sessionToken) {
    user = await verifySession(sessionToken);
  }

  // If email token present → extract participant info from JWT payload
  // No login required — the token itself is the auth
  let emailUser: { name: string; email: string; role: string } | null = null;
  if (emailToken && !user) {
    const payload = decodeJwtPayload(emailToken);
    if (payload) {
      const metadata = typeof payload.metadata === 'string'
        ? JSON.parse(payload.metadata) as Record<string, unknown>
        : {};
      emailUser = {
        name: (payload.name as string) || 'Participant',
        email: (payload.sub as string) || '',
        role: (metadata.role as string) || 'student',
      };
    }
  }

  // If neither session nor email token → redirect to login
  if (!user && !emailUser) {
    const returnPath = `/join/${room_id}${emailToken || device ? '?' : ''}${emailToken ? `token=${emailToken}` : ''}${emailToken && device ? '&' : ''}${device ? `device=${device}` : ''}`;
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  // Resolved user info (session takes priority over email token)
  const displayName = user?.name || emailUser!.name;
  const displayEmail = user?.id || emailUser!.email;
  const displayRole = user?.role || emailUser!.role;

  return (
    <JoinRoomClient
      roomId={room_id}
      roomName={room.room_name as string}
      subject={room.subject as string}
      grade={room.grade as string}
      status={room.status as string}
      scheduledStart={room.scheduled_start as string}
      durationMinutes={room.duration_minutes as number}
      teacherEmail={room.teacher_email as string | null}
      userName={displayName}
      userEmail={displayEmail}
      userRole={displayRole}
      emailToken={emailToken || null}
      device={device || 'desktop'}
    />
  );
}
