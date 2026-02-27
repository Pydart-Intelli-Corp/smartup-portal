// ═══════════════════════════════════════════════════════════════
// Invoice/Receipt PDF API — GET /api/v1/payment/receipt/[id]
// Generates a printable HTML receipt/invoice page
// Can be printed from browser as PDF (Ctrl+P → Save as PDF)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { formatAmount } from '@/lib/payment';

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
    const type = new URL(req.url).searchParams.get('type') || 'invoice';

    if (type === 'receipt') {
      // Fetch receipt
      const receiptResult = await db.query(
        `SELECT pr.*, i.invoice_number, i.description, i.billing_period,
                i.period_start, i.period_end, i.due_date,
                pu.full_name AS student_name
         FROM payment_receipts pr
         JOIN invoices i ON i.id = pr.invoice_id
         LEFT JOIN portal_users pu ON pu.email = pr.student_email
         WHERE pr.id = $1`,
        [id]
      );

      if (receiptResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Receipt not found' }, { status: 404 });
      }

      const receipt = receiptResult.rows[0] as Record<string, unknown>;

      // Verify access
      if (user.role === 'student' && receipt.student_email !== user.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      const html = generateReceiptHTML(receipt);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT i.*, pu.full_name AS student_name
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       WHERE i.id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoiceResult.rows[0] as Record<string, unknown>;

    // Verify access
    if (user.role === 'student' && invoice.student_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (user.role === 'parent') {
      const childCheck = await db.query(
        `SELECT 1 FROM user_profiles WHERE user_email = $1 AND parent_email = $2`,
        [invoice.student_email, user.id]
      );
      if (childCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    const html = generateInvoiceHTML(invoice);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[payment/receipt] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function generateInvoiceHTML(invoice: Record<string, unknown>): string {
  const amount = formatAmount(Number(invoice.amount_paise || 0), String(invoice.currency || 'INR'));
  const status = String(invoice.status || 'pending').toUpperCase();
  const statusColor = status === 'PAID' ? '#22c55e' : status === 'OVERDUE' ? '#ef4444' : '#eab308';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
    .invoice { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #22c55e, #14b8a6); color: white; padding: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header .logo-text { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .invoice-number { text-align: right; }
    .invoice-number .label { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-number .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-top: 8px; background: rgba(255,255,255,0.2); }
    .body { padding: 32px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .meta-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .meta-section p { font-size: 14px; line-height: 1.6; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
    .table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .table .amount { text-align: right; font-weight: 600; }
    .total-row { background: #f8fafc; }
    .total-row td { font-size: 16px; font-weight: 700; padding: 16px; }
    .footer { padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
    .status-stamp { position: absolute; top: 50%; right: 40px; transform: rotate(-15deg) translateY(-50%); font-size: 48px; font-weight: 900; opacity: 0.08; letter-spacing: 4px; }
    .body-wrapper { position: relative; }
    @media print { body { padding: 0; background: white; } .invoice { box-shadow: none; border-radius: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#22c55e;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">
      🖨️ Print / Save as PDF
    </button>
  </div>
  <div class="invoice">
    <div class="header">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="/logo/full.png" alt="SmartUp" width="48" height="48" style="border-radius:10px;" />
        <div>
          <h1>SmartUp Learning</h1>
          <p class="logo-text">Online Education Platform</p>
        </div>
      </div>
      <div class="invoice-number">
        <div class="label">Invoice</div>
        <div class="value">${invoice.invoice_number || 'N/A'}</div>
        <div class="status-badge" style="color:${statusColor}">${status}</div>
      </div>
    </div>
    <div class="body-wrapper">
      <div class="status-stamp" style="color:${statusColor}">${status}</div>
      <div class="body">
        <div class="meta-grid">
          <div class="meta-section">
            <h3>Bill To</h3>
            <p><strong>${invoice.student_name || invoice.student_email}</strong></p>
            <p>${invoice.student_email}</p>
            ${invoice.parent_email ? `<p>Parent: ${invoice.parent_email}</p>` : ''}
          </div>
          <div class="meta-section" style="text-align:right;">
            <h3>Invoice Details</h3>
            <p>Date: ${new Date(String(invoice.created_at)).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p>Due: ${invoice.due_date ? new Date(String(invoice.due_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</p>
            <p>Period: ${invoice.period_start ? new Date(String(invoice.period_start)).toLocaleDateString('en-IN') : ''} - ${invoice.period_end ? new Date(String(invoice.period_end)).toLocaleDateString('en-IN') : ''}</p>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Period</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoice.description || 'Tuition Fee'}</td>
              <td>${invoice.billing_period || 'Monthly'}</td>
              <td class="amount">${amount}</td>
            </tr>
            <tr class="total-row">
              <td colspan="2">Total</td>
              <td class="amount">${amount}</td>
            </tr>
          </tbody>
        </table>
        ${invoice.status === 'paid' ? `<p style="color:#22c55e;font-weight:600;text-align:center;">✓ Payment received on ${invoice.paid_at ? new Date(String(invoice.paid_at)).toLocaleDateString('en-IN') : 'N/A'}</p>` : ''}
      </div>
    </div>
    <div class="footer">
      <p>SmartUp Learning Pvt Ltd · smartuplearning.online</p>
      <p style="margin-top:4px;">This is a computer-generated invoice. No signature required.</p>
    </div>
  </div>
</body>
</html>`;
}

function generateReceiptHTML(receipt: Record<string, unknown>): string {
  const amount = formatAmount(Number(receipt.amount_paise || 0), String(receipt.currency || 'INR'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${receipt.receipt_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
    .receipt { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #22c55e, #14b8a6); color: white; padding: 32px; text-align: center; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header .subtitle { font-size: 14px; opacity: 0.9; margin-top: 4px; }
    .body { padding: 32px; }
    .receipt-title { text-align: center; margin-bottom: 24px; }
    .receipt-title h2 { font-size: 20px; color: #22c55e; }
    .receipt-title .receipt-no { font-size: 14px; color: #64748b; margin-top: 4px; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .detail-row .label { color: #64748b; }
    .detail-row .value { font-weight: 600; }
    .amount-box { margin: 24px 0; padding: 20px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; text-align: center; }
    .amount-box .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .amount-box .amount { font-size: 32px; font-weight: 700; color: #22c55e; margin-top: 4px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
    .check-mark { font-size: 48px; margin-bottom: 8px; }
    @media print { body { padding: 0; background: white; } .receipt { box-shadow: none; border-radius: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#22c55e;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">
      🖨️ Print / Save as PDF
    </button>
  </div>
  <div class="receipt">
    <div class="header">
      <div style="display:flex;align-items:center;justify-content:center;gap:14px;">
        <img src="/logo/full.png" alt="SmartUp" width="48" height="48" style="border-radius:10px;" />
        <div>
          <h1>SmartUp Learning</h1>
          <p class="subtitle">Online Education Platform</p>
        </div>
      </div>
    </div>
    <div class="body">
      <div class="receipt-title">
        <div class="check-mark">✅</div>
        <h2>Payment Receipt</h2>
        <p class="receipt-no">${receipt.receipt_number}</p>
      </div>
      <div class="amount-box">
        <div class="label">Amount Paid</div>
        <div class="amount">${amount}</div>
      </div>
      <div class="detail-row">
        <span class="label">Student</span>
        <span class="value">${receipt.student_name || receipt.student_email}</span>
      </div>
      <div class="detail-row">
        <span class="label">Invoice</span>
        <span class="value">${receipt.invoice_number || 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Description</span>
        <span class="value">${receipt.description || 'Tuition Fee'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Payment Method</span>
        <span class="value">${String(receipt.payment_method || 'Online').replace('_', ' ')}</span>
      </div>
      <div class="detail-row">
        <span class="label">Transaction ID</span>
        <span class="value" style="font-family:monospace;font-size:12px;">${receipt.transaction_id || 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="label">Date</span>
        <span class="value">${new Date(String(receipt.created_at)).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="detail-row">
        <span class="label">Period</span>
        <span class="value">${receipt.period_start ? new Date(String(receipt.period_start)).toLocaleDateString('en-IN') : ''} - ${receipt.period_end ? new Date(String(receipt.period_end)).toLocaleDateString('en-IN') : ''}</span>
      </div>
    </div>
    <div class="footer">
      <p>SmartUp Learning Pvt Ltd · smartuplearning.online</p>
      <p style="margin-top:4px;">This is a computer-generated receipt. No signature required.</p>
    </div>
  </div>
</body>
</html>`;
}
