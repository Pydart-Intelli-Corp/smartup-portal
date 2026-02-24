import { Metadata } from 'next';
import ClassroomWrapper from '@/components/classroom/ClassroomWrapper';

/**
 * /classroom/[roomId] — Main classroom page.
 * Mounts ClassroomWrapper which reads sessionStorage for LiveKit token
 * and renders role-based view (Teacher/Student/Ghost).
 *
 * Full screen, no scroll, dark background.
 */

export const metadata: Metadata = {
  title: 'SmartUp Classroom',
};

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <ClassroomWrapper roomId={roomId} />
    </div>
  );
}
