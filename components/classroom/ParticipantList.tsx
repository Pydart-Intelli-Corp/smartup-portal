'use client';

import { useState, useCallback } from 'react';
import {
  useParticipants,
  useDataChannel,
} from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * ParticipantList — Shows all room participants with role badges.
 * Teacher can locally mute/unmute each student's audio playback.
 * Ghost participants (hidden: true) are NOT shown.
 */

export interface ParticipantListProps {
  role: 'teacher' | 'student' | 'ghost';
  roomId: string;
  onClose?: () => void;
  className?: string;
  /** Set of student identities that are locally muted (teacher only) */
  mutedStudents?: Set<string>;
  /** Toggle local mute for a student (teacher only) */
  onToggleMute?: (identity: string) => void;
}

interface HandRaiseState {
  [identity: string]: boolean;
}

export default function ParticipantList({
  role,
  roomId,
  onClose,
  className,
  mutedStudents,
  onToggleMute,
}: ParticipantListProps) {
  const participants = useParticipants();
  const [handRaises, setHandRaises] = useState<HandRaiseState>({});
  const [confirmKick, setConfirmKick] = useState<string | null>(null);

  // Listen for hand raise data channel
  const onHandRaiseReceived = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.student_id && data.action) {
        setHandRaises((prev) => ({
          ...prev,
          [data.student_id]: data.action === 'raise',
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  useDataChannel('hand_raise', onHandRaiseReceived);

  // Determine role from metadata or identity
  const getParticipantRole = (p: Participant): string => {
    try {
      const meta = JSON.parse(p.metadata || '{}');
      return meta.effective_role || meta.portal_role || 'student';
    } catch {
      if (p.identity.startsWith('teacher')) return 'teacher';
      if (p.identity.startsWith('ghost')) return 'observer';
      return 'student';
    }
  };

  // Filter out ghost/hidden participants (they shouldn't appear anyway due to server enforcement)
  const visibleParticipants = participants.filter((p) => {
    const pRole = getParticipantRole(p);
    return !pRole.startsWith('ghost') && pRole !== 'observer';
  });

  // Sort: teacher first, then students alphabetically
  const sorted = [...visibleParticipants].sort((a, b) => {
    const aRole = getParticipantRole(a);
    const bRole = getParticipantRole(b);
    if (aRole === 'teacher' && bRole !== 'teacher') return -1;
    if (bRole === 'teacher' && aRole !== 'teacher') return 1;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  const handleKick = async (identity: string) => {
    try {
      await fetch(`/api/v1/room/participants/${identity}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      setConfirmKick(null);
    } catch (err) {
      console.error('Failed to kick participant:', err);
    }
  };

  return (
    <div className={cn('flex h-full flex-col bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          Participants ({sorted.length})
        </span>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        )}
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {sorted.map((p) => {
          const pRole = getParticipantRole(p);
          const displayName = p.name || p.identity;
          const isRaised = handRaises[p.identity];
          const isStudent = pRole === 'student';
          const isMuted = isStudent && mutedStudents?.has(p.identity);

          return (
            <div
              key={p.identity}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              {/* Name + role badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-foreground">{displayName}</span>
                  <RoleBadge role={pRole} />
                  {isRaised && <span className="text-yellow-400 text-xs">🖐</span>}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                {/* Local mute/unmute button (teacher only, students only) */}
                {role === 'teacher' && isStudent && onToggleMute && (
                  <button
                    onClick={() => onToggleMute(p.identity)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors',
                      isMuted
                        ? 'bg-[#34a853]/15 text-[#34a853] hover:bg-[#34a853]/25'
                        : 'bg-[#ea4335]/15 text-[#ea4335] hover:bg-[#ea4335]/25',
                    )}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                )}

                {/* Teacher-only kick control */}
                {role === 'teacher' && pRole !== 'teacher' && (
                  <button
                    onClick={() => setConfirmKick(p.identity)}
                    className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-muted"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Kick confirmation */}
              {confirmKick === p.identity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                  <div className="rounded-xl bg-muted p-5 text-center shadow-xl">
                    <p className="mb-4 text-sm text-foreground">
                      Remove <strong>{displayName}</strong> from the class?
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => setConfirmKick(null)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-sm text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleKick(p.identity)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    teacher: 'bg-emerald-600',
    student: 'bg-blue-600',
    observer: 'bg-purple-600',
    coordinator: 'bg-indigo-600',
    academic: 'bg-teal-600',
    parent: 'bg-orange-600',
    owner: 'bg-purple-600',
  };
  return (
    <span
      className={cn(
        'rounded px-1 py-0.5 text-[9px] font-bold uppercase text-white',
        colors[role] || 'bg-muted'
      )}
    >
      {role}
    </span>
  );
}
