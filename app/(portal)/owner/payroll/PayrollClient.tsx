// ═══════════════════════════════════════════════════════════════
// Payroll Management — Client Component
// Manage teacher pay configs, payroll periods, payslips
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, Briefcase, Users, Calendar, DollarSign,
  RefreshCw, Plus, Check, Loader2, ArrowRight, Settings, FileText
} from 'lucide-react';

interface PayConfig {
  id: string;
  teacher_email: string;
  currency: string;
  per_class_rate_paise: number;
  bonus_per_class_paise: number;
  bonus_threshold_classes: number;
  created_at: string;
}

interface PayrollPeriod {
  id: string;
  label: string;
  period_start: string;
  period_end: string;
  status: string;
  payslip_count: number;
  total_paise: number;
  created_at: string;
}

interface Payslip {
  id: string;
  period_id: string;
  teacher_email: string;
  classes_conducted: number;
  classes_cancelled: number;
  classes_missed: number;
  base_pay_paise: number;
  incentive_paise: number;
  lop_paise: number;
  total_paise: number;
  status: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

function paise(v: number) {
  return '₹' + (v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function PayrollClient({ userName, userEmail, userRole }: Props) {
  const [tab, setTab] = useState<'periods' | 'configs' | 'create'>('periods');
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [configs, setConfigs] = useState<PayConfig[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Create period form
  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  // Config form
  const [cfgEmail, setCfgEmail] = useState('');
  const [cfgRate, setCfgRate] = useState('500');
  const [cfgBonus, setCfgBonus] = useState('100');
  const [cfgThreshold, setCfgThreshold] = useState('20');

  const navItems = [
    { label: 'Dashboard', href: '/owner', icon: LayoutDashboard },
    { label: 'Payroll', href: '/owner/payroll', icon: Briefcase, active: true },
  ];

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payroll?resource=periods');
      const json = await res.json();
      if (json.success) setPeriods(json.data?.periods || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payroll?resource=configs');
      const json = await res.json();
      if (json.success) setConfigs(json.data?.configs || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPayslips = useCallback(async (periodId: string) => {
    try {
      const res = await fetch(`/api/v1/payroll?resource=payslips&periodId=${periodId}`);
      const json = await res.json();
      if (json.success) setPayslips(json.data?.payslips || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchPeriods(); fetchConfigs(); }, [fetchPeriods, fetchConfigs]);

  useEffect(() => {
    if (selectedPeriod) fetchPayslips(selectedPeriod);
  }, [selectedPeriod, fetchPayslips]);

  const createPeriod = async () => {
    if (!newLabel || !newStart || !newEnd) return;
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_period', label: newLabel, periodStart: newStart, periodEnd: newEnd }),
      });
      const json = await res.json();
      if (json.success) { setTab('periods'); setNewLabel(''); setNewStart(''); setNewEnd(''); fetchPeriods(); }
      else alert(json.error);
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!json.success) alert(json.error);
      fetchPeriods();
      if (selectedPeriod) fetchPayslips(selectedPeriod);
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const saveConfig = async () => {
    if (!cfgEmail) return;
    setActing(true);
    try {
      const res = await fetch('/api/v1/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_config',
          teacherEmail: cfgEmail,
          currency: 'INR',
          perClassRatePaise: Number(cfgRate) * 100,
          bonusPerClassPaise: Number(cfgBonus) * 100,
          bonusThresholdClasses: Number(cfgThreshold),
        }),
      });
      const json = await res.json();
      if (json.success) { setCfgEmail(''); fetchConfigs(); }
      else alert(json.error);
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const period = periods.find(p => p.id === selectedPeriod);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-teal-400" /> Payroll
            </h1>
            <p className="text-sm text-gray-400 mt-1">Manage teacher pay, generate payslips</p>
          </div>
          <button onClick={fetchPeriods} className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          {[
            { key: 'periods' as const, label: 'Payroll Periods', icon: Calendar },
            { key: 'configs' as const, label: 'Pay Configs', icon: Settings },
            { key: 'create' as const, label: 'New Period', icon: Plus },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Create Period */}
        {tab === 'create' && (
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Create Payroll Period</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Label</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. June 2025"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start</label>
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">End</label>
                <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
              </div>
              <div className="flex items-end">
                <button onClick={createPeriod} disabled={acting}
                  className="w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pay Configs */}
        {tab === 'configs' && (
          <div className="space-y-4">
            {/* Add config */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Set Teacher Pay Config</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Teacher Email</label>
                  <input value={cfgEmail} onChange={e => setCfgEmail(e.target.value)} placeholder="teacher@example.com"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Per Class (₹)</label>
                  <input type="number" value={cfgRate} onChange={e => setCfgRate(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Bonus / Class (₹)</label>
                  <input type="number" value={cfgBonus} onChange={e => setCfgBonus(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Bonus Threshold</label>
                  <input type="number" value={cfgThreshold} onChange={e => setCfgThreshold(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                </div>
                <div className="flex items-end">
                  <button onClick={saveConfig} disabled={acting || !cfgEmail}
                    className="w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">
                    {acting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* Config list */}
            {configs.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">No pay configs set yet</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800 text-gray-400 text-xs">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3">Per Class</th>
                      <th className="px-4 py-3">Bonus / Class</th>
                      <th className="px-4 py-3">Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {configs.map(c => (
                      <tr key={c.id} className="bg-gray-800/30 hover:bg-gray-800">
                        <td className="px-4 py-3 text-white">{c.teacher_email}</td>
                        <td className="px-4 py-3 text-green-400">{paise(c.per_class_rate_paise)}</td>
                        <td className="px-4 py-3 text-blue-400">{paise(c.bonus_per_class_paise)}</td>
                        <td className="px-4 py-3 text-gray-300">{c.bonus_threshold_classes} classes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Periods */}
        {tab === 'periods' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : periods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <FileText className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm">No payroll periods yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {periods.map(p => (
                  <div key={p.id} className={`rounded-xl border p-4 transition cursor-pointer ${
                    selectedPeriod === p.id ? 'border-teal-500 bg-teal-900/20' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                  }`} onClick={() => setSelectedPeriod(p.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{p.label}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        p.status === 'finalized' ? 'bg-blue-500/20 text-blue-400' :
                        p.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-600 text-gray-300'
                      }`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(p.period_start).toLocaleDateString('en-IN')} — {new Date(p.period_end).toLocaleDateString('en-IN')}
                    </p>
                    <div className="flex justify-between mt-3 text-xs">
                      <span className="text-gray-400"><Users className="h-3 w-3 inline mr-1" />{p.payslip_count} payslips</span>
                      <span className="text-green-400 font-semibold">{paise(Number(p.total_paise) || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payslip detail for selected period */}
            {selectedPeriod && period && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{period.label} — Payslips</h3>
                  <div className="flex gap-2">
                    {period.status === 'draft' && (
                      <>
                        <button onClick={() => doAction('generate', { periodId: selectedPeriod })} disabled={acting}
                          className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-500 disabled:opacity-50">
                          {acting ? <Loader2 className="h-3 w-3 animate-spin inline" /> : <><ArrowRight className="h-3 w-3 inline mr-1" />Generate</>}
                        </button>
                        <button onClick={() => doAction('finalize', { periodId: selectedPeriod })} disabled={acting}
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50">
                          <Check className="h-3 w-3 inline mr-1" />Finalize
                        </button>
                      </>
                    )}
                    {period.status === 'finalized' && (
                      <button onClick={() => doAction('mark_paid', { periodId: selectedPeriod })} disabled={acting}
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50">
                        <DollarSign className="h-3 w-3 inline mr-1" />Mark Paid
                      </button>
                    )}
                  </div>
                </div>

                {payslips.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No payslips. Click &quot;Generate&quot; to compute.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-800 text-gray-400 text-xs">
                        <tr>
                          <th className="px-3 py-2">Teacher</th>
                          <th className="px-3 py-2 text-center">Classes</th>
                          <th className="px-3 py-2 text-center">Cancelled</th>
                          <th className="px-3 py-2 text-center">Missed</th>
                          <th className="px-3 py-2 text-right">Base</th>
                          <th className="px-3 py-2 text-right">Incentive</th>
                          <th className="px-3 py-2 text-right">LOP</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {payslips.map(s => (
                          <tr key={s.id} className="bg-gray-800/30 hover:bg-gray-800">
                            <td className="px-3 py-2 text-white text-xs">{s.teacher_email}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{s.classes_conducted}</td>
                            <td className="px-3 py-2 text-center text-yellow-400">{s.classes_cancelled}</td>
                            <td className="px-3 py-2 text-center text-red-400">{s.classes_missed}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{paise(s.base_pay_paise)}</td>
                            <td className="px-3 py-2 text-right text-green-400">{paise(s.incentive_paise)}</td>
                            <td className="px-3 py-2 text-right text-red-400">-{paise(s.lop_paise)}</td>
                            <td className="px-3 py-2 text-right text-white font-semibold">{paise(s.total_paise)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                s.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                              }`}>{s.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
