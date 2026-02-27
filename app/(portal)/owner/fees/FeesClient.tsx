// ═══════════════════════════════════════════════════════════════
// Fees & Invoices — Client Component
// Session-based fee model: per-session rates, not period billing
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
  CreditCard, Receipt, Plus,
  IndianRupee, Clock, AlertCircle, Download, ExternalLink,
  CheckCircle, Send, Loader2, Settings,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface SessionRate {
  id: string;
  batch_id: string | null;
  batch_name: string | null;
  subject: string | null;
  grade: string | null;
  per_hour_rate_paise: number;
  currency: string;
  is_active: boolean;
  notes: string | null;
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
  const [rates, setRates] = useState<SessionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Add session rate form state
  const [rSubject, setRSubject] = useState('');
  const [rGrade, setRGrade] = useState('');
  const [rRate, setRRate] = useState('');
  const [rCurrency, setRCurrency] = useState('INR');
  const [rNotes, setRNotes] = useState('');
  const [rateError, setRateError] = useState('');

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

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payment/session-rates');
      const json = await res.json();
      if (json.success) setRates(json.data?.rates || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchInvoices(); fetchRates(); }, [fetchInvoices, fetchRates]);

  const refresh = () => { fetchInvoices(); fetchRates(); };

  const createRate = async () => {
    if (!rRate) { setRateError('Per-hour rate is required'); return; }
    const rateNum = Number(rRate);
    if (isNaN(rateNum) || rateNum <= 0) { setRateError('Enter a valid positive rate'); return; }
    setRateError('');
    setActing(true);
    try {
      const res = await fetch('/api/v1/payment/session-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          per_hour_rate_paise: Math.round(rateNum * 100),
          currency: rCurrency,
          subject: rSubject || null,
          grade: rGrade || null,
          notes: rNotes || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRSubject(''); setRGrade(''); setRRate(''); setRNotes('');
        setTab('rates');
        toast.success('Session rate created');
        fetchRates();
      } else {
        toast.error(json.error || 'Failed to create rate');
      }
    } catch (e) { console.error(e); toast.error('Network error'); }
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
        <PageHeader icon={CreditCard} title="Fees & Invoices" subtitle="Per-session fee rates and payment tracking">
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
            { key: 'invoices', label: 'Session Invoices', icon: Receipt },
            { key: 'rates', label: 'Session Rates', icon: Settings },
            { key: 'add-rate', label: 'Add Rate', icon: Plus },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* Add Session Rate */}
        {tab === 'add-rate' && (
          <FormPanel title="Add Session Fee Rate" icon={Plus} onClose={() => setTab('rates')}>
            <p className="text-xs text-gray-500 mb-4">
              Set a per-hour rate for sessions. When a session runs for N minutes, the fee is calculated as
              <span className="font-medium text-gray-700"> rate × (duration / 60)</span>.
              Leave subject/grade blank to set a global default rate.
            </p>
            {rateError && <Alert variant="error" message={rateError} />}
            <FormGrid cols={3}>
              <FormField label="Per-Hour Rate (₹)">
                <Input
                  type="number"
                  value={rRate}
                  onChange={e => setRRate(e.target.value)}
                  placeholder="e.g. 500"
                />
              </FormField>
              <FormField label="Currency">
                <Select value={rCurrency} onChange={setRCurrency} options={[
                  { value: 'INR', label: '₹ INR' },
                  { value: 'USD', label: '$ USD' },
                ]} />
              </FormField>
              <FormField label="Subject (optional)">
                <Input value={rSubject} onChange={e => setRSubject(e.target.value)} placeholder="Mathematics" />
              </FormField>
              <FormField label="Grade (optional)">
                <Input value={rGrade} onChange={e => setRGrade(e.target.value)} placeholder="10th" />
              </FormField>
              <FormField label="Notes (optional)" className="col-span-2">
                <Input value={rNotes} onChange={e => setRNotes(e.target.value)} placeholder="e.g. Standard rate for 1-to-1 sessions" />
              </FormField>
            </FormGrid>
            <FormActions
              onCancel={() => setTab('rates')}
              onSubmit={createRate}
              submitLabel="Save Rate"
              submitDisabled={!rRate}
              submitting={acting}
            />
          </FormPanel>
        )}

        {/* Session Rates list */}
        {tab === 'rates' && (
          rates.length === 0 ? (
            <EmptyState icon={Settings} message="No session rates configured yet. Add a rate to enable session fee collection." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rates.map(r => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {r.subject ? r.subject : 'All Subjects'}
                      {r.grade ? ` — Grade ${r.grade}` : ''}
                    </h4>
                    <Badge label={r.is_active ? 'Active' : 'Inactive'} variant={r.is_active ? 'success' : 'default'} />
                  </div>
                  <p className="text-green-700 font-semibold text-sm mb-2">
                    {money(r.per_hour_rate_paise, r.currency)} / hour
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>{r.currency}</span>
                    {r.batch_name && <span>Batch: {r.batch_name}</span>}
                    {r.notes && <span className="truncate max-w-xs">{r.notes}</span>}
                    <span>{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Session Invoices */}
        {tab === 'invoices' && (
          loading ? (
            <LoadingState />
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} message="No session invoices found" />
          ) : (
            <TableWrapper footer={<><span>Showing {invoices.length} invoices</span><span>{invoices.filter(i => i.status === 'paid').length} paid</span></>}>
              <THead>
                <TH>Student</TH>
                <TH>Description</TH>
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
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{inv.description || '—'}</td>
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
