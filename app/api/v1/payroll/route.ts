// ═══════════════════════════════════════════════════════════════
// Payroll API — /api/v1/payroll
// Manage pay configs, periods, payslips
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  getAllPayConfigs, upsertPayConfig, getPayrollPeriods, createPayrollPeriod,
  generatePayslips, getPayslipsForPeriod, finalizePayroll, markPayrollPaid,
  getTeacherPayslips, getTeacherPayConfig,
} from '@/lib/payroll';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') || 'periods';

    // Teachers can only view their own payslips
    if (user.role === 'teacher') {
      const payslips = await getTeacherPayslips(user.id);
      const config = await getTeacherPayConfig(user.id);
      return NextResponse.json({ success: true, data: { payslips, config } });
    }

    if (!['owner', 'hr', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (resource === 'configs') {
      const configs = await getAllPayConfigs();
      return NextResponse.json({ success: true, data: { configs } });
    }

    if (resource === 'periods') {
      const periods = await getPayrollPeriods();
      return NextResponse.json({ success: true, data: { periods } });
    }

    if (resource === 'payslips') {
      const periodId = url.searchParams.get('periodId');
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const payslips = await getPayslipsForPeriod(periodId);
      return NextResponse.json({ success: true, data: { payslips } });
    }

    return NextResponse.json({ success: false, error: 'Invalid resource' }, { status: 400 });
  } catch (err) {
    console.error('[payroll] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Owner/HR only' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Set teacher pay config
    if (action === 'set_config') {
      const { teacherEmail, ratePerClass, incentiveRules } = body;
      if (!teacherEmail || !ratePerClass) {
        return NextResponse.json({ success: false, error: 'teacherEmail, ratePerClass required' }, { status: 400 });
      }
      const config = await upsertPayConfig(teacherEmail, ratePerClass, incentiveRules);
      return NextResponse.json({ success: true, data: config });
    }

    // Create payroll period
    if (action === 'create_period') {
      const { periodLabel, startDate, endDate } = body;
      if (!periodLabel || !startDate || !endDate) {
        return NextResponse.json({ success: false, error: 'periodLabel, startDate, endDate required' }, { status: 400 });
      }
      const period = await createPayrollPeriod(periodLabel, startDate, endDate);
      return NextResponse.json({ success: true, data: period });
    }

    // Generate payslips for a period
    if (action === 'generate') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const payslips = await generatePayslips(periodId);
      return NextResponse.json({ success: true, data: { payslips, count: payslips.length } });
    }

    // Finalize payroll
    if (action === 'finalize') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const result = await finalizePayroll(periodId);
      return NextResponse.json({ success: true, data: result });
    }

    // Mark as paid
    if (action === 'mark_paid') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const result = await markPayrollPaid(periodId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[payroll] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
