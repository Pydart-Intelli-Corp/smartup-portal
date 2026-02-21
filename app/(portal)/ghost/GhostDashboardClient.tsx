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
}

export default function GhostDashboardClient({ userName, userEmail, userRole }: Props) {
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

  const live = rooms.filter((r) => r.status === 'live');
  const scheduled = rooms.filter((r) => r.status === 'scheduled');

  const navItems = [
    { label: 'Dashboard', href: '/ghost', icon: LayoutDashboard, active: true },
    { label: 'Observe', href: '/ghost', icon: Eye },
    { label: 'Oversight', href: '/ghost/monitor', icon: Monitor },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <EyeOff className="h-6 w-6 text-gray-500" /> Ghost Observer
        </h1>
        <p className="text-sm text-gray-400">
          Silent observation mode — invisible to all participants
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-400">
        <p className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-gray-500" />
          Ghost mode: You will not appear in participant lists. Your camera and mic are disabled. Teachers and students cannot see you.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Live Now</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{live.length}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Scheduled</p>
          <p className="mt-1 text-2xl font-bold">{scheduled.length}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Total</p>
          <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
        </div>
      </div>

      {/* Oversight Console shortcut */}
      <div className="mb-6">
        <a
          href="/ghost/monitor"
          className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800"
        >
          <Monitor className="h-6 w-6 text-gray-400" />
          <div className="flex-1">
            <h3 className="text-sm font-medium">Oversight Console</h3>
            <p className="text-xs text-gray-500">Monitor all live classes in a multi-view grid</p>
          </div>
          <span className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600">
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
                  <p className="text-xs text-gray-400">
                    {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <a
                  href={`/classroom/${room.room_id}?mode=ghost`}
                  className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600"
                >
                  <Eye className="h-3.5 w-3.5" /> Enter Ghost
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled */}
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Scheduled Classes
      </h2>
      <div className="space-y-3">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : scheduled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-gray-600" />
            <p className="text-gray-400 text-sm">No scheduled classes</p>
          </div>
        ) : (
          scheduled.map((room) => {
            const d = new Date(room.scheduled_start);
            return (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <Calendar className="h-6 w-6 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{room.room_name}</h3>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
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
