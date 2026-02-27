// 
// Session Payment Check — POST /api/v1/payment/session-check
// Check if student needs to pay for a session, create invoice if needed
// 

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  calculateSessionFee,
  checkSessionPayment,
  createSessionInvoice,
  createPaymentOrder,
  formatAmount,
} from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { room_id } = await req.json();
    if (!room_id) {
      return NextResponse.json({ success: false, error: 'room_id required' }, { status: 400 });
    }

    // Only students and parents need to pay
    if (!['student', 'parent'].includes(user.role)) {
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, reason: 'Role exempt from payment' },
      });
    }

    // Check if session requires payment
    const fee = await calculateSessionFee(room_id);
    if (!fee || fee.amountPaise <= 0) {
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, reason: 'No fee configured for this session' },
      });
    }

    // Check if already paid
    const existing = await checkSessionPayment(room_id, user.id);
    if (existing.paid) {
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, paid: true, reason: 'Already paid' },
      });
    }

    // Get room info for invoice
    const roomResult = await db.query(
      `SELECT room_name, subject, scheduled_start, duration_minutes FROM rooms WHERE room_id = $1`,
      [room_id]
    );
    const room = roomResult.rows[0] as Record<string, unknown>;

    // Get parent email if student
    let parentEmail: string | undefined;
    if (user.role === 'student') {
      const profileResult = await db.query(
        `SELECT parent_email FROM user_profiles WHERE email = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        parentEmail = (profileResult.rows[0] as Record<string, unknown>).parent_email as string | undefined;
      }
    }

    // If they have a pending invoice already, reuse it
    if (existing.invoiceId && existing.status === 'pending') {
      // Create payment order for existing invoice
      const order = await createPaymentOrder({
        invoiceId: existing.invoiceId,
        amountPaise: fee.amountPaise,
        currency: fee.currency,
        studentEmail: user.id,
        studentName: user.name,
        description: `Session fee: ${room.room_name} (${room.subject})`,
      });

      return NextResponse.json({
        success: true,
        data: {
          paymentRequired: true,
          invoiceId: existing.invoiceId,
          amount: fee.amountPaise,
          amountFormatted: formatAmount(fee.amountPaise, fee.currency),
          currency: fee.currency,
          perHourRate: fee.perHourRate,
          durationMinutes: fee.durationMinutes,
          order,
        },
      });
    }

    // Create new session invoice
    const { invoiceId, invoiceNumber } = await createSessionInvoice({
      roomId: room_id,
      roomName: room.room_name as string,
      subject: room.subject as string,
      studentEmail: user.id,
      parentEmail,
      amountPaise: fee.amountPaise,
      currency: fee.currency,
      durationMinutes: fee.durationMinutes,
      scheduledStart: room.scheduled_start as string,
    });

    // Create payment order
    const order = await createPaymentOrder({
      invoiceId,
      amountPaise: fee.amountPaise,
      currency: fee.currency,
      studentEmail: user.id,
      studentName: user.name,
      description: `Session fee: ${room.room_name} (${room.subject})`,
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentRequired: true,
        invoiceId,
        invoiceNumber,
        amount: fee.amountPaise,
        amountFormatted: formatAmount(fee.amountPaise, fee.currency),
        currency: fee.currency,
        perHourRate: fee.perHourRate,
        durationMinutes: fee.durationMinutes,
        order,
      },
    });
  } catch (err) {
    console.error('[session-check] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
