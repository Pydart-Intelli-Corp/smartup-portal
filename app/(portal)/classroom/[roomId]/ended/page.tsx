'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

/**
 * /classroom/[roomId]/ended — Class ended screen.
 * Shown after teacher ends the class or participant disconnects.
 * Displays summary and offers return to dashboard.
 */

export default function ClassEndedPage() {
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useSession();
  const [roomName, setRoomName] = useState<string>('');

  useEffect(() => {
    // Read room name from sessionStorage
    const name = sessionStorage.getItem('room_name');
    if (name) setRoomName(name);

    // Clear classroom session data
    sessionStorage.removeItem('lk_token');
    sessionStorage.removeItem('lk_url');
    sessionStorage.removeItem('room_name');
    sessionStorage.removeItem('participant_role');
    sessionStorage.removeItem('participant_name');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="max-w-md text-center">
        <div className="mb-5 text-5xl">✅</div>
        <h1 className="mb-2 text-2xl font-bold text-white">Class Ended</h1>
        {roomName && (
          <p className="mb-1 text-gray-400">{roomName}</p>
        )}
        <p className="mb-6 text-sm text-gray-500">
          The class session has ended. All participants have been disconnected.
        </p>

        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => router.push(getDashboardUrl())}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => router.push(`/join/${roomId}`)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Rejoin Room (if still active)
          </button>
        </div>
      </div>
    </div>
  );
}
