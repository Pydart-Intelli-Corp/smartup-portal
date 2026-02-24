'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Shield,
  Calendar,
  Clock,
  Radio,
  RefreshCw,
  Activity,
  Database,
  Eye,
  FileText,
  CreditCard,
  Briefcase,
  BarChart3,
} from 'lucide-react';

interface Room {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  coordinator_email: string;
  teacher_email: string | null;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  student_count?: number;
}

interface UserStat {
  role: string;
  count: number;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function OwnerDashboardClient({ userName, userEmail, userRole }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, usersRes] = await Promise.all([
        fetch('/api/v1/owner/overview'),
        fetch('/api/v1/owner/user-stats'),
      ]);
      const roomsData = await roomsRes.json();
      const usersData = await usersRes.json();
      if (roomsData.success) setRooms(roomsData.data?.rooms || []);
      if (usersData.success) setUserStats(usersData.data?.stats || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const live = rooms.filter((r) => r.status === 'live');
  const scheduled = rooms.filter((r) => r.status === 'scheduled');
  const totalUsers = userStats.reduce((a, b) => a + b.count, 0);

  const navItems = [
    { label: 'Overview', href: '/owner', icon: LayoutDashboard, active: true },
    { label: 'Users', href: '/owner', icon: Users },
    { label: 'System', href: '/owner', icon: Shield },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <p className="text-sm text-gray-400">Full system overview — admin access to everything</p>
      </div>

      {/* Top-level stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-green-700 bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Radio className="h-3.5 w-3.5 text-green-400" /> Live
          </div>
          <p className="mt-1 text-2xl font-bold text-green-400">{live.length}</p>
        </div>
        <div className="rounded-xl border border-blue-700 bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="h-3.5 w-3.5 text-blue-400" /> Scheduled
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-400">{scheduled.length}</p>
        </div>
        <div className="rounded-xl border border-slate-600 bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Database className="h-3.5 w-3.5" /> Total Batches
          </div>
          <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
        </div>
        <div className="rounded-xl border border-slate-600 bg-gray-900 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" /> Total Users
          </div>
          <p className="mt-1 text-2xl font-bold">{totalUsers}</p>
        </div>
      </div>

      {/* User stats by role */}
      {userStats.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Users by Role
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {userStats.map((s) => (
              <div
                key={s.role}
                className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-center"
              >
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-xs text-gray-500 capitalize">{s.role}s</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <a href="/owner/reports" className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-slate-500 hover:bg-gray-800 transition">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-medium text-white">Reports</span>
        </a>
        <a href="/owner/payroll" className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-slate-500 hover:bg-gray-800 transition">
          <Briefcase className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-medium text-white">Payroll</span>
        </a>
        <a href="/owner/fees" className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-slate-500 hover:bg-gray-800 transition">
          <CreditCard className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-medium text-white">Fees</span>
        </a>
        <a href="/ghost" className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-slate-500 hover:bg-gray-800 transition">
          <Eye className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-white">Ghost Mode</span>
        </a>
      </div>

      {/* Live rooms */}
      {live.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4" /> Live Classes
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
                    {room.subject} · {room.grade} · Coordinator: {room.coordinator_email} · Teacher: {room.teacher_email || '—'}
                  </p>
                </div>
                <a
                  href={`/classroom/${room.room_id}?mode=ghost`}
                  className="flex items-center gap-1 rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  <Eye className="h-3.5 w-3.5" /> Ghost View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent rooms */}
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Recent Batches
      </h2>
      <div className="space-y-2">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-gray-400">No batches in the system yet</p>
          </div>
        ) : (
          rooms.slice(0, 20).map((room) => {
            const d = new Date(room.scheduled_start);
            const statusColor: Record<string, string> = {
              live: 'text-green-400',
              scheduled: 'text-blue-400',
              ended: 'text-gray-500',
              cancelled: 'text-red-400',
            };
            return (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{room.room_name}</p>
                  <p className="text-xs text-gray-500">
                    {room.subject} · {room.grade} · Coord: {room.coordinator_email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-medium uppercase ${statusColor[room.status] || ''}`}>
                    {room.status}
                  </p>
                  <p className="text-[10px] text-gray-600 flex items-center gap-1 justify-end">
                    <Clock className="h-2.5 w-2.5" />
                    {fmtDateBriefIST(d)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
