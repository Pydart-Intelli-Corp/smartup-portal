// ═══════════════════════════════════════════════════════════════
// Student Fees Summary API — GET /api/v1/student/fees
//
// Aggregated fee overview for the logged-in student.
// Returns: total invoiced, total paid, balance, recent invoices,
// recent receipts.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { updateOverdueInvoices } from '@/lib/payment';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'student') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const email = user.id;

  // Auto-flip overdue invoices
  await updateOverdueInvoices();

  // Aggregate invoice stats
  const statsRes = await db.query(
    `SELECT
       COUNT(*)::int                                    AS total_invoices,
       COALESCE(SUM(amount_paise), 0)::bigint           AS total_invoiced_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::bigint    AS total_paid_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0)::bigint AS total_pending_paise,
       COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_count,
       COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid_count,
       COUNT(*) FILTER (WHERE status = 'overdue')::int  AS overdue_count
     FROM invoices
     WHERE student_email = $1`,
    [email]
  );

  const stats = statsRes.rows[0] as Record<string, unknown>;

  // Recent invoices (last 10)
  const invoicesRes = await db.query(
    `SELECT
       id, invoice_number, description, billing_period,
       period_start, period_end, amount_paise, currency,
       status, due_date, paid_at, created_at
     FROM invoices
     WHERE student_email = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [email]
  );

  // Recent receipts (last 10)
  const receiptsRes = await db.query(
    `SELECT
       pr.id, pr.receipt_number, pr.invoice_id,
       pr.amount_paise, pr.currency, pr.payment_method,
       pr.created_at,
       i.description AS invoice_description,
       i.billing_period
     FROM payment_receipts pr
     LEFT JOIN invoices i ON i.id = pr.invoice_id
     WHERE pr.student_email = $1
     ORDER BY pr.created_at DESC
     LIMIT 10`,
    [email]
  );

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        total_invoices: Number(stats.total_invoices ?? 0),
        total_invoiced_paise: Number(stats.total_invoiced_paise ?? 0),
        total_paid_paise: Number(stats.total_paid_paise ?? 0),
        total_pending_paise: Number(stats.total_pending_paise ?? 0),
        pending_count: Number(stats.pending_count ?? 0),
        paid_count: Number(stats.paid_count ?? 0),
        overdue_count: Number(stats.overdue_count ?? 0),
      },
      invoices: invoicesRes.rows,
      receipts: receiptsRes.rows,
    },
  });
}
