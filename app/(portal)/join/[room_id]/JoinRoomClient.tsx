'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateShortIST, fmtTimeIST, cn } from '@/lib/utils';
import Script from 'next/script';
import {
  Video, Calendar, Clock, Users, CheckCircle2, AlertCircle,
  Loader2, Timer, CreditCard, Shield, Receipt,
} from 'lucide-react';

interface Props {
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  status: string;
  scheduledStart: string;
  durationMinutes: number;
  teacherEmail: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  emailToken: string | null;
  device: string;
}

interface PaymentInfo {
  paymentRequired: boolean;
  paid?: boolean;
  reason?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  amountFormatted?: string;
  currency?: string;
  perHourRate?: number;
  durationMinutes?: number;
  order?: {
    orderId: string;
    amount: number;
    currency: string;
    gatewayKeyId: string;
    callbackUrl: string;
    prefill: { name: string; email: string };
    mode: string;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
export default function JoinRoomClient({
  roomId, roomName, subject, grade, status,
  scheduledStart, durationMinutes, teacherEmail,
  userName, userEmail, userRole, emailToken, device,
}: Props) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => setMounted(true), []);

  const startDate = new Date(scheduledStart);
  const lobbyOpenTime = new Date(startDate.getTime() - 15 * 60 * 1000);
  const endTime = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const isLive = status === 'live';
  const isScheduled = status === 'scheduled';
  const isEnded = status === 'ended' || now > endTime;
  const lobbyOpen = now >= lobbyOpenTime;
  const canJoin = (isLive || (isScheduled && lobbyOpen)) && !isEnded;
  const msUntilLobby = lobbyOpenTime.getTime() - now.getTime();
  const msUntilStart = startDate.getTime() - now.getTime();

  const needsPaymentCheck = ['student', 'parent'].includes(userRole);
  const paymentResolved = !needsPaymentCheck || paymentComplete ||
    (paymentInfo !== null && !paymentInfo.paymentRequired);

  const needsTick = useCallback(() => {
    return mounted && !isEnded && !lobbyOpen;
  }, [mounted, isEnded, lobbyOpen]);

