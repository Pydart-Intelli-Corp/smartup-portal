'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST, fmtTimeIST } from '@/lib/utils';
import {
  EyeOff,
  Eye,
  Radio,
  Calendar,
  Clock,
  RefreshCw,
  Monitor,
  Users,
  BookOpen,
  User,
  Layers,
  LayoutGrid,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  teacher_email: string | null;
  teacher_name: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  batch_id: string | null;
  batch_name: string | null;
  batch_type: string | null;
}

interface BatchGroup {
  batch_id: string;
  batch_name: string;
  rooms: Room[];
}

interface TeacherGroup {
  teacher_email: string;
  teacher_name: string;
  rooms: Room[];
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type ViewMode = 'all' | 'batch' | 'teacher';

function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

export default function GhostDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'batch') {
        const res = await fetch('/api/v1/ghost/rooms?view=batch');
        const data = await res.json();
        if (data.success) setBatchGroups(data.data?.batches || []);
      } else if (viewMode === 'teacher') {
        const res = await fetch('/api/v1/ghost/rooms?view=teacher');
        const data = await res.json();
        if (data.success) setTeacherGroups(data.data?.teachers || []);
      } else {
        const res = await fetch('/api/v1/ghost/rooms');
        const data = await res.json();
        if (data.success) setRooms(data.data?.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const allRooms = viewMode === 'batch'
    ? batchGroups.flatMap(b => b.rooms as Room[])
    : viewMode === 'teacher'
    ? teacherGroups.flatMap(t => t.rooms as Room[])
    : rooms;
  const live = allRooms.filter((r) => effectiveStatus(r) === 'live');
  const scheduled = allRooms.filter((r) => effectiveStatus(r) === 'scheduled');

  const viewButtons: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { mode: 'all', label: 'All Sessions', icon: LayoutGrid },
    { mode: 'batch', label: 'By Batch', icon: BookOpen },
    { mode: 'teacher', label: 'By Teacher', icon: User },
  ];

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
          Ghost mode: You will not appear in participant lists. Your camera and mic are disabled.
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
          <p className="mt-1 text-2xl font-bold">{allRooms.length}</p>
        </div>
      </div>

      {/* View mode selector */}
      <div className="mb-6 flex items-center gap-2">
        {viewButtons.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === mode
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchRooms}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Oversight Console + Combined Monitor shortcuts */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="/ghost/monitor"
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-4 transition-colors hover:border-border hover:bg-muted"
        >
          <Monitor className="h-6 w-6 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="text-sm font-medium">Oversight Console</h3>
            <p className="text-xs text-muted-foreground">Multi-view grid of all classes</p>
          </div>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs text-foreground/80">Open</span>
        </a>
        {live.length > 1 && (
          <a
            href={`/ghost/monitor?mode=combined&rooms=${live.map(r => r.room_id).join(',')}`}
            className="flex items-center gap-3 rounded-xl border border-green-800 bg-green-950/30 p-4 transition-colors hover:bg-green-950/40"
          >
            <Layers className="h-6 w-6 text-green-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-400">Combined Monitor</h3>
              <p className="text-xs text-muted-foreground">Watch all {live.length} live classes</p>
            </div>
            <span className="rounded-lg bg-green-900 px-3 py-1.5 text-xs text-green-300">Enter</span>
          </a>
        )}
      </div>

      {loading && allRooms.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : viewMode === 'batch' ? (
        /* ── Batch-wise view ── */
        <div className="space-y-6">
          {batchGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-muted-foreground text-sm">No active batches</p>
            </div>
          ) : (
            batchGroups.map((batch) => {
              const batchLive = (batch.rooms as Room[]).filter(r => effectiveStatus(r) === 'live');
              const batchScheduled = (batch.rooms as Room[]).filter(r => effectiveStatus(r) === 'scheduled');
              return (
                <div key={batch.batch_id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{batch.batch_name}</span>
                      {batchLive.length > 0 && (
                        <span className="flex items-center gap-1 rounded bg-green-900 px-1.5 py-0.5 text-[10px] text-green-300">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> {batchLive.length} live
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{batch.rooms.length} session{batch.rooms.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {(batch.rooms as Room[]).map((room) => (
                      <RoomRow key={room.room_id} room={room} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : viewMode === 'teacher' ? (
        /* ── Teacher-wise view ── */
        <div className="space-y-6">
          {teacherGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <User className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-muted-foreground text-sm">No active teachers</p>
            </div>
          ) : (
            teacherGroups.map((teacher) => {
              const tLive = (teacher.rooms as Room[]).filter(r => effectiveStatus(r) === 'live');
              return (
                <div key={teacher.teacher_email} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                        {teacher.teacher_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{teacher.teacher_name}</span>
                        <p className="text-[11px] text-muted-foreground">{teacher.teacher_email}</p>
                      </div>
                      {tLive.length > 0 && (
                        <span className="flex items-center gap-1 rounded bg-green-900 px-1.5 py-0.5 text-[10px] text-green-300">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> {tLive.length} live
                        </span>
                      )}
                    </div>
                    {tLive.length > 0 && (
                      <a
                        href={`/ghost/monitor?teacher=${encodeURIComponent(teacher.teacher_email)}`}
                        className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 hover:bg-accent/80"
                      >
                        <Monitor className="h-3 w-3" /> Monitor All
                      </a>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {(teacher.rooms as Room[]).map((room) => (
                      <RoomRow key={room.room_id} room={room} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── All sessions (flat) ── */
        <div className="space-y-6">
          {/* Live */}
          {live.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                <Radio className="h-4 w-4 animate-pulse" /> Live — Enter Silently
              </h2>
              <div className="space-y-3">
                {live.map((room) => (
                  <RoomRow key={room.room_id} room={room} />
                ))}
              </div>
            </div>
          )}
          {/* Scheduled */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Scheduled Classes
            </h2>
            {scheduled.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-muted-foreground text-sm">No scheduled classes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map((room) => (
                  <RoomRow key={room.room_id} room={room} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

/* ── Shared room row component ── */
function RoomRow({ room }: { room: Room }) {
  const isLive = effectiveStatus(room) === 'live';
  const d = new Date(room.scheduled_start);
  const elapsed = isLive ? Math.round((Date.now() - d.getTime()) / 60000) : 0;

  return (
    <div className={`flex items-center gap-4 p-4 ${isLive ? 'bg-green-950/20' : ''}`}>
      {isLive ? (
        <Radio className="h-5 w-5 text-green-400 animate-pulse shrink-0" />
      ) : (
        <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{room.room_name}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
          {room.subject && <span>{room.subject}</span>}
          {room.grade && <span>· {room.grade}</span>}
          {room.teacher_name && <span>· {room.teacher_name}</span>}
          {room.batch_name && <span className="text-muted-foreground/60">· {room.batch_name}</span>}
        </div>
      </div>
      {isLive ? (
        <>
          <span className="text-xs text-muted-foreground shrink-0">{elapsed}m</span>
          <a
            href={`/classroom/${room.room_id}?mode=ghost`}
            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-accent/80 shrink-0"
          >
            <Eye className="h-3.5 w-3.5" /> Enter Ghost
          </a>
        </>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />
          {fmtDateBriefIST(d)} {fmtTimeIST(d)}
        </span>
      )}
    </div>
  );
}
