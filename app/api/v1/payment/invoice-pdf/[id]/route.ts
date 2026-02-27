import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/* ─── Currency symbols ─────────────────────────────────── */
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', AED: 'د.إ', SAR: 'ر.س', QAR: 'ر.ق',
  KWD: 'د.ك', OMR: 'ر.ع.', BHD: '.د.ب', USD: '$',
};
function fmtAmt(paise: number, currency = 'INR') {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${(paise / 100).toFixed(2)}`;
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  student_email: string;
  parent_email: string | null;
  description: string | null;
  billing_period: string;
  period_start: string;
  period_end: string;
  amount_paise: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
  student_name?: string;
  [key: string]: unknown;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Fetch invoice + student name
    const { rows } = await db.query<InvoiceRow>(
      `SELECT i.*, pu.full_name AS student_name
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       WHERE i.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }
    const inv = rows[0];

    // Authorization: parent/student can only see their own invoices
    const role = String(user.role);
    if (['parent', 'student'].includes(role)) {
      if (inv.student_email !== user.id && inv.parent_email !== user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch receipt if paid
    let receipt: { receipt_number: string; payment_method: string | null; transaction_id: string | null; created_at: string; [key: string]: unknown } | null = null;
    if (inv.status === 'paid') {
      const rRes = await db.query<{ receipt_number: string; payment_method: string | null; transaction_id: string | null; created_at: string; [key: string]: unknown }>(
        `SELECT * FROM payment_receipts WHERE invoice_id = $1 LIMIT 1`,
        [id]
      );
      if (rRes.rows.length > 0) receipt = rRes.rows[0];
    }

    const isPaid = inv.status === 'paid';
    const studentName = inv.student_name || inv.student_email;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${inv.invoice_number} – SmartUp Academy</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 14px; color: #1a1a1a; background: #f5f5f5; }
    .page { max-width: 800px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    @media print {
      body { background: #fff; }
      .page { margin: 0; box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header .subtitle { opacity: 0.85; font-size: 12px; margin-top: 4px; }
    .header .invoice-label { text-align: right; }
    .header .invoice-label .tag { font-size: 22px; font-weight: 600; }
    .header .invoice-label .number { font-size: 12px; opacity: 0.85; margin-top: 2px; }
    .body { padding: 32px 40px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .meta-box { }
    .meta-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; font-weight: 600; }
    .meta-box .value { font-size: 14px; color: #111; line-height: 1.5; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 10px 16px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    .items-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .items-table .amount { text-align: right; font-weight: 600; font-size: 15px; }
    .total-row { background: #f8fafc; }
    .total-row td { font-weight: 700; font-size: 16px; padding: 14px 16px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-overdue { background: #fecaca; color: #991b1b; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .detail-item { }
    .detail-item .dlabel { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; }
    .detail-item .dvalue { font-size: 13px; color: #374151; margin-top: 2px; }
    .footer { padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 11px; color: #9ca3af; }
    .print-bar { text-align: center; padding: 16px; background: #f8fafc; }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 10px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:5px; display:inline-flex; align-items:center; justify-content:center; line-height:0;">
          <img src="/logo/full.png" alt="SmartUp" height="40" style="width:auto; display:block; border-radius:6px;" />
        </div>
        <div>
          <h1>SmartUp Academy</h1>
          <div class="subtitle">Education Management System</div>
        </div>
      </div>
      <div class="invoice-label">
        <div class="tag">${isPaid ? 'RECEIPT' : 'INVOICE'}</div>
        <div class="number">${inv.invoice_number}</div>
      </div>
    </div>

    <div class="body">
      <div class="meta-grid">
        <div class="meta-box">
          <div class="label">Billed To</div>
          <div class="value">
            <strong>${esc(studentName)}</strong><br/>
            ${esc(inv.student_email)}
            ${inv.parent_email ? `<br/><span style="color:#6b7280;font-size:12px">Parent: ${esc(inv.parent_email)}</span>` : ''}
          </div>
        </div>
        <div class="meta-box" style="text-align:right">
          <div class="label">Invoice Details</div>
          <div class="value">
            Date: ${fmtDate(inv.created_at)}<br/>
            Due: ${fmtDate(inv.due_date)}<br/>
            Status: <span class="status-badge status-${inv.status}">${inv.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Period</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(inv.description || 'Tuition Fee')}</td>
            <td>${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}</td>
            <td class="amount">${fmtAmt(inv.amount_paise, inv.currency)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="2" style="text-align:right">Total</td>
            <td class="amount">${fmtAmt(inv.amount_paise, inv.currency)}</td>
          </tr>
        </tbody>
      </table>

      ${isPaid && receipt ? `
      <div class="details-grid">
        <div class="detail-item">
          <div class="dlabel">Receipt Number</div>
          <div class="dvalue">${esc(receipt.receipt_number)}</div>
        </div>
        <div class="detail-item">
          <div class="dlabel">Payment Date</div>
          <div class="dvalue">${fmtDate(inv.paid_at)}</div>
        </div>
        <div class="detail-item">
          <div class="dlabel">Payment Method</div>
          <div class="dvalue">${esc(inv.payment_method || receipt.payment_method || 'Online')}</div>
        </div>
        <div class="detail-item">
          <div class="dlabel">Transaction Reference</div>
          <div class="dvalue">${esc(inv.transaction_id || receipt.transaction_id || '—')}</div>
        </div>
      </div>` : ''}
    </div>

    <div class="footer">
      <p>This is a computer-generated document. No signature is required.</p>
      <p style="margin-top:4px">SmartUp Academy &bull; Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>

    <div class="print-bar no-print">
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    console.error('[invoice-pdf] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* ─── HTML escaper ─────────────────────────────────────── */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
