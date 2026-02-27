// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Payment Gateway Service
// ═══════════════════════════════════════════════════════════════
// Supports: Razorpay (default), Federal Bank (when credentials provided)
// Mode: PAYMENT_MODE=test|live
//
// Usage:
//   import { createOrder, verifyPayment, ... } from '@/lib/payment';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import crypto from 'crypto';

// ── Configuration ───────────────────────────────────────────

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'test';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const CALLBACK_URL = process.env.PAYMENT_CALLBACK_URL ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v1/payment/callback`;

// ── Currency helpers ────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'USD'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', AED: 'د.إ', SAR: '﷼', QAR: 'ر.ق',
  KWD: 'د.ك', OMR: 'ر.ع.', BHD: '.د.ب', USD: '$',
};

export function formatAmount(paise: number, currency: string = 'INR'): string {
  const amount = (paise / 100).toFixed(2);
  return `${CURRENCY_SYMBOLS[currency] || currency} ${amount}`;
}

// ── Invoice Number Generator ────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
  const result = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM invoices`
  );
  const count = parseInt(result.rows[0].cnt, 10) + 1;
  const prefix = 'INV';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `${prefix}-${year}${month}-${String(count).padStart(5, '0')}`;
}

export async function generateReceiptNumber(): Promise<string> {
  const result = await db.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM payment_receipts`
  );
  const count = parseInt(result.rows[0].cnt, 10) + 1;
  const prefix = 'RCT';
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `${prefix}-${year}${month}-${String(count).padStart(5, '0')}`;
}

// ── Create Invoice ──────────────────────────────────────────

export interface CreateInvoiceInput {
  studentEmail: string;
  parentEmail?: string;
  description?: string;
  billingPeriod?: string;
  periodStart: string;
  periodEnd: string;
  amountPaise: number;
  currency?: SupportedCurrency;
  dueDate: string;
}

export async function createInvoice(input: CreateInvoiceInput) {
  const invoiceNumber = await generateInvoiceNumber();
  const result = await db.query(
    `INSERT INTO invoices (
       invoice_number, student_email, parent_email, description,
       billing_period, period_start, period_end,
       amount_paise, currency, due_date, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
     RETURNING *`,
    [
      invoiceNumber, input.studentEmail, input.parentEmail || null,
      input.description || `Tuition fee for ${input.periodStart} to ${input.periodEnd}`,
      input.billingPeriod || 'monthly',
      input.periodStart, input.periodEnd,
      input.amountPaise, input.currency || 'INR', input.dueDate,
    ]
  );
  return result.rows[0];
}

// ── Create Payment Order ────────────────────────────────────

export interface CreateOrderInput {
  invoiceId: string;
  amountPaise: number;
  currency: string;
  studentEmail: string;
  studentName: string;
  description?: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  gatewayKeyId: string;
  callbackUrl: string;
  prefill: { name: string; email: string };
  mode: string;
}

export async function createPaymentOrder(input: CreateOrderInput): Promise<PaymentOrder> {
  // If Razorpay keys are set, create a real order
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && PAYMENT_MODE === 'live') {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.invoiceId,
        notes: { student_email: input.studentEmail },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Razorpay order creation failed: ${err}`);
    }

    const order = await response.json();

    // Store gateway order ID on invoice
    await db.query(
      `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
      [order.id, input.invoiceId]
    );

    return {
      orderId: order.id,
      amount: input.amountPaise,
      currency: input.currency,
      gatewayKeyId: RAZORPAY_KEY_ID,
      callbackUrl: CALLBACK_URL,
      prefill: { name: input.studentName, email: input.studentEmail },
      mode: 'live',
    };
  }

  // Test/mock mode — generate a mock order ID
  const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.query(
    `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
    [mockOrderId, input.invoiceId]
  );

  return {
    orderId: mockOrderId,
    amount: input.amountPaise,
    currency: input.currency,
    gatewayKeyId: RAZORPAY_KEY_ID || 'test_key',
    callbackUrl: CALLBACK_URL,
    prefill: { name: input.studentName, email: input.studentEmail },
    mode: 'test',
  };
}

