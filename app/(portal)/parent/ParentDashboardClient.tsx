'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { fmtDateBriefIST, fmtTimeIST } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Radio,
  RefreshCw,
  Eye,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  FileText,
} from 'lucide-react';

interface ChildRoom {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  teacher_email: string | null;
  student_email: string;
  student_name: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function ParentDashboardClient({ userName, userEmail, userRole }: Props) {
  const [rooms, setRooms] = useState<ChildRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [examResults, setExamResults] = useState<Record<string, unknown>[]>([]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/parent/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payment/invoices');
      const data = await res.json();
      if (data.success) setInvoices(data.data?.invoices || []);
    } catch (err) { console.error('Invoices fetch failed:', err); }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchInvoices();
  }, [fetchRooms, fetchInvoices]);

  const live = rooms.filter((r) => r.status === 'live');
  const upcoming = rooms.filter((r) => r.status === 'scheduled');

  const navItems = [
    { label: 'Dashboard', href: '/parent', icon: LayoutDashboard, active: true },
    { label: 'Children', href: '/parent', icon: Users },
  ];

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Parent Dashboard</h1>
        <p className="text-sm text-gray-400">Monitor your child&apos;s classes and progress</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Live Now</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{live.length}</p>
        </div>
        <div className="rounded-xl border border-rose-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Upcoming</p>
          <p className="mt-1 text-2xl font-bold text-rose-400">{upcoming.length}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <p className="text-xs text-gray-400">Total</p>
          <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
        </div>
      </div>

      {/* Live classes with observe */}
      {live.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse" /> Live Now
          </h2>
          {live.map((room) => (
            <div
              key={room.room_id}
              className="mb-3 flex items-center gap-4 rounded-xl border border-green-800 bg-green-950/30 p-4"
            >
              <Radio className="h-6 w-6 text-green-400" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{room.room_name}</h3>
                <p className="text-xs text-gray-400">
                  {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                </p>
              </div>
              <a
                href={`/classroom/${room.room_id}?mode=observe`}
                className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700"
              >
                <Eye className="h-3.5 w-3.5" /> Observe
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming */}
      <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Upcoming Classes
      </h2>
      <div className="space-y-3">
        {loading && rooms.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-gray-600" />
            <p className="text-gray-400 text-sm">No upcoming classes</p>
          </div>
        ) : (
          upcoming.map((room) => {
            const d = new Date(room.scheduled_start);
            return (
              <div
                key={room.room_id}
                className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <Calendar className="h-8 w-8 text-rose-400" />
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

      {/* Completed */}
      {rooms.filter((r) => r.status === 'ended').length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Completed
          </h2>
          <div className="space-y-2">
            {rooms
              .filter((r) => r.status === 'ended')
              .slice(0, 5)
              .map((room) => (
                <div key={room.room_id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3 opacity-60">
                  <CheckCircle2 className="h-5 w-5 text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{room.room_name}</p>
                    <p className="text-xs text-gray-600">{room.subject} · {room.grade}</p>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Invoices / Fee Section */}
      <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <CreditCard className="h-4 w-4" /> Fee & Payments
      </h2>
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-8 text-center">
          <CreditCard className="mx-auto mb-2 h-8 w-8 text-gray-600" />
          <p className="text-gray-400 text-sm">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.slice(0, 10).map((inv, idx) => {
            const status = inv.status as string;
            const statusColors: Record<string, string> = {
              paid: 'text-green-400 border-green-700',
              pending: 'text-yellow-400 border-yellow-700',
              overdue: 'text-red-400 border-red-700',
            };
            return (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                <FileText className="h-5 w-5 text-rose-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{inv.invoice_number as string || `Invoice #${idx + 1}`}</p>
                  <p className="text-xs text-gray-500">
                    ₹{((inv.amount_paise as number) / 100).toFixed(2)} · Due: {inv.due_date ? new Date(inv.due_date as string).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold uppercase border rounded px-2 py-0.5 ${statusColors[status] || 'text-gray-400 border-gray-700'}`}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
