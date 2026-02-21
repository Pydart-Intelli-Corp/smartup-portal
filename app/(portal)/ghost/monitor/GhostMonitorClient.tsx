// ═══════════════════════════════════════════════════════════════
// Ghost Monitor Client — Oversight Console
// Shows a multi-view grid of all live rooms for silent observation
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard,
  Eye,
  Monitor,
  Radio,
  RefreshCw,
  Grid3X3,
  List,
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
}

export default function GhostMonitorClient({ userName, userEmail, userRole }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    // Auto-refresh every 30s
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const live = rooms.filter((r) => r.status === 'live');

  const navItems = [
    { label: 'Dashboard', href: '/ghost', icon: LayoutDashboard },
    { label: 'Observe', href: '/ghost', icon: Eye },
    { label: 'Oversight', href: '/ghost/monitor', icon: Monitor, active: true },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-gray-400" /> Oversight Console
          </h1>
          <p className="text-sm text-gray-400">
            Monitor all live classes — auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={fetchRooms}
            className="flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live count banner */}
      <div className="mb-6 rounded-xl border border-green-800 bg-green-950/30 p-4 flex items-center gap-3">
        <Radio className="h-5 w-5 text-green-400 animate-pulse" />
        <span className="text-sm">
          <span className="font-bold text-green-400">{live.length}</span>{' '}
          {live.length === 1 ? 'class' : 'classes'} live right now
        </span>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading rooms...
        </div>
      ) : live.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 py-20 text-center">
          <Monitor className="mb-3 h-10 w-10 text-gray-600" />
          <p className="text-gray-400">No live classes at the moment</p>
          <p className="mt-1 text-sm text-gray-600">
            Live classes will appear here automatically
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((room) => {
            const elapsed = Math.round(
              (Date.now() - new Date(room.scheduled_start).getTime()) / 60000
            );
            return (
              <div
                key={room.room_id}
                className="rounded-xl border border-green-800/50 bg-gray-900 overflow-hidden"
              >
                {/* Simulated video placeholder */}
                <div className="relative bg-gray-800 h-36 flex items-center justify-center">
                  <Radio className="h-8 w-8 text-green-500 animate-pulse" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <Radio className="h-2.5 w-2.5" /> LIVE
                  </div>
                  <div className="absolute top-2 right-2 text-[10px] text-gray-400 bg-black/50 rounded px-1.5 py-0.5">
                    {elapsed}m elapsed
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{room.room_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {room.subject} · {room.grade}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Teacher: {room.teacher_email || '—'}
                  </p>
                  <a
                    href={`/classroom/${room.room_id}?mode=ghost`}
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-gray-700 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600"
                  >
                    <Eye className="h-3.5 w-3.5" /> Enter Ghost Mode
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-3">
          {live.map((room) => {
            const elapsed = Math.round(
              (Date.now() - new Date(room.scheduled_start).getTime()) / 60000
            );
            return (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-xl border border-green-800/50 bg-gray-900 p-4"
              >
                <Radio className="h-6 w-6 text-green-400 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{room.room_name}</h3>
                  <p className="text-xs text-gray-500">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{elapsed}m</span>
                <a
                  href={`/classroom/${room.room_id}?mode=ghost`}
                  className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600 flex-shrink-0"
                >
                  <Eye className="h-3.5 w-3.5" /> Enter Ghost
                </a>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