// ── Verify Payment ──────────────────────────────────────────

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export function verifyRazorpaySignature(input: VerifyPaymentInput): boolean {
  if (!RAZORPAY_KEY_SECRET) return true; // test mode
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  return expectedSignature === input.signature;
}

// ── Complete Payment ────────────────────────────────────────

export async function completePayment(invoiceId: string, paymentId: string, paymentMethod?: string, gatewayResponse?: unknown) {
  const receiptNumber = await generateReceiptNumber();

  return db.withTransaction(async (client) => {
    // Update invoice
    const invResult = await client.query(
      `UPDATE invoices
       SET status = 'paid', paid_at = NOW(), transaction_id = $1, payment_method = $2
       WHERE id = $3
       RETURNING *`,
      [paymentId, paymentMethod || 'online', invoiceId]
    );

    const invoice = invResult.rows[0];
    if (!invoice) throw new Error('Invoice not found');

    // Create receipt
    await client.query(
      `INSERT INTO payment_receipts (
         receipt_number, invoice_id, student_email, amount_paise,
         currency, payment_method, transaction_id, gateway_response
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        receiptNumber, invoiceId, invoice.student_email,
        invoice.amount_paise, invoice.currency,
        paymentMethod || 'online', paymentId,
        JSON.stringify(gatewayResponse || {}),
      ]
    );

    // Update all pending room_assignments for this student to 'paid'
    await client.query(
      `UPDATE room_assignments SET payment_status = 'paid', payment_verified = true
       WHERE participant_email = $1 AND payment_status != 'paid'`,
      [invoice.student_email]
    );

    // Update session_payments for this invoice to 'paid'
    await client.query(
      `UPDATE session_payments SET status = 'paid'
       WHERE invoice_id = $1`,
      [invoiceId]
    );

    // Log payment event
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       SELECT ra.room_id, 'payment_completed', $1, $2::jsonb
       FROM room_assignments ra
       WHERE ra.participant_email = $1 AND ra.payment_status = 'paid'
       LIMIT 1`,
      [invoice.student_email, JSON.stringify({ invoice_id: invoiceId, amount: invoice.amount_paise })]
    );

    // Update the payment_attempts table too (legacy)
    await client.query(
      `INSERT INTO payment_attempts (room_id, student_email, order_id, amount_paise, status, transaction_id, raw_callback)
       SELECT ra.room_id, $1, $2, $3, 'completed', $4, $5::jsonb
       FROM room_assignments ra
       WHERE ra.participant_email = $1
       LIMIT 1`,
      [invoice.student_email, invoice.gateway_order_id, invoice.amount_paise, paymentId, JSON.stringify(gatewayResponse || {})]
    );

    return { invoice, receiptNumber };
  });
}

// ── Mock Payment (test mode) ────────────────────────────────

export async function mockCompletePayment(invoiceId: string) {
  const mockPaymentId = `mock_pay_${Date.now()}`;
  return completePayment(invoiceId, mockPaymentId, 'mock_gateway', { mock: true });
}

// ── Auto-flip overdue invoices ──────────────────────────────

export async function updateOverdueInvoices() {
  try {
    await db.query(
      `UPDATE invoices SET status = 'overdue', updated_at = NOW()
       WHERE status = 'pending' AND due_date < CURRENT_DATE`
    );
  } catch (err) {
    console.error('[payment] updateOverdueInvoices error:', err);
  }
}

// ── Get Invoices for Student ────────────────────────────────

export async function getStudentInvoices(studentEmail: string) {
  // Auto-flip pending invoices past due date to overdue
  await updateOverdueInvoices();
  const result = await db.query(
    `SELECT * FROM invoices
     WHERE student_email = $1
     ORDER BY created_at DESC`,
    [studentEmail]
  );
  return result.rows;
}

// ── Get Invoices for Parent ─────────────────────────────────

