'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader,
  RefreshButton,
  TabBar,
  StatCard,
  Card,
  Badge,
  StatusBadge,
  LoadingState,
  EmptyState,
  Button,
  Input,
  Textarea,
  Select,
  FormPanel,
  FormField,
  FormGrid,
  FormActions,
  Modal,
  money,
  TableWrapper,
  THead,
  TH,
  TRow,
  type TabItem,
} from '@/components/dashboard/shared';
import { fmtSmartDateIST, fmtTimeIST } from '@/lib/utils';
import Script from 'next/script';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Radio,
  Eye,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  FileText,
  BookOpen,
  ClipboardList,
  AlertCircle,
  BarChart3,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Send,
  Brain,
  Download,
  Shield,
  CalendarClock,
  Ban,
} from 'lucide-react';

/* ─── Interfaces ──────────────────────────────────────────── */

function effectiveStatus(room: { status: string; scheduled_start: string; duration_minutes: number }): string {
  if (room.status === 'live') {
    const endMs = new Date(room.scheduled_start).getTime() + room.duration_minutes * 60_000;
    if (Date.now() >= endMs) return 'ended';
  }
  return room.status;
}

interface ChildRoom {
  room_id: string;
  room_name: string;
  subject: string;
  grade: string;
  status: string;
  scheduled_start: string;
  duration_minutes: number;
  teacher_email: string | null;
  student_email?: string;
  student_name?: string;
  batch_session_id?: string;
  batch_id?: string;
}

interface AttendanceChild {
  student_email: string;
  student_name: string;
  summary: {
    total_sessions: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
    avg_time_minutes: number;
    total_rejoins: number;
  };
  recent_sessions: Array<{
    room_id: string;
    batch_name: string;
    subject: string;
    grade: string;
    scheduled_start: string;
    status: string;
    is_late: boolean;
    late_by_seconds: number;
    time_in_class_seconds: number;
    join_count: number;
  }>;
}

interface ExamChild {
  student_email: string;
  student_name: string;
  summary: {
    total_exams: number;
    avg_percentage: number;
    best_score: number;
    worst_score: number;
    passed: number;
    failed: number;
  };
  exams: Array<{
    attempt_id: string;
    exam_title: string;
    subject: string;
    exam_type: string;
    total_marks: number;
    total_marks_obtained: number;
    percentage: number;
    grade_letter: string;
    passed: boolean;
    submitted_at: string;
  }>;
}

