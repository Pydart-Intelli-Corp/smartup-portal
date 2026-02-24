// ═══════════════════════════════════════════════════════════════
// Payment Callback — POST /api/v1/payment/callback
// Webhook from payment gateway after payment attempt
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRazorpaySignature, completePayment } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoice_id, mock } = body;

    // Mock mode for testing — directly complete the payment
    if (mock === true && process.env.PAYMENT_MODE !== 'live') {
      if (!invoice_id) {
        return NextResponse.json({ success: false, error: 'invoice_id required' }, { status: 400 });
      }
      const mockPaymentId = `mock_pay_${Date.now()}`;
      const result = await completePayment(invoice_id, mockPaymentId, 'mock_gateway', { mock: true });
      return NextResponse.json({ success: true, data: result });
    }

    // Live mode — verify Razorpay signature
    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json({ success: false, error: 'Missing payment details' }, { status: 400 });
    }

    // Verify signature
    const valid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature || '',
    });

    if (!valid) {
      console.error('[payment/callback] Invalid signature', { razorpay_order_id });
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
    }

    // Find invoice by gateway_order_id
    const inv = await db.query(
      `SELECT id FROM invoices WHERE gateway_order_id = $1`,
      [razorpay_order_id]
    );
    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found for this order' }, { status: 404 });
    }

    const invId = (inv.rows[0] as Record<string, unknown>).id as string;
    const result = await completePayment(invId, razorpay_payment_id, 'razorpay', body);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[payment/callback] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
