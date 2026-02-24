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
      `UPDATE room_assignments SET payment_status = 'paid'
       WHERE participant_email = $1 AND payment_status IN ('unpaid', 'unknown')`,
      [invoice.student_email]
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
      `INSERT INTO payment_attempts (room_id, participant_email, order_id, amount_paise, status, transaction_id, raw_callback)
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

// ── Get Invoices for Student ────────────────────────────────

export async function getStudentInvoices(studentEmail: string) {
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
