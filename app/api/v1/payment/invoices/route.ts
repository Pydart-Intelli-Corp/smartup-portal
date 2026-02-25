// ═══════════════════════════════════════════════════════════════
// Payment Invoices API — GET /api/v1/payment/invoices
// POST to create invoice (owner/coordinator only)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getStudentInvoices, getParentInvoices, createInvoice } from '@/lib/payment';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const studentEmail = url.searchParams.get('student_email');

    // Owner can fetch any student's invoices
    if (user.role === 'owner' && studentEmail) {
      const invoices = await getStudentInvoices(studentEmail);
      return NextResponse.json({ success: true, data: { invoices } });
    }

    // Student sees own invoices
    if (user.role === 'student') {
      const invoices = await getStudentInvoices(user.id);
      return NextResponse.json({ success: true, data: { invoices } });
    }

    // Parent sees child's invoices
    if (user.role === 'parent') {
      const invoices = await getParentInvoices(user.id);
      return NextResponse.json({ success: true, data: { invoices } });
    }

    // Coordinators / academic ops see all
    if (['batch_coordinator', 'academic_operator', 'hr'].includes(user.role)) {
      const { db } = await import('@/lib/db');
      const result = await db.query(
        `SELECT i.*, u.full_name AS student_name
         FROM invoices i
         LEFT JOIN portal_users u ON u.email = i.student_email
         ORDER BY i.created_at DESC LIMIT 200`
      );
      return NextResponse.json({ success: true, data: { invoices: result.rows } });
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  } catch (err) {
    console.error('[payment/invoices] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { student_email, parent_email, description, billing_period, period_start, period_end, amount_paise, currency, due_date } = body;

    if (!student_email || !period_start || !period_end || !amount_paise || !due_date) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const invoice = await createInvoice({
      studentEmail: student_email,
      parentEmail: parent_email,
      description,
      billingPeriod: billing_period,
      periodStart: period_start,
      periodEnd: period_end,
      amountPaise: amount_paise,
      currency,
      dueDate: due_date,
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    console.error('[payment/invoices] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