interface Complaint {
  id: string;
  subject: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

interface ParentSessionRequest {
  id: string;
  request_type: 'reschedule' | 'cancel';
  requester_email: string;
  batch_session_id: string;
  batch_id: string;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  batch_name?: string;
  subject?: string;
  session_date?: string;
  requester_name?: string;
}

interface LedgerEntry {
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit_paise: number;
  credit_paise: number;
  balance_paise: number;
  status?: string;
  currency: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
  permissions?: Record<string, boolean>;
}

type TabId = 'overview' | 'attendance' | 'exams' | 'fees' | 'reports' | 'complaints' | 'monitoring' | 'requests';
const VALID_TABS: TabId[] = ['overview', 'attendance', 'exams', 'fees', 'reports', 'complaints', 'monitoring', 'requests'];

/* ─── Component ───────────────────────────────────────────── */

export default function ParentDashboardClient({ userName, userEmail, userRole, permissions }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(h)) return h;
    }
    return 'overview';
  });
  const [rooms, setRooms] = useState<ChildRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);

  // Attendance state
  const [attendanceChildren, setAttendanceChildren] = useState<AttendanceChild[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Exam state
  const [examChildren, setExamChildren] = useState<ExamChild[]>([]);
  const [examLoading, setExamLoading] = useState(false);

  // Complaints state
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    subject: '',
    category: 'general',
    description: '',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<{
    total_invoiced_paise: number;
    total_paid_paise: number;
    outstanding_paise: number;
    currency: string;
  } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Reports state
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  // Monitoring state
  const [monitorReports, setMonitorReports] = useState<Record<string, unknown>[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  // Payment state
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Session requests state
  const [sessionRequests, setSessionRequests] = useState<ParentSessionRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    sessionId: '',
    batchId: '',
    childEmail: '',
    requestType: 'reschedule' as 'reschedule' | 'cancel',
    reason: '',
    proposedDate: '',
    proposedTime: '',
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  /* ─── Fetchers ─────────────────────────────────────────── */

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/parent/rooms');
      const data = await res.json();
      if (data.success) setRooms(data.data?.rooms || []);
    } catch (err) { console.error('Failed to fetch:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payment/invoices');
      const data = await res.json();
      if (data.success) setInvoices(data.data?.invoices || []);
    } catch (err) { console.error('Invoices fetch failed:', err); }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/v1/parent/attendance');
      const data = await res.json();
      if (data.success) setAttendanceChildren(data.data?.children || []);
    } catch (err) { console.error('Attendance fetch failed:', err); }
    finally { setAttendanceLoading(false); }
  }, []);

  const fetchExams = useCallback(async () => {
    setExamLoading(true);
    try {
      const res = await fetch('/api/v1/parent/exams');
      const data = await res.json();
      if (data.success) setExamChildren(data.data?.children || []);
    } catch (err) { console.error('Exams fetch failed:', err); }
    finally { setExamLoading(false); }
  }, []);

  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const res = await fetch('/api/v1/parent/complaints');
      const data = await res.json();
      if (data.success) setComplaints(data.data?.complaints || []);
    } catch (err) { console.error('Complaints fetch failed:', err); }
    finally { setComplaintsLoading(false); }
  }, []);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await fetch('/api/v1/payment/ledger');
      const data = await res.json();
      if (data.success) {
        setLedgerEntries(data.data?.entries || []);
        setLedgerSummary(data.data?.summary || null);
      }
    } catch (err) { console.error('Ledger fetch failed:', err); }
    finally { setLedgerLoading(false); }
  }, []);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch('/api/v1/parent/reports');
      const data = await res.json();
      if (data.success) setReports(data.data?.reports || []);
    } catch (err) { console.error('Reports fetch failed:', err); }
    finally { setReportsLoading(false); }
  }, []);

  const fetchMonitorReports = useCallback(async () => {
    setMonitorLoading(true);
    try {
      const res = await fetch('/api/v1/monitoring/reports?role=parent');
      const data = await res.json();
      if (data.success) setMonitorReports(data.data?.reports || []);
    } catch (err) { console.error('Monitor reports fetch failed:', err); }
    finally { setMonitorLoading(false); }
  }, []);

  const getRazorpay = () => (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;

  const handlePayInvoice = useCallback(async (invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      const res = await fetch('/api/v1/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Payment initiation failed'); return; }

      const order = data.data;

      if (order.mode === 'test' || order.mode === 'mock') {
        const cbRes = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: invoiceId }),
        });
        const cbData = await cbRes.json();
        if (cbData.success) { fetchLedger(); fetchInvoices(); }
        else { alert('Payment failed'); }
      } else {
        const Razorpay = getRazorpay();
        if (!Razorpay) { alert('Payment gateway loading...'); return; }
        const rzp = new Razorpay({
          key: order.gatewayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: 'SmartUp Academy',
          description: 'Fee Payment',
          order_id: order.orderId,
          prefill: order.prefill,
          theme: { color: '#059669' },
          handler: async (response: Record<string, string>) => {
            await fetch('/api/v1/payment/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            fetchLedger();
            fetchInvoices();
          },
        });
        rzp.open();
      }
    } catch { alert('Network error'); }
    finally { setPayingInvoice(null); }
  }, [fetchLedger, fetchInvoices]);

  const fetchSessionRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/v1/session-requests');
      const data = await res.json();
      if (data.success) setSessionRequests(data.requests ?? []);
    } catch (err) { console.error('[Parent] session-requests fetch failed:', err); }
    finally { setRequestsLoading(false); }
  }, []);

  const submitSessionRequest = async () => {
    if (!requestForm.sessionId || !requestForm.reason) return;
    setRequestSubmitting(true);
    try {
      const body: Record<string, string> = {
        batch_session_id: requestForm.sessionId,
        batch_id: requestForm.batchId,
        request_type: requestForm.requestType,
        reason: requestForm.reason,
      };
      if (requestForm.requestType === 'reschedule') {
        if (requestForm.proposedDate) body.proposed_date = requestForm.proposedDate;
        if (requestForm.proposedTime) body.proposed_time = requestForm.proposedTime;
      }
      const res = await fetch('/api/v1/session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowRequestForm(false);
        setRequestForm({ sessionId: '', batchId: '', childEmail: '', requestType: 'reschedule', reason: '', proposedDate: '', proposedTime: '' });
        fetchSessionRequests();
      }
    } catch { /* */ }
    finally { setRequestSubmitting(false); }
  };

  const withdrawSessionRequest = async (id: string) => {
    try {
      await fetch('/api/v1/session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw', request_id: id }),
      });
      fetchSessionRequests();
    } catch { /* */ }
  };

  /* ─── Submit complaint ──────────────────────────────────── */

  const submitComplaint = async () => {
    if (!complaintForm.subject.trim() || !complaintForm.description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/parent/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complaintForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowComplaintForm(false);
        setComplaintForm({ subject: '', category: 'general', description: '', priority: 'medium' });
        fetchComplaints();
      }
    } catch (err) { console.error('Complaint submit failed:', err); }
    finally { setSubmitting(false); }
  };

  /* ─── Hash sync ──────────────────────────────────────────── */

  useEffect(() => {
    const hash = activeTab === 'overview' ? '' : `#${activeTab}`;
    window.history.replaceState(null, '', window.location.pathname + hash);
  }, [activeTab]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(h)) setActiveTab(h);
      else if (!window.location.hash) setActiveTab('overview');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchInvoices();
  }, [fetchRooms, fetchInvoices]);

  // Lazy load tab data
  useEffect(() => {
    if (activeTab === 'attendance' && attendanceChildren.length === 0 && !attendanceLoading) fetchAttendance();
    if (activeTab === 'exams' && examChildren.length === 0 && !examLoading) fetchExams();
    if (activeTab === 'complaints' && complaints.length === 0 && !complaintsLoading) fetchComplaints();
    if (activeTab === 'fees' && ledgerEntries.length === 0 && !ledgerLoading) fetchLedger();
    if (activeTab === 'reports' && reports.length === 0 && !reportsLoading) fetchReports();
    if (activeTab === 'monitoring' && monitorReports.length === 0 && !monitorLoading) fetchMonitorReports();
    if (activeTab === 'requests' && sessionRequests.length === 0 && !requestsLoading) fetchSessionRequests();
  }, [activeTab, attendanceChildren.length, attendanceLoading, examChildren.length, examLoading,
      complaints.length, complaintsLoading, ledgerEntries.length, ledgerLoading, reports.length,
      reportsLoading, monitorReports.length, monitorLoading,
      fetchAttendance, fetchExams, fetchComplaints, fetchLedger, fetchReports, fetchMonitorReports, fetchSessionRequests,
      sessionRequests.length, requestsLoading]);

  /* ─── Derived ────────────────────────────────────────────── */

  const live = rooms.filter((r) => effectiveStatus(r) === 'live');
  const upcoming = rooms.filter((r) => effectiveStatus(r) === 'scheduled');
  const ended = rooms.filter((r) => effectiveStatus(r) === 'ended');
  const pendingRequestCount = sessionRequests.filter(r => r.status === 'pending').length;

  // Session picker options for requests tab
  const sessionPickerOptions = rooms
    .filter(r => ['scheduled', 'live', 'ended'].includes(effectiveStatus(r)))
    .map(r => ({
      value: r.batch_session_id || r.room_id,
      label: `${r.subject} - ${r.room_name} (${fmtSmartDateIST(r.scheduled_start)})`,
      batchId: r.batch_id || '',
    }));

  const tabs: TabItem[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    ...(permissions?.attendance_view !== false ? [{ key: 'attendance', label: 'Attendance', icon: ClipboardList }] : []),
    ...(permissions?.exams_view !== false ? [{ key: 'exams', label: 'Exams', icon: GraduationCap }] : []),
    ...(permissions?.fees_view !== false ? [{ key: 'fees', label: 'Fee Ledger', icon: CreditCard }] : []),
    ...(permissions?.reports_view !== false ? [{ key: 'reports', label: 'Reports', icon: BarChart3 }] : []),
    { key: 'monitoring', label: 'AI Monitoring', icon: Brain },
    { key: 'requests', label: 'Requests', icon: CalendarClock, count: pendingRequestCount || undefined },
    ...(permissions?.complaints_file !== false ? [{ key: 'complaints', label: 'Complaints', icon: MessageSquare }] : []),
  ];

  /* ─── Render ──────────────────────────────────────────── */

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} permissions={permissions}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />

      <div className="space-y-6">
        {/* Header */}
        <PageHeader icon={Shield} title="Parent Dashboard" subtitle="Monitor your child's sessions, progress, and fees">
          <RefreshButton loading={loading} onClick={() => { fetchRooms(); fetchInvoices(); }} label="Refresh" />
        </PageHeader>

        {/* Tabs */}
        <TabBar tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as TabId)} />

        {/* ─── OVERVIEW TAB ──────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Radio} label="Live Now" value={live.length} variant="success" />
              <StatCard icon={Calendar} label="Upcoming" value={upcoming.length} variant="info" />
              <StatCard icon={CheckCircle2} label="Total Sessions" value={rooms.length} variant="default" />
            </div>

            {/* Live classes with observe */}
            {live.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="h-4 w-4 animate-pulse" /> Live Now
                </h2>
                <div className="space-y-3">
                  {live.map((room) => (
                    <Card key={room.room_id} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                          <Radio className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{room.room_name}</h3>
                          <p className="text-xs text-gray-500">
                            {room.subject} · {room.grade} · Teacher: {room.teacher_email || '—'}
                          </p>
                        </div>
                        <a
                          href={`/classroom/${room.room_id}?mode=observe`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Observe
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Upcoming Sessions
              </h2>
              {loading && rooms.length === 0 ? (
                <LoadingState />
              ) : upcoming.length === 0 ? (
                <EmptyState icon={Calendar} message="No upcoming sessions" />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((room) => (
                    <Card key={room.room_id} className="p-4">
                      <div className="flex items-center gap-4">
                        <Calendar className="h-8 w-8 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{room.room_name}</h3>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>{room.subject} · {room.grade}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {fmtSmartDateIST(room.scheduled_start)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Completed */}
            {ended.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Completed
                </h2>
                <div className="space-y-2">
                  {ended.slice(0, 5).map((room) => (
                    <Card key={room.room_id} className="p-3 opacity-70">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{room.room_name}</p>
                          <p className="text-xs text-gray-400">{room.subject} · {room.grade}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Fee Summary */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Fee Summary
              </h2>
              {invoices.length === 0 ? (
                <EmptyState icon={CreditCard} message="No invoices found" />
              ) : (
                <div className="space-y-2">
                  {invoices.slice(0, 5).map((inv, idx) => {
                    const st = inv.status as string;
                    return (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{inv.invoice_number as string || `Invoice #${idx + 1}`}</p>
                            <p className="text-xs text-gray-500">
                              {money(inv.amount_paise as number, inv.currency as string)} · Due: {inv.due_date ? new Date(inv.due_date as string).toLocaleDateString('en-IN') : '—'}
                            </p>
                          </div>
                          <StatusBadge status={st} />
                        </div>
                      </Card>
                    );
                  })}
                  {invoices.length > 5 && (
                    <button onClick={() => setActiveTab('fees')} className="text-xs text-emerald-600 hover:underline">
                      View all {invoices.length} invoices →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ATTENDANCE TAB ──────────────────────────────── */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-600" /> Attendance Reports
              </h2>
              <RefreshButton loading={attendanceLoading} onClick={fetchAttendance} label="Refresh" />
            </div>

            {attendanceLoading ? (
              <LoadingState />
            ) : attendanceChildren.length === 0 ? (
              <EmptyState icon={ClipboardList} message="No attendance records found" />
            ) : (
              attendanceChildren.map((child) => (
                <div key={child.student_email} className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    {child.student_name}
                  </h3>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={BarChart3}
                      label="Attendance Rate"
                      value={`${child.summary.attendance_rate}%`}
                      variant={child.summary.attendance_rate >= 75 ? 'success' : 'danger'}
                    />
                    <StatCard icon={CheckCircle2} label="Present" value={`${child.summary.present}/${child.summary.total_sessions}`} variant="success" />
                    <StatCard icon={AlertCircle} label="Absent" value={child.summary.absent} variant="danger" />
                    <StatCard icon={Clock} label="Late" value={child.summary.late} variant="warning" />
                  </div>

                  {/* Recent Sessions */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase">Recent Sessions</h4>
                    <div className="space-y-2">
                      {child.recent_sessions.slice(0, 10).map((session, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              session.status === 'present' ? 'bg-emerald-500' :
                              session.status === 'absent' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{session.batch_name}</p>
                              <p className="text-xs text-gray-500">
                                {session.subject} · {new Date(session.scheduled_start).toLocaleDateString('en-IN')}
                                {session.is_late && (
                                  <span className="ml-2 text-amber-600">Late by {Math.round(session.late_by_seconds / 60)}min</span>
                                )}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {Math.round(session.time_in_class_seconds / 60)}min
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── EXAMS TAB ───────────────────────────────────── */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" /> Exam Results
              </h2>
              <RefreshButton loading={examLoading} onClick={fetchExams} label="Refresh" />
            </div>

            {examLoading ? (
              <LoadingState />
            ) : examChildren.length === 0 ? (
              <EmptyState icon={GraduationCap} message="No exam results found" />
            ) : (
              examChildren.map((child) => (
                <div key={child.student_email} className="space-y-4">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    {child.student_name}
                  </h3>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={BarChart3}
                      label="Average Score"
                      value={`${child.summary.avg_percentage}%`}
                      variant={child.summary.avg_percentage >= 60 ? 'success' : 'danger'}
                    />
                    <StatCard icon={BookOpen} label="Exams Taken" value={child.summary.total_exams} variant="default" />
                    <StatCard icon={TrendingUp} label="Passed" value={child.summary.passed} variant="success" />
                    <StatCard icon={TrendingDown} label="Failed" value={child.summary.failed} variant="danger" />
                  </div>

                  {/* Subject-wise Performance Matrix */}
                  {child.exams.length > 0 && (() => {
                    const bySubject: Record<string, { total: number; sum: number; passed: number; count: number; best: number; worst: number }> = {};
                    child.exams.forEach(e => {
                      if (!bySubject[e.subject]) bySubject[e.subject] = { total: 0, sum: 0, passed: 0, count: 0, best: 0, worst: 100 };
                      const s = bySubject[e.subject];
                      s.count++; s.sum += e.percentage; s.total += e.total_marks;
                      if (e.passed) s.passed++;
                      if (e.percentage > s.best) s.best = e.percentage;
                      if (e.percentage < s.worst) s.worst = e.percentage;
                    });
                    const subjects = Object.entries(bySubject);
                    if (subjects.length < 1) return null;
                    return (
                      <Card className="p-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <BarChart3 className="h-3 w-3" /> Subject Performance
                        </h4>
                        <div className="space-y-2.5">
                          {subjects.map(([subject, data]) => {
                            const avg = Math.round(data.sum / data.count);
                            const barColor = avg >= 75 ? 'bg-emerald-500' : avg >= 50 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={subject}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-900">{subject}</span>
                                  <span className="text-xs text-gray-500">
                                    {avg}% avg · {data.count} exam{data.count !== 1 ? 's' : ''} · {data.passed} passed
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${avg}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })()}

                  {/* Exam List */}
                  <div className="space-y-2">
                    {child.exams.map((exam) => (
                      <Card key={exam.attempt_id} className="p-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className={`h-5 w-5 ${exam.passed ? 'text-emerald-600' : 'text-red-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{exam.exam_title}</p>
                            <p className="text-xs text-gray-500">
                              {exam.subject} · {exam.exam_type} · {new Date(exam.submitted_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${exam.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                              {exam.total_marks_obtained}/{exam.total_marks}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {exam.percentage.toFixed(1)}% · {exam.grade_letter}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── FEES / LEDGER TAB ────────────────────────────── */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" /> Fees & Payments
              </h2>
              <RefreshButton loading={ledgerLoading} onClick={fetchLedger} label="Refresh" />
            </div>

            {ledgerLoading ? (
              <LoadingState />
            ) : (
              <>
                {/* Summary */}
                {ledgerSummary && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={FileText} label="Total Invoiced" value={money(ledgerSummary.total_invoiced_paise, ledgerSummary.currency)} variant="default" />
                    <StatCard icon={CheckCircle2} label="Total Paid" value={money(ledgerSummary.total_paid_paise, ledgerSummary.currency)} variant="success" />
                    <StatCard
                      icon={AlertCircle}
                      label="Outstanding"
                      value={money(ledgerSummary.outstanding_paise, ledgerSummary.currency)}
                      variant={ledgerSummary.outstanding_paise > 0 ? 'danger' : 'success'}
                    />
                  </div>
                )}

                {/* Pending Invoices — Pay Now */}
                {invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Pending Payments
                    </h3>
                    <div className="space-y-3">
                      {invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').map(inv => (
                        <Card key={inv.id as string} className="border-amber-200 p-4">
                          <div className="flex items-center gap-4">
                            <CreditCard className="h-8 w-8 text-amber-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{inv.description as string || inv.invoice_number as string}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Invoice: {inv.invoice_number as string} · Due: {new Date(inv.due_date as string).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-amber-600">{money(inv.amount_paise as number, inv.currency as string)}</p>
                              <Button
                                variant="primary"
                                size="xs"
                                icon={CreditCard}
                                loading={payingInvoice === inv.id}
                                onClick={() => handlePayInvoice(inv.id as string)}
                                className="mt-1"
                              >
                                {payingInvoice === inv.id ? 'Processing...' : 'Pay Now'}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid Invoices with PDF download */}
                {invoices.filter(inv => inv.status === 'paid').length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Payment Receipts
                    </h3>
                    <div className="space-y-2">
                      {invoices.filter(inv => inv.status === 'paid').slice(0, 20).map(inv => (
                        <Card key={inv.id as string} className="p-3">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{inv.description as string || inv.invoice_number as string}</p>
                              <p className="text-xs text-gray-500">
                                {inv.invoice_number as string} · Paid: {new Date(inv.paid_at as string).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-emerald-600 shrink-0">{money(inv.amount_paise as number, inv.currency as string)}</p>
                            <a
                              href={`/api/v1/payment/invoice-pdf/${inv.id as string}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </a>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Ledger Table */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Transaction Ledger
                  </h3>
                  {ledgerEntries.length === 0 ? (
                    <EmptyState icon={CreditCard} message="No fee transactions yet" />
                  ) : (
                    <TableWrapper>
                      <THead>
                        <TH>Date</TH>
                        <TH>Reference</TH>
                        <TH>Description</TH>
                        <TH className="text-right">Debit</TH>
                        <TH className="text-right">Credit</TH>
                        <TH className="text-right">Balance</TH>
                      </THead>
                      <tbody>
                        {ledgerEntries.map((entry, idx) => (
                          <TRow key={idx}>
                            <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-900">{entry.reference}</td>
                            <td className="px-4 py-2 text-xs text-gray-600 truncate max-w-[200px]">{entry.description}</td>
                            <td className="px-4 py-2 text-xs text-right text-red-600">
                              {entry.debit_paise > 0 ? money(entry.debit_paise, entry.currency) : ''}
                            </td>
                            <td className="px-4 py-2 text-xs text-right text-emerald-600">
                              {entry.credit_paise > 0 ? money(entry.credit_paise, entry.currency) : ''}
                            </td>
                            <td className={`px-4 py-2 text-xs text-right font-medium ${entry.balance_paise > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {money(entry.balance_paise, entry.currency)}
                            </td>
                          </TRow>
                        ))}
                      </tbody>
                    </TableWrapper>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── REPORTS TAB ─────────────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" /> Progress Reports
              </h2>
              <RefreshButton loading={reportsLoading} onClick={fetchReports} label="Refresh" />
            </div>

            {reportsLoading ? (
              <LoadingState />
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <EmptyState icon={BarChart3} message="No reports available yet" />
                <p className="text-xs text-gray-400 mt-1">Monthly progress reports will appear here once generated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => {
                  const id = String(report.id);
                  const isExpanded = expandedReport === id;
                  const data = report.data as Record<string, unknown>;
                  const students = (data?.students as Array<Record<string, unknown>>) || [];

                  return (
                    <Card key={id} className="overflow-hidden">
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : id)}
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <BarChart3 className="h-5 w-5 text-emerald-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{report.title as string}</p>
                          <p className="text-xs text-gray-500">
                            {report.report_type as string} · {new Date(report.created_at as string).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>

                      {isExpanded && students.length > 0 && (
                        <div className="border-t border-gray-200 p-4 space-y-4">
                          {students.map((student, sIdx) => {
                            const att = student.attendance as Record<string, number> || {};
                            const academic = student.academic as Record<string, number> || {};
                            const fees = student.fees as Record<string, number> || {};

                            return (
                              <div key={sIdx} className="rounded-lg border border-gray-100 p-3">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">{student.student_name as string}</h4>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Attendance</p>
                                    <p className="font-bold text-emerald-600">{att.attendance_rate || 0}%</p>
                                    <p className="text-[10px] text-gray-400">{att.present || 0}/{att.total_sessions || 0} sessions</p>
                                  </div>
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Academics</p>
                                    <p className="font-bold text-emerald-600">{academic.avg_percentage || 0}%</p>
                                    <p className="text-[10px] text-gray-400">{academic.exams_taken || 0} exams</p>
                                  </div>
                                  <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="text-gray-500">Fees</p>
                                    <p className={`font-bold ${(fees.overdue || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {(fees.pending || 0) + (fees.overdue || 0) > 0 ? `${fees.pending || 0} pending` : 'Clear'}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{fees.paid || 0} paid</p>
                                  </div>
                                </div>
                                {(student.topics_covered as Array<Record<string, unknown>>)?.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[10px] text-gray-400 uppercase mb-1">Topics Covered</p>
                                    <div className="flex flex-wrap gap-1">
                                      {(student.topics_covered as Array<Record<string, unknown>>).slice(0, 8).map((t, tIdx) => (
                                        <span key={tIdx} className="text-[10px] rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5">
                                          {t.class_portion as string}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── AI MONITORING TAB ─────────────────────────────── */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Brain className="h-5 w-5 text-emerald-600" /> AI Monitoring Reports
              </h2>
              <RefreshButton loading={monitorLoading} onClick={fetchMonitorReports} label="Refresh" />
            </div>

            {monitorLoading && monitorReports.length === 0 ? (
              <LoadingState />
            ) : monitorReports.length === 0 ? (
              <div className="text-center">
                <EmptyState icon={Brain} message="No monitoring reports yet" />
                <p className="text-xs text-gray-400 -mt-4">Reports will appear here after your children attend AI-monitored sessions</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                {(() => {
                  const metrics = monitorReports.reduce<{ totalSessions: number; avgAttendance: number; avgAttention: number; totalAlerts: number }>(
                    (acc, r) => {
                      const m = (r.metrics || {}) as Record<string, number>;
                      acc.totalSessions++;
                      acc.avgAttendance += (m.attendance_rate || 0);
                      acc.avgAttention += (m.avg_attention_score || 0);
                      acc.totalAlerts += (m.alerts_count || 0);
                      return acc;
                    },
                    { totalSessions: 0, avgAttendance: 0, avgAttention: 0, totalAlerts: 0 }
                  );
                  if (metrics.totalSessions > 0) {
                    metrics.avgAttendance = Math.round(metrics.avgAttendance / metrics.totalSessions);
                    metrics.avgAttention = Math.round(metrics.avgAttention / metrics.totalSessions);
                  }
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatCard icon={FileText} label="Reports" value={metrics.totalSessions} variant="info" />
                      <StatCard icon={CheckCircle2} label="Avg Attendance" value={`${metrics.avgAttendance}%`} variant="success" />
                      <StatCard
                        icon={Eye}
                        label="Avg Attention"
                        value={`${metrics.avgAttention}%`}
                        variant={metrics.avgAttention >= 70 ? 'success' : metrics.avgAttention >= 50 ? 'warning' : 'danger'}
                      />
                      <StatCard
                        icon={AlertCircle}
                        label="Total Alerts"
                        value={metrics.totalAlerts}
                        variant={metrics.totalAlerts > 10 ? 'danger' : 'warning'}
                      />
                    </div>
                  );
                })()}

                {/* Reports grouped by child */}
                {(() => {
                  const byChild: Record<string, Record<string, unknown>[]> = {};
                  monitorReports.forEach((r) => {
                    const key = String(r.target_email || 'unknown');
                    if (!byChild[key]) byChild[key] = [];
                    byChild[key].push(r);
                  });
                  return Object.entries(byChild).map(([email, childReports]) => {
                    const childName = String(childReports[0]?.target_name || email);
                    return (
                      <Card key={email}>
                        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 rounded-t-xl">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <Users className="h-4 w-4 text-emerald-600" />
                            {childName}
                            <Badge label={`${childReports.length} report${childReports.length !== 1 ? 's' : ''}`} variant="primary" />
                          </h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {childReports.map((report) => {
                            const m = (report.metrics || {}) as Record<string, unknown>;
                            const rId = String(report.id);
                            const isExpanded = expandedReport === rId;
                            return (
                              <div key={rId} className="px-4 py-3">
                                <button
                                  onClick={() => setExpandedReport(isExpanded ? null : rId)}
                                  className="flex w-full items-center justify-between text-left"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {String(report.report_type || 'session').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Report
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {report.period_start ? fmtSmartDateIST(String(report.period_start)) : ''}
                                      {report.period_end ? ` – ${fmtSmartDateIST(String(report.period_end))}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {m.avg_attention_score != null && (
                                      <Badge
                                        label={`Attention: ${Number(m.avg_attention_score).toFixed(0)}%`}
                                        variant={Number(m.avg_attention_score) >= 70 ? 'success' : Number(m.avg_attention_score) >= 50 ? 'warning' : 'danger'}
                                      />
                                    )}
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                      {m.attendance_rate != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.attendance_rate).toFixed(0)}%</p>
                                          <p className="text-[10px] text-gray-500">Attendance</p>
                                        </div>
                                      )}
                                      {m.avg_attention_score != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.avg_attention_score).toFixed(0)}%</p>
                                          <p className="text-[10px] text-gray-500">Attention</p>
                                        </div>
                                      )}
                                      {m.alerts_count != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.alerts_count)}</p>
                                          <p className="text-[10px] text-gray-500">Alerts</p>
                                        </div>
                                      )}
                                      {m.sessions_monitored != null && (
                                        <div className="rounded-lg bg-gray-50 p-2 text-center">
                                          <p className="text-sm font-bold text-gray-900">{Number(m.sessions_monitored)}</p>
                                          <p className="text-[10px] text-gray-500">Sessions</p>
                                        </div>
                                      )}
                                    </div>
                                    {m.overall_summary ? (
                                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                                        <div className="mb-1 flex items-center gap-1 font-semibold">
                                          <Shield className="h-3.5 w-3.5" /> AI Summary
                                        </div>
                                        {String(m.overall_summary)}
                                      </div>
                                    ) : null}
                                    {Array.isArray(m.alert_breakdown) && (m.alert_breakdown as Array<Record<string, unknown>>).length > 0 && (
                                      <div>
                                        <p className="mb-1 text-xs font-medium text-gray-500">Alert Breakdown</p>
                                        <div className="flex flex-wrap gap-2">
                                          {(m.alert_breakdown as Array<Record<string, unknown>>).map((ab, i) => (
                                            <Badge key={i} label={`${String(ab.type || ab.alert_type || 'alert')}: ${String(ab.count || 0)}`} variant="default" />
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  });
                })()}
              </>
            )}
          </div>
        )}

        {/* ─── REQUESTS TAB ─────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-emerald-600" /> Session Requests
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={showRequestForm ? 'outline' : 'primary'}
                  size="sm"
                  icon={Send}
                  onClick={() => setShowRequestForm(!showRequestForm)}
                >
                  {showRequestForm ? 'Cancel' : 'New Request'}
                </Button>
                <RefreshButton loading={requestsLoading} onClick={fetchSessionRequests} label="Refresh" />
              </div>
            </div>

            {showRequestForm && (
              <FormPanel title="Submit Request on Behalf of Child" icon={Send} onClose={() => setShowRequestForm(false)}>
                <FormGrid cols={2}>
                  <FormField label="Session" required>
                    <Select
                      value={requestForm.sessionId}
                      onChange={(val) => {
                        const picked = sessionPickerOptions.find(o => o.value === val);
                        setRequestForm(f => ({
                          ...f,
                          sessionId: val,
                          batchId: picked?.batchId || '',
                        }));
                      }}
                      options={sessionPickerOptions.map(o => ({ value: o.value, label: o.label }))}
                      placeholder="Select a session..."
                    />
                  </FormField>
                  <FormField label="Request Type" required>
                    <Select
                      value={requestForm.requestType}
                      onChange={(val) => setRequestForm(f => ({ ...f, requestType: val as 'reschedule' | 'cancel' }))}
                      options={[
                        { value: 'reschedule', label: 'Reschedule' },
                        { value: 'cancel', label: 'Cancel' },
                      ]}
                    />
                  </FormField>
                  {requestForm.requestType === 'reschedule' && (
                    <>
                      <FormField label="Proposed Date">
                        <Input
                          type="date"
                          value={requestForm.proposedDate}
                          onChange={(e) => setRequestForm(f => ({ ...f, proposedDate: e.target.value }))}
                        />
                      </FormField>
                      <FormField label="Proposed Time">
                        <Input
                          type="time"
                          value={requestForm.proposedTime}
                          onChange={(e) => setRequestForm(f => ({ ...f, proposedTime: e.target.value }))}
                        />
                      </FormField>
                    </>
                  )}
                </FormGrid>
                <FormField label="Reason" required className="mt-4">
                  <Textarea
                    rows={3}
                    placeholder="Explain why you need this change..."
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </FormField>
                <FormActions
                  submitLabel="Submit Request"
                  onSubmit={submitSessionRequest}
                  onCancel={() => setShowRequestForm(false)}
                  submitting={requestSubmitting}
                  submitDisabled={!requestForm.sessionId || !requestForm.reason}
                />
              </FormPanel>
            )}

            {requestsLoading ? (
              <LoadingState />
            ) : sessionRequests.length === 0 ? (
              <EmptyState icon={CalendarClock} message="No session requests yet" />
            ) : (
              <div className="space-y-3">
                {sessionRequests.map(r => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          r.request_type === 'cancel' ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
                        }`}>
                          {r.request_type === 'cancel'
                            ? <Ban className="h-4 w-4 text-red-500" />
                            : <CalendarClock className="h-4 w-4 text-emerald-600" />
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-900">
                              {r.request_type === 'cancel' ? 'Cancel' : 'Reschedule'} — {r.subject || 'Session'}
                            </span>
                            <StatusBadge status={r.status} />
                          </div>
                          <p className="text-xs text-gray-500">
                            {r.batch_name && `${r.batch_name} · `}
                            {r.session_date && fmtSmartDateIST(r.session_date)}
                            {r.proposed_date && ` → ${fmtSmartDateIST(r.proposed_date)}`}
                            {r.proposed_time && ` at ${r.proposed_time}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                          {r.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {r.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                        {r.status === 'pending' && (
                          <button onClick={() => withdrawSessionRequest(r.id)} className="text-[10px] text-red-600 hover:text-red-700 font-medium">
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── COMPLAINTS TAB ──────────────────────────────── */}
        {activeTab === 'complaints' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" /> Complaints & Feedback
              </h2>
              <Button variant="primary" size="sm" icon={AlertCircle} onClick={() => setShowComplaintForm(true)}>
                Submit Complaint
              </Button>
            </div>

            {/* New Complaint Form */}
            {showComplaintForm && (
              <FormPanel title="New Complaint" icon={MessageSquare} onClose={() => setShowComplaintForm(false)}>
                <FormGrid cols={1}>
                  <FormField label="Subject" required>
                    <Input
                      placeholder="Subject"
                      value={complaintForm.subject}
                      onChange={(e) => setComplaintForm(f => ({ ...f, subject: e.target.value }))}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid cols={2}>
                  <FormField label="Category">
                    <Select
                      value={complaintForm.category}
                      onChange={(val) => setComplaintForm(f => ({ ...f, category: val }))}
                      options={[
                        { value: 'general', label: 'General' },
                        { value: 'teaching', label: 'Teaching' },
                        { value: 'fee', label: 'Fee Related' },
                        { value: 'facility', label: 'Facility' },
                        { value: 'behaviour', label: 'Behaviour' },
                        { value: 'academic', label: 'Academic' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </FormField>
                  <FormField label="Priority">
                    <Select
                      value={complaintForm.priority}
                      onChange={(val) => setComplaintForm(f => ({ ...f, priority: val }))}
                      options={[
                        { value: 'low', label: 'Low Priority' },
                        { value: 'medium', label: 'Medium Priority' },
                        { value: 'high', label: 'High Priority' },
                        { value: 'urgent', label: 'Urgent' },
                      ]}
                    />
                  </FormField>
                </FormGrid>
                <FormField label="Description" required className="mt-4">
                  <Textarea
                    placeholder="Describe your complaint or feedback in detail..."
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                  />
                </FormField>
                <FormActions
                  submitLabel={submitting ? 'Submitting...' : 'Submit Complaint'}
                  onSubmit={submitComplaint}
                  onCancel={() => setShowComplaintForm(false)}
                  submitting={submitting}
                  submitDisabled={!complaintForm.subject.trim() || !complaintForm.description.trim()}
                />
              </FormPanel>
            )}

            {/* Complaints List */}
            {complaintsLoading ? (
              <LoadingState />
            ) : complaints.length === 0 ? (
              <div className="text-center">
                <EmptyState icon={MessageSquare} message="No complaints submitted" />
                <p className="text-xs text-gray-400 -mt-4">Submit a complaint using the button above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((complaint) => (
                  <Card key={complaint.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{complaint.subject}</h3>
                          <StatusBadge status={complaint.status.replace('_', ' ')} />
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{complaint.description}</p>
                        <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                          <span className="capitalize">{complaint.category}</span>
                          <span>Priority: <span className="capitalize">{complaint.priority}</span></span>
                          <span>{new Date(complaint.created_at).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                    {complaint.resolution && (
                      <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2">
                        <p className="text-[10px] text-emerald-600 uppercase font-semibold mb-1">Resolution</p>
                        <p className="text-xs text-emerald-700">{complaint.resolution}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
