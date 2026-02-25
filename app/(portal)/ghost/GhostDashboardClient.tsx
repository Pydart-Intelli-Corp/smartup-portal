'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST, fmtTimeIST } from '@/lib/utils';
import {
  LayoutDashboard,
  Eye,
  EyeOff,
  Radio,
  Calendar,
  Clock,
  RefreshCw,
  Monitor,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  teacher_email: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

/** Treat 'live' rooms past their end time as 'ended' (safety net). */
function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

export default function GhostDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ghost/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const live = rooms.filter((r) => effectiveStatus(r) === 'live');
  const scheduled = rooms.filter((r) => effectiveStatus(r) === 'scheduled');



  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <EyeOff className="h-6 w-6 text-muted-foreground" /> Ghost Observer
        </h1>
        <p className="text-sm text-muted-foreground">
          Silent observation mode — invisible to all participants
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          Ghost mode: You will not appear in participant lists. Your camera and mic are disabled. Teachers and students cannot see you.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700 bg-card p-4">
          <p className="text-xs text-muted-foreground">Live Now</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{live.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Scheduled</p>
          <p className="mt-1 text-2xl font-bold">{scheduled.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
        </div>
      </div>

      {/* Oversight Console shortcut */}
      <div className="mb-6">
        <a
          href="/ghost/monitor"
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-4 transition-colors hover:border-border hover:bg-muted"
        >
          <Monitor className="h-6 w-6 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="text-sm font-medium">Oversight Console</h3>
            <p className="text-xs text-muted-foreground">Monitor all live classes in a multi-view grid</p>
          </div>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent/80">
            Open Console
          </span>
        </a>
      </div>

      {/* Live rooms — main action */}
      {live.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse" /> Live — Enter Silently
          </h2>
          <div className="space-y-3">
            {live.map((room) => (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-xl border border-green-800 bg-green-950/30 p-4"
              >
                <Radio className="h-6 w-6 text-green-400 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{room.room_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <a
                  href={`/classroom/${room.room_id}?mode=ghost`}
                  className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-accent/80"
                >
                  <Eye className="h-3.5 w-3.5" /> Enter Ghost
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled */}
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Scheduled Classes
      </h2>
      <div className="space-y-3">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : scheduled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-muted-foreground text-sm">No scheduled classes</p>
          </div>
        ) : (
          scheduled.map((room) => {
            const d = new Date(room.scheduled_start);
            return (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <Calendar className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{room.room_name}</h3>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{room.subject} · {room.grade}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDateBriefIST(d)}{' '}
                      {fmtTimeIST(d)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