  useEffect(() => {
    if (!needsTick()) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Check payment on mount for students/parents
  useEffect(() => {
    if (!needsPaymentCheck || !mounted) return;
    checkPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, needsPaymentCheck]);

  async function checkPayment() {
    setCheckingPayment(true);
    try {
      const res = await fetch('/api/v1/payment/session-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentInfo(data.data);
        if (!data.data.paymentRequired || data.data.paid) {
          setPaymentComplete(true);
        }
      }
    } catch (err) {
      console.error('Payment check failed:', err);
      setPaymentComplete(true); // dont block on network error
    } finally {
      setCheckingPayment(false);
    }
  }

  async function handlePayment() {
    if (!paymentInfo?.order) return;
    setPaying(true);
    setError('');
    const order = paymentInfo.order;

    if (order.mode === 'test' || order.mode === 'mock') {
      try {
        const res = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: paymentInfo.invoiceId }),
        });
        const data = await res.json();
        if (data.success) { setPaymentComplete(true); }
        else { setError(data.error || 'Payment failed'); }
      } catch { setError('Payment failed - please try again'); }
      finally { setPaying(false); }
      return;
    }

    // Live Razorpay checkout
    if (!window.Razorpay) {
      setError('Payment gateway is loading. Please wait...');
      setPaying(false);
      return;
    }

    const options = {
      key: order.gatewayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'SmartUp Academy',
      description: `Session: ${roomName} (${subject})`,
      order_id: order.orderId,
      prefill: order.prefill,
      theme: { color: '#2563eb' },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const res = await fetch('/api/v1/payment/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const data = await res.json();
          if (data.success) { setPaymentComplete(true); }
          else { setError('Payment verification failed'); }
        } catch { setError('Payment verification failed'); }
        finally { setPaying(false); }
      },
      modal: { ondismiss: () => { setPaying(false); } },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  // Auto-poll for teacher
  const MAX_POLL = 60;
  useEffect(() => {
    if (!waitingForTeacher) return;
    if (pollCount >= MAX_POLL) {
      setWaitingForTeacher(false);
      setError('Teacher has not started the session yet. Please try again later.');
      return;
    }
    const id = setInterval(() => {
      if (!joining) { setPollCount((c) => c + 1); handleJoin(); }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForTeacher, pollCount, joining]);

  async function handleJoin() {
    if (needsPaymentCheck && !paymentResolved && paymentInfo?.paymentRequired) {
      handlePayment();
      return;
    }
    setJoining(true);
    setError('');
    try {
      const isScreenDevice = device === 'screen' || device === 'tablet';
      const res = await fetch('/api/v1/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          ...(isScreenDevice && userRole === 'teacher' ? { device: 'screen' } : {}),
          ...(emailToken ? { email_token: emailToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === 'CLASS_NOT_LIVE') {
          setWaitingForTeacher(true);
          setError('');
          return;
        }
        setError(data.error || 'Failed to join batch');
        return;
      }
      setWaitingForTeacher(false);
      const result = data.data;
      if (result?.livekit_token) {
        sessionStorage.setItem('lk_token', result.livekit_token);
        sessionStorage.setItem('lk_url', result.livekit_url || '');
        sessionStorage.setItem('room_name', result.room_name || roomId);
        sessionStorage.setItem('participant_role', result.role || userRole);
        sessionStorage.setItem('participant_name', result.participant_name || userName);
        sessionStorage.setItem('scheduled_start', result.scheduled_start || new Date().toISOString());
        sessionStorage.setItem('duration_minutes', String(result.duration_minutes || durationMinutes));
        sessionStorage.setItem('device', result.device || 'primary');
        sessionStorage.setItem('room_status', result.room_status || 'scheduled');
        sessionStorage.setItem('is_rejoin', result.is_rejoin ? 'true' : 'false');
        router.push(`/classroom/${roomId}`);
      } else { setError('No token received from server'); }
    } catch { setError('Network error - please try again'); }
    finally { setJoining(false); }
  }

  // Auto-join after payment completes
  useEffect(() => {
    if (paymentComplete && canJoin && !joining && paymentInfo?.paymentRequired) {
      const t = setTimeout(() => handleJoin(), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentComplete, canJoin]);
  return (
    <>
      {/* Razorpay checkout script (only loads in live mode) */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        strategy="lazyOnload"
      />

      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-br from-blue-600 to-blue-800 p-6 text-center">
            <Video className="mx-auto mb-3 h-10 w-10 text-white/80" />
            <h1 className="text-xl font-bold text-white">{roomName}</h1>
            <p className="text-sm text-blue-200">{subject} &middot; {grade}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Room info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <Calendar className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium" suppressHydrationWarning>
                  {mounted ? fmtDateShortIST(startDate) : '\u00A0'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium" suppressHydrationWarning>
                  {mounted ? `${fmtTimeIST(startDate)} \u00b7 ${durationMinutes}m` : '\u00A0'}
                </p>
              </div>
            </div>

            {teacherEmail && (
              <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Teacher assigned</span>
              </div>
            )}

            {/* User info */}
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail} &middot; {userRole}</p>
              </div>
            </div>

            {/* ===== PAYMENT GATE ===== */}
            {needsPaymentCheck && !paymentComplete && (
              <>
                {/* Checking payment */}
                {checkingPayment && (
                  <div className="flex items-center gap-3 rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-300">Checking payment status...</p>
                      <p className="text-xs text-blue-400/70">Verifying session fee requirements</p>
                    </div>
                  </div>
                )}

                {/* Payment required */}
                {!checkingPayment && paymentInfo?.paymentRequired && !paymentInfo.paid && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-900/40">
                          <CreditCard className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-300">Payment Required</p>
                          <p className="text-xs text-amber-400/80 mt-1">
                            Session fee must be paid before joining this session
                          </p>
                        </div>
                      </div>

                      {/* Fee details */}
                      <div className="mt-3 rounded-lg bg-card/60 p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Session</span>
                          <span className="font-medium">{roomName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subject</span>
                          <span className="font-medium">{subject}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-medium">{paymentInfo.durationMinutes || durationMinutes} min</span>
                        </div>
                        <div className="border-t border-border my-1" />
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground font-semibold">Amount</span>
                          <span className="text-lg font-bold text-amber-300">{paymentInfo.amountFormatted}</span>
                        </div>
                        {paymentInfo.invoiceNumber && (
                          <p className="text-[10px] text-muted-foreground text-right">Invoice: {paymentInfo.invoiceNumber}</p>
                        )}
                      </div>

                      {/* Pay button */}
                      <button
                        onClick={handlePayment}
                        disabled={paying}
                        className="mt-3 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {paying ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Processing Payment...</>
                        ) : (
                          <><CreditCard className="h-4 w-4" /> Pay {paymentInfo.amountFormatted}</>
                        )}
                      </button>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Secure payment via Razorpay. Your payment details are encrypted.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payment success banner */}
            {paymentComplete && paymentInfo?.paymentRequired && (
              <div className="flex items-center gap-3 rounded-lg border border-green-800/50 bg-green-950/20 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-300">Payment Successful!</p>
                  <p className="text-xs text-green-400/70">
                    {canJoin ? 'Joining session automatically...' : 'You can now join when the lobby opens'}
                  </p>
                </div>
                {canJoin && <Loader2 className="h-4 w-4 text-green-400 animate-spin ml-auto" />}
              </div>
            )}
            {/* Status banners */}
            {isLive && !isEnded && paymentResolved && (
              <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-950/30 p-3 text-green-400">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium">Session is Live &mdash; Join Now!</span>
              </div>
            )}

            {isScheduled && lobbyOpen && !isEnded && paymentResolved && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/30 p-3 text-blue-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Lobby is open &mdash; you can enter early</span>
              </div>
            )}

            {/* Early arrival countdown */}
            {isScheduled && !lobbyOpen && mounted && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-900/40">
                      <Timer className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-300">You&apos;re early!</p>
                      <p className="mt-1 text-xs text-amber-400/80">
                        This session is scheduled for{' '}
                        <span className="font-medium text-amber-300">{fmtTimeIST(startDate)}, {fmtDateShortIST(startDate)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-md bg-card/60 py-3" suppressHydrationWarning>
                    <Clock className="h-4 w-4 text-amber-400/70" />
                    <span className="text-sm text-foreground/80">
                      Lobby opens in <span className="font-mono font-bold text-amber-300">{fmtCountdown(msUntilLobby)}</span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-muted/50 px-2 py-1.5 text-center">
                      <span className="text-muted-foreground">Lobby opens</span>
                      <p className="font-medium text-foreground/80">{fmtTimeIST(lobbyOpenTime)}</p>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5 text-center">
                      <span className="text-muted-foreground">Session starts</span>
                      <p className="font-medium text-foreground/80">{fmtTimeIST(startDate)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    You can join the lobby <strong>15 minutes</strong> before the scheduled start time.
                  </p>
                </div>
              </div>
            )}

            {isEnded && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">This session has already ended</span>
              </div>
            )}

            {/* Waiting for teacher */}
            {waitingForTeacher && !isEnded && (
              <div className="space-y-3">
                <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900/40">
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-300">Waiting for teacher to start the session</p>
                      <p className="mt-1 text-xs text-blue-400/80">You&apos;ll be connected automatically once the session goes live.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5 py-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-400">{error}</div>
            )}

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={!canJoin || joining || isEnded || waitingForTeacher || (needsPaymentCheck && !paymentResolved)}
              className={cn(
                'w-full rounded-xl py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2',
                waitingForTeacher
                  ? 'bg-blue-900 text-blue-300 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground'
              )}
            >
              {waitingForTeacher ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Waiting for teacher...</>
              ) : joining ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
              ) : isEnded ? (
                'Session Ended'
              ) : needsPaymentCheck && !paymentResolved ? (
                <><CreditCard className="h-4 w-4" /> Pay to Join</>
              ) : !canJoin && mounted ? (
                <><Timer className="h-4 w-4" /> {msUntilStart > 86400000 ? `Session starts on ${fmtDateShortIST(startDate)}` : `Opens in ${fmtCountdown(msUntilLobby)}`}</>
              ) : !canJoin ? (
                'Lobby Not Open Yet'
              ) : (
                <><Video className="h-4 w-4" /> {isLive ? 'Join Live Session' : 'Enter Lobby'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}