// ═══════════════════════════════════════════════════════════════
// Ghost Monitor Client — Oversight Console
// Batch-wise monitoring, combined multi-view, per-teacher views
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  Eye,
  Monitor,
  Radio,
  RefreshCw,
  Grid3X3,
  List,
  BookOpen,
  User,
  Layers,
  LayoutGrid,
  ArrowLeft,
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

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

type GroupMode = 'all' | 'batch' | 'teacher';

function effectiveStatus(room: Room): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

export default function GhostMonitorClient({ userName, userEmail, userRole }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Parse URL params for combined/teacher mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'combined') {
      setGroupMode('all');
    }
    if (params.get('teacher')) {
      setGroupMode('teacher');
      setSelectedFilter(params.get('teacher'));
    }
    if (params.get('batch')) {
      setGroupMode('batch');
      setSelectedFilter(params.get('batch'));
    }
  }, []);

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
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const live = rooms.filter((r) => effectiveStatus(r) === 'live');

  // Group by batch
  const batchGroups = useMemo(() => {
    const map = new Map<string, { batch_id: string; batch_name: string; rooms: Room[] }>();
    for (const r of live) {
      const bid = r.batch_id || 'unlinked';
      if (!map.has(bid)) map.set(bid, { batch_id: bid, batch_name: r.batch_name || 'Standalone', rooms: [] });
      map.get(bid)!.rooms.push(r);
    }
    return Array.from(map.values());
  }, [live]);

  // Group by teacher
  const teacherGroups = useMemo(() => {
    const map = new Map<string, { email: string; name: string; rooms: Room[] }>();
    for (const r of live) {
      const email = r.teacher_email || 'unassigned';
      if (!map.has(email)) map.set(email, { email, name: r.teacher_name || email, rooms: [] });
      map.get(email)!.rooms.push(r);
    }
    return Array.from(map.values());
  }, [live]);

  // Filtered rooms for display
  const displayRooms = useMemo(() => {
    if (selectedFilter && groupMode === 'teacher') {
      return live.filter(r => r.teacher_email === selectedFilter);
    }
    if (selectedFilter && groupMode === 'batch') {
      return live.filter(r => r.batch_id === selectedFilter);
    }
    return live;
  }, [live, selectedFilter, groupMode]);

  const groupModeButtons: { mode: GroupMode; label: string; icon: typeof LayoutGrid }[] = [
    { mode: 'all', label: 'All', icon: LayoutGrid },
    { mode: 'batch', label: 'By Batch', icon: BookOpen },
    { mode: 'teacher', label: 'By Teacher', icon: User },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <a href="/ghost" className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Monitor className="h-6 w-6 text-muted-foreground" /> Oversight Console
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground ml-10">
            Monitor all live classes — auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 ${viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={fetchRooms}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live count banner */}
      <div className="mb-4 rounded-xl border border-green-800 bg-green-950/30 p-4 flex items-center gap-3">
        <Radio className="h-5 w-5 text-green-400 animate-pulse" />
        <span className="text-sm">
          <span className="font-bold text-green-400">{live.length}</span>{' '}
          {live.length === 1 ? 'class' : 'classes'} live right now
        </span>
        {selectedFilter && (
          <button
            onClick={() => setSelectedFilter(null)}
            className="ml-auto flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs text-foreground/80 hover:bg-accent/80"
          >
            Clear filter · Showing {displayRooms.length}/{live.length}
          </button>
        )}
      </div>

      {/* Group mode selector */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {groupModeButtons.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => { setGroupMode(mode); setSelectedFilter(null); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              groupMode === mode ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}

        {/* Quick filter chips */}
        {groupMode === 'batch' && !selectedFilter && batchGroups.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-2">
            {batchGroups.map(bg => (
              <button
                key={bg.batch_id}
                onClick={() => setSelectedFilter(bg.batch_id)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {bg.batch_name} ({bg.rooms.length})
              </button>
            ))}
          </div>
        )}
        {groupMode === 'teacher' && !selectedFilter && teacherGroups.length > 0 && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-2">
            {teacherGroups.map(tg => (
              <button
                key={tg.email}
                onClick={() => setSelectedFilter(tg.email)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                {tg.name} ({tg.rooms.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading rooms...
        </div>
      ) : displayRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Monitor className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-muted-foreground">No live classes{selectedFilter ? ' matching filter' : ' at the moment'}</p>
          <p className="mt-1 text-sm text-muted-foreground/80">
            Live classes will appear here automatically
          </p>
        </div>
      ) : groupMode !== 'all' && !selectedFilter ? (
        /* ── Grouped cards view ── */
        <div className="space-y-6">
          {(groupMode === 'batch' ? batchGroups : teacherGroups).map((group) => {
            const g = group as { batch_id?: string; batch_name?: string; email?: string; name?: string; rooms: Room[] };
            const key = g.batch_id || g.email || 'unknown';
            const label = g.batch_name || g.name || key;
            return (
              <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    {groupMode === 'batch' ? (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                        {label.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-sm">{label}</span>
                    <span className="flex items-center gap-1 rounded bg-green-900 px-1.5 py-0.5 text-[10px] text-green-300">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> {g.rooms.length} live
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedFilter(key)}
                    className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 hover:bg-accent/80"
                  >
                    <Layers className="h-3 w-3" /> Focus
                  </button>
                </div>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.rooms.map((room) => <RoomCard key={room.room_id} room={room} />)}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {g.rooms.map((room) => <RoomListItem key={room.room_id} room={room} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Flat grid view ── */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayRooms.map((room) => <RoomCard key={room.room_id} room={room} />)}
        </div>
      ) : (
        /* ── Flat list view ── */
        <div className="space-y-3">
          {displayRooms.map((room) => <RoomListItem key={room.room_id} room={room} />)}
        </div>
      )}
    </DashboardShell>
  );
}

/* ── Room grid card ── */
function RoomCard({ room }: { room: Room }) {
  const elapsed = Math.round((Date.now() - new Date(room.scheduled_start).getTime()) / 60000);
  return (
    <div className="rounded-xl border border-green-800/50 bg-card overflow-hidden">
      <div className="relative bg-muted h-36 flex items-center justify-center">
        <Radio className="h-8 w-8 text-green-500 animate-pulse" />
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <Radio className="h-2.5 w-2.5" /> LIVE
        </div>
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-black/50 rounded px-1.5 py-0.5">
          {elapsed}m elapsed
        </div>
        {room.batch_name && (
          <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-black/50 rounded px-1.5 py-0.5">
            {room.batch_name}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{room.room_name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {room.subject} · {room.grade}
        </p>
        <p className="text-xs text-muted-foreground/80 mt-0.5">
          {room.teacher_name || room.teacher_email || '—'}
        </p>
        <a
          href={`/classroom/${room.room_id}?mode=ghost`}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-accent py-2 text-xs font-medium text-foreground/80 hover:bg-accent/80"
        >
          <Eye className="h-3.5 w-3.5" /> Enter Ghost Mode
        </a>
      </div>
    </div>
  );
}

/* ── Room list item ── */
function RoomListItem({ room }: { room: Room }) {
  const elapsed = Math.round((Date.now() - new Date(room.scheduled_start).getTime()) / 60000);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-green-800/50 bg-card p-4">
      <Radio className="h-6 w-6 text-green-400 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{room.room_name}</h3>
        <p className="text-xs text-muted-foreground">
          {room.subject} · {room.grade} · {room.teacher_name || room.teacher_email || '—'}
          {room.batch_name && <span className="text-muted-foreground/60"> · {room.batch_name}</span>}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{elapsed}m</span>
      <a
        href={`/classroom/${room.room_id}?mode=ghost`}
        className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-accent/80 shrink-0"
      >
        <Eye className="h-3.5 w-3.5" /> Enter Ghost
      </a>
    </div>
  );
}
