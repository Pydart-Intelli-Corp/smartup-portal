// ═══════════════════════════════════════════════════════════════
// Fees & Invoices — Client Component
// Manage fee structures and view invoices
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  LayoutDashboard, CreditCard, RefreshCw, Plus, FileText,
  Loader2, IndianRupee, Receipt, CheckCircle, Clock, AlertCircle,
  Calendar, Zap, Download, ExternalLink
} from 'lucide-react';

interface FeeStructure {
  id: string;
  name: string;
  description: string;
  amount_paise: number;
  currency: string;
  frequency: string;
  grade: string;
  subject: string;
  active: boolean;
  created_at: string;
}

interface Invoice {
  id: string;
  student_email: string;
  fee_structure_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_id: string | null;
  created_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

function money(paise: number, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : currency;
  return sym + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function FeesClient({ userName, userEmail, userRole }: Props) {
  const [tab, setTab] = useState<'invoices' | 'structures' | 'create' | 'generate'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Generate monthly state
  const [genMonth, setGenMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [genResult, setGenResult] = useState<{ generated: number; skipped: number; errors: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Create fee form
  const [fName, setFName] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fFreq, setFFreq] = useState('monthly');
  const [fGrade, setFGrade] = useState('');
  const [fSubject, setFSubject] = useState('');

  const navItems = [
    { label: 'Dashboard', href: '/owner', icon: LayoutDashboard },
    { label: 'Fees', href: '/owner/fees', icon: CreditCard, active: true },
  ];

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payment/invoices');
      const json = await res.json();
      if (json.success) setInvoices(json.data?.invoices || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchStructures = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payment/fee-structures');
      const json = await res.json();
      if (json.success) setStructures(json.data?.structures || json.data?.feeStructures || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchInvoices(); fetchStructures(); }, [fetchInvoices, fetchStructures]);

  const generateMonthlyInvoices = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const [year, month] = genMonth.split('-').map(Number);
      const res = await fetch('/api/v1/payment/generate-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const json = await res.json();
      if (json.success) {
        setGenResult({ generated: json.data.generated, skipped: json.data.skipped, errors: json.data.errors || [] });
        fetchInvoices(); // refresh
      } else {
        setGenResult({ generated: 0, skipped: 0, errors: [json.error || 'Failed to generate'] });
      }
    } catch (e) {
      console.error(e);
      setGenResult({ generated: 0, skipped: 0, errors: ['Network error'] });
    }
    setGenerating(false);
  };

  const createStructure = async () => {
    if (!fName || !fAmount) return;
    setActing(true);
    try {
      const res = await fetch('/api/v1/payment/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fName,
          description: fDesc,
          amountPaise: Math.round(Number(fAmount) * 100),
          currency: 'INR',
          frequency: fFreq,
          grade: fGrade || null,
          subject: fSubject || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFName(''); setFDesc(''); setFAmount(''); setFGrade(''); setFSubject('');
        setTab('structures');
        fetchStructures();
      } else alert(json.error);
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const statusIcon = (s: string) => {
    if (s === 'paid') return <CheckCircle className="h-3 w-3 text-green-400" />;
    if (s === 'overdue') return <AlertCircle className="h-3 w-3 text-red-400" />;
    return <Clock className="h-3 w-3 text-yellow-400" />;
  };

  const statusColor = (s: string) => {
    if (s === 'paid') return 'bg-green-500/20 text-green-400';
    if (s === 'overdue') return 'bg-red-500/20 text-red-400';
    return 'bg-yellow-500/20 text-yellow-400';
  };

  // Stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount_paise, 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount_paise, 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.amount_paise, 0);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail} navItems={navItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-amber-400" /> Fees & Invoices
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage fee structures and track payments</p>
          </div>
          <button onClick={() => { fetchInvoices(); fetchStructures(); }}
            className="rounded border border-border bg-muted px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent">
            <RefreshCw className={`h-3 w-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1"><IndianRupee className="h-3 w-3 inline mr-1" />Collected</p>
            <p className="text-xl font-bold text-green-400">{money(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3 inline mr-1" />Pending</p>
            <p className="text-xl font-bold text-yellow-400">{money(pendingAmount)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1"><AlertCircle className="h-3 w-3 inline mr-1" />Overdue</p>
            <p className="text-xl font-bold text-red-400">{money(overdueAmount)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-2">
          {[
            { key: 'invoices' as const, label: 'Invoices', icon: Receipt },
            { key: 'structures' as const, label: 'Fee Structures', icon: FileText },
            { key: 'create' as const, label: 'New Structure', icon: Plus },
            { key: 'generate' as const, label: 'Generate Monthly', icon: Calendar },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}>
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>

        {/* Generate Monthly Invoices */}
        {tab === 'generate' && (
          <div className="rounded-xl border border-border bg-muted/50 p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Generate Monthly Invoices
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-generate invoices for all active students based on their fee structures.
                Invoices already generated for the selected month will be skipped.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Month</label>
                <input type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
              <button onClick={generateMonthlyInvoices} disabled={generating}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 flex items-center gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {generating ? 'Generating...' : 'Generate Invoices'}
              </button>
            </div>
            {genResult && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Results</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{genResult.generated}</p>
                    <p className="text-xs text-muted-foreground">Invoices Generated</p>
                  </div>
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{genResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Already Existed (Skipped)</p>
                  </div>
                </div>
                {genResult.errors.length > 0 && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                    <p className="text-xs font-medium text-red-400 mb-1">Errors:</p>
                    {genResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-300">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Fee Structure */}
        {tab === 'create' && (
          <div className="rounded-xl border border-border bg-muted/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Create Fee Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Monthly Tuition"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount (₹)</label>
                <input type="number" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="5000"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <select value={fFreq} onChange={e => setFFreq(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One Time</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grade (optional)</label>
                <input value={fGrade} onChange={e => setFGrade(e.target.value)} placeholder="10th"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject (optional)</label>
                <input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="Mathematics"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Description..."
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
            <button onClick={createStructure} disabled={acting || !fName || !fAmount}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
              {acting ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Create Structure'}
            </button>
          </div>
        )}

        {/* Fee Structures */}
        {tab === 'structures' && (
          structures.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">No fee structures yet</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {structures.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-foreground text-sm">{s.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mb-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="text-green-400 font-semibold text-sm">{money(s.amount_paise, s.currency)}</span>
                    <span className="capitalize">{s.frequency.replace('_', ' ')}</span>
                    {s.grade && <span>Grade: {s.grade}</span>}
                    {s.subject && <span>Subject: {s.subject}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Invoices */}
        {tab === 'invoices' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Paid At</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="bg-muted/30 hover:bg-muted">
                      <td className="px-4 py-3 text-foreground text-xs">{inv.student_email}</td>
                      <td className="px-4 py-3 text-right text-green-400">{money(inv.amount_paise, inv.currency)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusColor(inv.status)}`}>
                          {statusIcon(inv.status)} {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(inv.due_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <a href={`/api/v1/payment/receipt/${inv.id}?type=invoice`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mr-2">
                          <Download className="h-3 w-3" /> Invoice
                        </a>
                        {inv.status === 'paid' && inv.payment_id && (
                          <a href={`/api/v1/payment/receipt/${inv.payment_id}?type=receipt`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
                            <ExternalLink className="h-3 w-3" /> Receipt
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </DashboardShell>
  );
}
