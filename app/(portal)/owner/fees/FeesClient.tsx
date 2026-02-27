// ═══════════════════════════════════════════════════════════════
// Fees & Invoices — Client Component
// Uses shared UI components — no hardcoded colors or styles
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import {
  PageHeader, RefreshButton, Button,
  TabBar, FormPanel, FormField, FormGrid, FormActions,
  Input, Select,
  TableWrapper, THead, TH, TRow,
  StatCardSmall,
  LoadingState, EmptyState, StatusBadge, Badge, Alert,
  useToast, money,
} from '@/components/dashboard/shared';
import {
  CreditCard, Receipt, FileText, Plus, Calendar,
  IndianRupee, Clock, AlertCircle, Download, ExternalLink,
  Zap, CheckCircle, Send, Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface FeeStructure {
  id: string;
  batch_type: string;
  amount_paise: number;
  currency: string;
  billing_period: string;
  grade: string;
  subject: string;
  is_active: boolean;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  student_email: string;
  student_name: string | null;
  description: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function FeesClient({ userName, userEmail, userRole }: Props) {
  const [tab, setTab] = useState('invoices');
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
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Create fee form
  const [fName, setFName] = useState('one_to_one');
  const [fAmount, setFAmount] = useState('');
  const [fFreq, setFFreq] = useState('monthly');
  const [fGrade, setFGrade] = useState('');
  const [fSubject, setFSubject] = useState('');

  const toast = useToast();

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
      if (json.success) setStructures(json.data?.structures || json.data?.feeStructures || json.data?.fee_structures || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchInvoices(); fetchStructures(); }, [fetchInvoices, fetchStructures]);

  const refresh = () => { fetchInvoices(); fetchStructures(); };

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
        toast.success(`Generated ${json.data.generated} invoices`);
        fetchInvoices();
      } else {
        setGenResult({ generated: 0, skipped: 0, errors: [json.error || 'Failed to generate'] });
      }
    } catch {
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
          batch_type: fName,
          amount_paise: Math.round(Number(fAmount) * 100),
          currency: 'INR', billing_period: fFreq,
          grade: fGrade || null, subject: fSubject || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFName('one_to_one'); setFAmount(''); setFGrade(''); setFSubject('');
        setTab('structures');
        toast.success('Fee structure created');
        fetchStructures();
      } else {
        toast.error(json.error || 'Failed to create');
      }
    } catch (e) { console.error(e); }
    setActing(false);
  };

  const sendReminder = async (invoiceId: string) => {
    setSendingReminder(invoiceId);
    try {
      const res = await fetch('/api/v1/payment/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Reminder sent to ${json.data.count} recipient(s)`);
      } else {
        toast.error(json.error || 'Failed to send reminder');
      }
    } catch { toast.error('Network error'); }
    setSendingReminder(null);
  };

  // Stats
  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount_paise, 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount_paise, 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.amount_paise, 0);

  return (
    <DashboardShell role={userRole} userName={userName} userEmail={userEmail}>
      <div className="space-y-6">
        <PageHeader icon={CreditCard} title="Fees & Invoices" subtitle="Manage fee structures and track payments">
          <RefreshButton loading={loading} onClick={refresh} />
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSmall icon={IndianRupee} label="Collected" value={money(totalRevenue)} variant="success" />
          <StatCardSmall icon={Clock} label="Pending" value={money(pendingAmount)} variant="warning" />
          <StatCardSmall icon={AlertCircle} label="Overdue" value={money(overdueAmount)} variant="danger" />
        </div>

        {/* Tabs */}
        <TabBar
          tabs={[
            { key: 'invoices', label: 'Invoices', icon: Receipt },
            { key: 'structures', label: 'Fee Structures', icon: FileText },
            { key: 'create', label: 'New Structure', icon: Plus },
            { key: 'generate', label: 'Generate Monthly', icon: Calendar },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* Generate Monthly Invoices */}
        {tab === 'generate' && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" /> Generate Monthly Invoices
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Auto-generate invoices for all active students based on their fee structures.
                Invoices already generated for the selected month will be skipped.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <FormField label="Month">
                <Input type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)} />
              </FormField>
              <Button variant="primary" icon={Zap} onClick={generateMonthlyInvoices} loading={generating}>
                {generating ? 'Generating…' : 'Generate Invoices'}
              </Button>
            </div>
            {genResult && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Results</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{genResult.generated}</p>
                    <p className="text-xs text-gray-500">Invoices Generated</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{genResult.skipped}</p>
                    <p className="text-xs text-gray-500">Already Existed (Skipped)</p>
                  </div>
                </div>
                {genResult.errors.length > 0 && (
                  <Alert variant="error" message={genResult.errors.join(', ')} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Fee Structure */}
        {tab === 'create' && (
          <FormPanel title="Create Fee Structure" icon={Plus} onClose={() => setTab('structures')}>
            <FormGrid cols={3}>
              <FormField label="Batch Type">
                <Select value={fName} onChange={setFName} options={[
                  { value: 'one_to_one', label: '1-to-1' },
                  { value: 'one_to_three', label: '1-to-3' },
                  { value: 'one_to_many', label: '1-to-Many' },
                ]} />
              </FormField>
              <FormField label="Amount (₹)">
                <Input type="number" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="5000" />
              </FormField>
              <FormField label="Billing Period">
                <Select value={fFreq} onChange={setFFreq} options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'quarterly', label: 'Quarterly' },
                  { value: 'yearly', label: 'Yearly' },
                ]} />
              </FormField>
              <FormField label="Grade (optional)">
                <Input value={fGrade} onChange={e => setFGrade(e.target.value)} placeholder="10th" />
              </FormField>
              <FormField label="Subject (optional)">
                <Input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="Mathematics" />
              </FormField>
            </FormGrid>
            <FormActions onCancel={() => setTab('structures')} onSubmit={createStructure} submitLabel="Create Structure" submitDisabled={!fAmount} submitting={acting} />
          </FormPanel>
        )}

        {/* Fee Structures */}
        {tab === 'structures' && (
          structures.length === 0 ? (
            <EmptyState icon={FileText} message="No fee structures yet" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {structures.map(s => (
                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{s.batch_type}</h4>
                    <Badge label={s.is_active ? 'Active' : 'Inactive'} variant={s.is_active ? 'success' : 'default'} />
                  </div>
                  {s.batch_type && <p className="text-xs text-gray-500 mb-2 capitalize">{s.batch_type.replace(/_/g, '-')}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="text-green-700 font-semibold text-sm">{money(s.amount_paise, s.currency)}</span>
                    <span className="capitalize">{s.billing_period.replace('_', ' ')}</span>
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
            <LoadingState />
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} message="No invoices found" />
          ) : (
            <TableWrapper footer={<><span>Showing {invoices.length} invoices</span><span>{invoices.filter(i => i.status === 'paid').length} paid</span></>}>
              <THead>
                <TH>Student</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-center">Status</TH>
                <TH>Due Date</TH>
                <TH>Paid At</TH>
                <TH className="text-center">Actions</TH>
              </THead>
              <tbody>
                {invoices.map(inv => (
                  <TRow key={inv.id}>
                    <td className="px-4 py-3 text-gray-800 text-xs">
                      <span className="font-medium">{inv.student_name || inv.student_email}</span>
                      {inv.student_name && <span className="block text-gray-400">{inv.student_email}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{money(inv.amount_paise, inv.currency)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} icon={inv.status === 'paid' ? CheckCircle : inv.status === 'overdue' ? AlertCircle : Clock} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(inv.due_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <a href={`/api/v1/payment/invoice-pdf/${inv.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mr-2">
                        <Download className="h-3 w-3" /> Invoice
                      </a>
                      {inv.status === 'paid' && (
                        <a href={`/api/v1/payment/receipt/${inv.id}?type=invoice`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700">
                          <ExternalLink className="h-3 w-3" /> Receipt
                        </a>
                      )}
                      {(inv.status === 'pending' || inv.status === 'overdue') && (
                        <button
                          onClick={() => sendReminder(inv.id)}
                          disabled={sendingReminder === inv.id}
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 disabled:opacity-50 ml-2"
                        >
                          {sendingReminder === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Remind
                        </button>
                      )}
                    </td>
                  </TRow>
                ))}
              </tbody>
            </TableWrapper>
          )
        )}
      </div>
    </DashboardShell>
  );
}