export async function getParentInvoices(parentEmail: string) {
  await updateOverdueInvoices();
  const result = await db.query(
    `SELECT i.* FROM invoices i
     WHERE i.parent_email = $1
        OR i.student_email IN (
          SELECT email FROM user_profiles WHERE parent_email = $1
        )
     ORDER BY i.created_at DESC`,
    [parentEmail]
  );
  return result.rows;
}

// ── Fee Structure CRUD ──────────────────────────────────────

export async function getFeeStructures() {
  const result = await db.query(
    `SELECT * FROM fee_structures WHERE is_active = true ORDER BY batch_type, grade`
  );
  return result.rows;
}

export async function createFeeStructure(input: {
  batchType: string;
  grade?: string;
  subject?: string;
  amountPaise: number;
  currency?: string;
  billingPeriod?: string;
  registrationFee?: number;
  securityDeposit?: number;
  createdBy: string;
}) {
  const result = await db.query(
    `INSERT INTO fee_structures (
       batch_type, grade, subject, amount_paise, currency,
       billing_period, registration_fee, security_deposit, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.batchType, input.grade || null, input.subject || null,
      input.amountPaise, input.currency || 'INR',
      input.billingPeriod || 'monthly',
      input.registrationFee || 0, input.securityDeposit || 0,
      input.createdBy,
    ]
  );
  return result.rows[0];
}

// 
// Session-Based Payment Helpers
// 

/**
 * Calculate session fee for a student joining a room.
 * Looks up session_fee_rates by batch/subject, calculates based on duration.
 */
export async function calculateSessionFee(roomId: string): Promise<{
  amountPaise: number;
  currency: string;
  perHourRate: number;
  durationMinutes: number;
} | null> {
  // First check if room has a pre-set session_fee_paise
  const roomResult = await db.query(
    `SELECT r.room_id, r.subject, r.grade, r.duration_minutes,
            r.session_fee_paise, r.payment_required, r.batch_id
     FROM rooms r
     WHERE r.room_id = $1`,
    [roomId]
  );
  if (roomResult.rows.length === 0) return null;

  const room = roomResult.rows[0] as Record<string, unknown>;
  const durationMinutes = Number(room.duration_minutes) || 60;

  // If room already has a session fee set, use it
  if (room.session_fee_paise && Number(room.session_fee_paise) > 0) {
    return {
      amountPaise: Number(room.session_fee_paise),
      currency: 'INR',
      perHourRate: Math.round(Number(room.session_fee_paise) / (durationMinutes / 60)),
      durationMinutes,
    };
  }

  // Look up rate from session_fee_rates table
  const batchId = room.batch_id as string | null;
  const subject = room.subject as string | null;
  const grade = room.grade as string | null;

  // Try: exact batch+subject match, then batch-only, then subject+grade, then subject-only
  const rateResult = await db.query(
    `SELECT per_hour_rate_paise, currency FROM session_fee_rates
     WHERE is_active = true
       AND (batch_id = $1 OR batch_id IS NULL)
       AND (subject = $2 OR subject IS NULL)
       AND (grade = $3 OR grade IS NULL)
     ORDER BY
       CASE WHEN batch_id = $1 AND subject = $2 THEN 0
            WHEN batch_id = $1 THEN 1
            WHEN subject = $2 AND grade = $3 THEN 2
            WHEN subject = $2 THEN 3
            ELSE 4 END
     LIMIT 1`,
    [batchId, subject, grade]
  );

  if (rateResult.rows.length === 0) return null;

  const rate = rateResult.rows[0] as Record<string, unknown>;
  const perHourRate = Number(rate.per_hour_rate_paise);
  const amountPaise = Math.round(perHourRate * (durationMinutes / 60));

  return {
    amountPaise,
    currency: (rate.currency as string) || 'INR',
    perHourRate,
    durationMinutes,
  };
}

/**
 * Check if a student has paid for a specific session.
 * Returns the payment record or null.
 */
export async function checkSessionPayment(roomId: string, studentEmail: string): Promise<{
  paid: boolean;
  invoiceId?: string;
  status?: string;
} > {
  const result = await db.query(
    `SELECT sp.status, sp.invoice_id
     FROM session_payments sp
     WHERE sp.room_id = $1 AND sp.student_email = $2
     LIMIT 1`,
    [roomId, studentEmail]
  );

  if (result.rows.length === 0) return { paid: false };

  const row = result.rows[0] as Record<string, unknown>;
  return {
    paid: row.status === 'paid',
    invoiceId: row.invoice_id as string | undefined,
    status: row.status as string,
  };
}

/**
 * Create a session-specific invoice and payment record.
 * Used when a student tries to join a session that requires payment.
 */
export async function createSessionInvoice(input: {
  roomId: string;
  roomName: string;
  subject: string;
  studentEmail: string;
  parentEmail?: string;
  amountPaise: number;
  currency: string;
  durationMinutes: number;
  scheduledStart: string;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const invoiceNumber = await generateInvoiceNumber();
  const sessionDate = new Date(input.scheduledStart);
  const periodStart = sessionDate.toISOString().split('T')[0];
  const periodEnd = periodStart; // single day

  return db.withTransaction(async (client) => {
    // Create invoice
    const invResult = await client.query(
      `INSERT INTO invoices (
         invoice_number, student_email, parent_email, description,
         billing_period, period_start, period_end,
         amount_paise, currency, due_date, status
       ) VALUES ($1,$2,$3,$4,'session',$5,$6,$7,$8,$5,'pending')
       RETURNING id`,
      [
        invoiceNumber,
        input.studentEmail,
        input.parentEmail || null,
        `Session fee: ${input.roomName} (${input.subject}) - ${input.durationMinutes}min on ${periodStart}`,
        periodStart, periodEnd,
        input.amountPaise,
        input.currency,
      ]
    );

    const invoiceId = (invResult.rows[0] as Record<string, unknown>).id as string;

    // Create session payment record
    await client.query(
      `INSERT INTO session_payments (room_id, student_email, parent_email, invoice_id, amount_paise, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (room_id, student_email) DO UPDATE SET
         invoice_id = EXCLUDED.invoice_id, amount_paise = EXCLUDED.amount_paise`,
      [input.roomId, input.studentEmail, input.parentEmail || null, invoiceId, input.amountPaise, input.currency]
    );

    // Update room_assignments with invoice reference
    await client.query(
      `UPDATE room_assignments SET session_invoice_id = $1, payment_verified = false
       WHERE room_id = $2 AND participant_email = $3`,
      [invoiceId, input.roomId, input.studentEmail]
    );

    return { invoiceId, invoiceNumber };
  });
}

/**
 * Mark a session payment as complete (called after Razorpay callback).
 */
export async function completeSessionPayment(invoiceId: string, paymentId: string, paymentMethod?: string) {
  return db.withTransaction(async (client) => {
    // Update invoice
    await client.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW(), transaction_id = $1, payment_method = $2
       WHERE id = $3`,
      [paymentId, paymentMethod || 'online', invoiceId]
    );

    // Update session_payments
    await client.query(
      `UPDATE session_payments SET status = 'paid', paid_at = NOW(), payment_method = $1, transaction_id = $2
       WHERE invoice_id = $3`,
      [paymentMethod || 'online', paymentId, invoiceId]
    );

    // Update room_assignments
    await client.query(
      `UPDATE room_assignments SET payment_verified = true, payment_status = 'paid'
       WHERE session_invoice_id = $1`,
      [invoiceId]
    );

    // Create receipt
    const receiptNumber = await generateReceiptNumber();
    const spResult = await client.query(
      `SELECT sp.*, i.amount_paise, i.currency FROM session_payments sp
       JOIN invoices i ON i.id = sp.invoice_id
       WHERE sp.invoice_id = $1 LIMIT 1`,
      [invoiceId]
    );
    if (spResult.rows.length > 0) {
      const sp = spResult.rows[0] as Record<string, unknown>;
      await client.query(
        `INSERT INTO payment_receipts (receipt_number, invoice_id, student_email, amount_paise, currency, payment_method, transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [receiptNumber, invoiceId, sp.student_email, sp.amount_paise, sp.currency, paymentMethod || 'online', paymentId]
      );
    }

    return { receiptNumber };
  });
}
