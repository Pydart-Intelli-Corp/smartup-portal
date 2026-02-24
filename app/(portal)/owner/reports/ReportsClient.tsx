// ═══════════════════════════════════════════════════════════════
// Reports — Client Component
// Generate and view system reports
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, BarChart3, FileText, RefreshCw, Plus,
  Calendar, TrendingUp, Users, GraduationCap, Briefcase,
  BookOpen, Loader2
} from 'lucide-react';

interface Report {
  id: string;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

const REPORT_TYPES = [
  { value: 'attendance', label: 'Attendance', icon: Users, color: 'text-blue-400' },
  { value: 'revenue', label: 'Revenue', icon: TrendingUp, color: 'text-green-400' },
  { value: 'teacher_performance', label: 'Teacher Performance', icon: BookOpen, color: 'text-emerald-400' },
  { value: 'student_progress', label: 'Student Progress', icon: GraduationCap, color: 'text-violet-400' },
  { value: 'batch_summary', label: 'Batch Summary', icon: Calendar, color: 'text-amber-400' },
  { value: 'exam_analytics', label: 'Exam Analytics', icon: FileText, color: 'text-rose-400' },
  { value: 'payroll_summary', label: 'Payroll Summary', icon: Briefcase, color: 'text-teal-400' },
];

export default function ReportsClient({ userName, userEmail, userRole }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Form
  const [formType, setFormType] = useState('attendance');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [showForm, setShowForm] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/owner', icon: LayoutDashboard },
    { label: 'Reports', href: '/owner/reports', icon: BarChart3, active: true },
  ];

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/reports');
      const json = await res.json();
      if (json.success) setReports(json.data?.reports || []);
    } catch (e) { console.error('Failed to load reports', e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generateReport = async () => {
    if (!formType || !formStart || !formEnd) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: formType, periodStart: formStart, periodEnd: formEnd }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        fetchReports();
      } else {
        alert(json.error || 'Failed to generate report');
      }
    } catch (e) { console.error('Generate report failed', e); }
    setGenerating(false);
  };

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-400" /> Reports
            </h1>
            <p className="text-sm text-gray-400 mt-1">Generate and review system reports</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchReports} className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
              <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">
              <Plus className="h-3 w-3 inline mr-1" /> Generate
            </button>
          </div>
        </div>

        {/* Generate Form */}
        {showForm && (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Generate New Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Report Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white">
                  {REPORT_TYPES.map(rt => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Period Start</label>
                <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Period End</label>
                <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
              </div>
              <div className="flex items-end">
                <button onClick={generateReport} disabled={generating || !formStart || !formEnd}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Type Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            return (
              <button key={rt.value}
                onClick={() => { setFormType(rt.value); setShowForm(true); }}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:border-gray-600 hover:bg-gray-800 transition">
                <Icon className={`h-6 w-6 ${rt.color}`} />
                <span className="text-xs text-gray-400 text-center">{rt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Report Detail */}
        {selectedReport && (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{selectedReport.title}</h3>
              <button onClick={() => setSelectedReport(null)} className="text-xs text-gray-500 hover:text-gray-300">Close</button>
            </div>
            <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              {JSON.stringify(selectedReport.data, null, 2)}
            </pre>
          </div>
        )}

        {/* Report List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <FileText className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">No reports generated yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map(report => {
              const rt = REPORT_TYPES.find(r => r.value === report.report_type);
              const Icon = rt?.icon || FileText;
              return (
                <button key={report.id} onClick={() => setSelectedReport(report)}
                  className="w-full flex items-center gap-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4 hover:bg-gray-800 text-left transition">
                  <Icon className={`h-5 w-5 ${rt?.color || 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{report.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.period_start).toLocaleDateString('en-IN')} — {new Date(report.period_end).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(report.created_at).toLocaleDateString('en-IN')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
