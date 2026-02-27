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

    // Resolve student email and parent email
    // - student: studentEmail = user.id, parentEmail from user_profiles
    // - parent: find child enrolled in this room via user_profiles.parent_email
    let studentEmail = user.id;
    let parentEmail: string | undefined;

    if (user.role === 'parent') {
      const childResult = await db.query(
        `SELECT ra.participant_email
         FROM room_assignments ra
         JOIN user_profiles up ON up.email = ra.participant_email
         WHERE ra.room_id = $1
           AND ra.participant_type = 'student'
           AND up.parent_email = $2
         LIMIT 1`,
        [room_id, user.id]
      );
      if (childResult.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: { paymentRequired: false, reason: 'No child enrolled in this session' },
        });
      }
      studentEmail = (childResult.rows[0] as Record<string, unknown>).participant_email as string;
      parentEmail = user.id;
    } else {
      const profileResult = await db.query(
        `SELECT parent_email FROM user_profiles WHERE email = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        parentEmail = (profileResult.rows[0] as Record<string, unknown>).parent_email as string | undefined;
      }
    }

    // Check if already paid
    const existing = await checkSessionPayment(room_id, studentEmail);
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

    // If they have a pending invoice already, reuse it
    if (existing.invoiceId && existing.status === 'pending') {
      // Create payment order for existing invoice
      const order = await createPaymentOrder({
        invoiceId: existing.invoiceId,
        amountPaise: fee.amountPaise,
        currency: fee.currency,
        studentEmail,
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
      studentEmail,
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
      studentEmail,
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
