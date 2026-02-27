'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

/**
 * /classroom/[roomId]/ended — Class ended screen.
 * Shown after teacher ends the class, participant disconnects, or time expires.
 *
 * For STUDENTS: Shows mandatory attendance + teacher rating form.
 * For others: Shows class ended message + return to dashboard.
 */

const QUICK_TAGS = [
  { id: 'clear_teaching', label: '🎯 Clear Teaching' },
  { id: 'good_pace', label: '⏱ Good Pace' },
  { id: 'interactive', label: '💬 Interactive' },
  { id: 'helpful', label: '🙌 Helpful' },
  { id: 'too_fast', label: '⚡ Too Fast' },
  { id: 'too_slow', label: '🐢 Too Slow' },
  { id: 'need_more_practice', label: '📝 Need Practice' },
  { id: 'audio_issues', label: '🔊 Audio Issues' },
];

export default function ClassEndedPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [roomName, setRoomName] = useState<string>('');
  const [participantRole, setParticipantRole] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');

  const reason = searchParams.get('reason'); // 'expired' | null

  // Student post-session form state
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Read session data before clearing
    const name = sessionStorage.getItem('room_name');
    const role = sessionStorage.getItem('participant_role');
    const pName = sessionStorage.getItem('participant_name');
    if (name) setRoomName(name);
    if (role) setParticipantRole(role);
    if (pName) setParticipantName(pName);

    // Clear classroom session data (but keep role info for the form)
    sessionStorage.removeItem('lk_token');
    sessionStorage.removeItem('lk_url');
  }, []);

  // Determine dashboard URL based on role
  const getDashboardUrl = () => {
    if (!user) return '/login';
    const dashMap: Record<string, string> = {
      teacher: '/teacher',
      student: '/student',
      coordinator: '/coordinator',
      academic_operator: '/academic-operator',
      academic: '/academic-operator',
      hr: '/hr',
      parent: '/parent',
      owner: '/owner',
      ghost: '/ghost',
    };
    return dashMap[user.role] || '/';
  };

  const handleGoToDashboard = () => {
    // Clear remaining session data
    sessionStorage.removeItem('room_name');
    sessionStorage.removeItem('participant_role');
    sessionStorage.removeItem('participant_name');
    router.push(getDashboardUrl());
  };

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    if (!attendanceConfirmed || rating === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/room/${roomId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_email: user?.id || '',
          student_name: participantName || user?.name || '',
          rating,
          feedback_text: comment.trim(),
          tags: selectedTags.join(','),
          attendance_confirmed: true,
        }),
      });
      setSubmitted(true);
    } catch {
      // Best effort — still allow dashboard
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [roomId, user, participantName, attendanceConfirmed, rating, comment, selectedTags]);

  const isExpired = reason === 'expired';
  const isStudent = participantRole === 'student' || user?.role === 'student';
  const displayRating = hoverRating || rating;
  const canSubmit = attendanceConfirmed && rating > 0;

  // ── Student: feedback already submitted ──
  if (isStudent && submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#34a853]/10">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Thank You!</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            Your attendance has been recorded and feedback submitted.
          </p>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} className={`text-2xl ${s <= rating ? 'grayscale-0' : 'grayscale opacity-30'}`}>⭐</span>
            ))}
          </div>
          <button
            onClick={handleGoToDashboard}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Student: mandatory attendance + rating form ──
  if (isStudent && !submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{isExpired ? '⏰' : '📝'}</div>
            <h1 className="text-2xl font-bold text-white mb-1">Session Ended</h1>
            {roomName && <p className="text-sm text-muted-foreground">{roomName}</p>}
          </div>

          <div className="rounded-2xl bg-[#2d2e30] shadow-2xl ring-1 ring-white/10 overflow-hidden">

            {/* Step 1: Mandatory Attendance */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">📋</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">Confirm Your Attendance</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Please confirm that you attended this session. This is mandatory.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setAttendanceConfirmed(!attendanceConfirmed)}
                      className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                        attendanceConfirmed
                          ? 'bg-[#34a853] border-[#34a853]'
                          : 'border-[#5f6368] group-hover:border-[#8ab4f8]'
                      }`}
                    >
                      {attendanceConfirmed && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-[#e8eaed] font-medium">
                      I confirm that I attended this session
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 2: Mandatory Teacher Rating */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⭐</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Rate Your Teacher <span className="text-[#ea4335] text-xs">(Required)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    How was the teaching quality in this session?
                  </p>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <span className={`text-3xl transition-all ${star <= displayRating ? 'grayscale-0' : 'grayscale opacity-30'}`}>
                          ⭐
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Rating label */}
                  {displayRating > 0 && (
                    <p className="text-center text-xs text-foreground/80 mb-2">
                      {displayRating === 1 && 'Poor'}
                      {displayRating === 2 && 'Fair'}
                      {displayRating === 3 && 'Good'}
                      {displayRating === 4 && 'Very Good'}
                      {displayRating === 5 && 'Excellent!'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Optional Tags + Comment */}
            <div className="p-5 border-b border-white/10">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">💬</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Quick Feedback <span className="text-xs text-muted-foreground">(Optional)</span>
                  </h3>

                  {/* Quick Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          selectedTags.includes(tag.id)
                            ? 'bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30'
                            : 'bg-[#3c4043] text-muted-foreground hover:bg-[#4a4e52]'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Any additional comments?"
                    className="w-full rounded-xl bg-[#3c4043] px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                    rows={2}
                    maxLength={500}
                  />
                </div>
              </div>
            </div>

            {/* Validation message */}
            {!canSubmit && (
              <div className="px-5 py-3 bg-[#ea4335]/10 border-b border-[#ea4335]/20">
                <p className="text-xs text-[#ea4335] font-medium text-center">
                  {!attendanceConfirmed && !rating
                    ? '⚠ Please confirm attendance and rate your teacher to continue'
                    : !attendanceConfirmed
                    ? '⚠ Please confirm your attendance'
                    : '⚠ Please rate your teacher to continue'}
                </p>
              </div>
            )}

            {/* Submit button */}
            <div className="p-5">
              <button
                onClick={handleSubmitFeedback}
                disabled={!canSubmit || submitting}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                  canSubmit
                    ? 'bg-[#34a853] hover:bg-[#2d9148] text-white'
                    : 'bg-[#3c4043] text-[#5f6368] cursor-not-allowed'
                }`}
              >
                {submitting ? 'Submitting…' : 'Submit & Return to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Non-student: simple ended screen ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center">
        <div className="mb-5 text-5xl">{isExpired ? '⏰' : '✅'}</div>
        <h1 className="mb-2 text-2xl font-bold text-white">
          {isExpired ? 'Session Time Ended' : 'Session Ended'}
        </h1>
        {roomName && (
          <p className="mb-1 text-muted-foreground">{roomName}</p>
        )}
        <p className="mb-6 text-sm text-muted-foreground">
          {isExpired
            ? 'The scheduled session time has ended. All participants have been automatically disconnected.'
            : 'The session has ended. All participants have been disconnected.'}
        </p>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={handleGoToDashboard}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
