'use client';

import { useState, useMemo } from 'react';
import {
  useRemoteParticipants,
  AudioTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, type RemoteParticipant } from 'livekit-client';
import VideoTile from './VideoTile';
import WhiteboardComposite from './WhiteboardComposite';
import { cn, fmtDateLongIST } from '@/lib/utils';

/**
 * GhostView — Silent observation view for ghost-eligible roles.
 * No media controls (canPublish: false). Read-only.
 * Shows teacher whiteboard/camera + student grid + private notes.
 */

export interface GhostViewProps {
  roomId: string;
  roomName: string;
  observerName: string;
  observerRole: string;
  onLeave: () => void;
}

export default function GhostView({
  roomId,
  roomName,
  observerName,
  observerRole,
  onLeave,
}: GhostViewProps) {
  const [notes, setNotes] = useState('');
  const [audioRoomEnabled, setAudioRoomEnabled] = useState(true);
  const remoteParticipants = useRemoteParticipants();

  // Find teacher
  const teacher = useMemo(() => {
    return remoteParticipants.find((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        return (meta.effective_role || meta.portal_role) === 'teacher';
      } catch {
        return p.identity.startsWith('teacher');
      }
    });
  }, [remoteParticipants]);

  // Students
  const students = useMemo(() => {
    return remoteParticipants.filter((p) => {
      try {
        const meta = JSON.parse(p.metadata || '{}');
        const role = meta.effective_role || meta.portal_role || '';
        return role === 'student';
      } catch {
        return p.identity.startsWith('student');
      }
    });
  }, [remoteParticipants]);

  // Screen share detection
  const teacherScreen = teacher?.getTrackPublication(Track.Source.ScreenShare);
  const hasScreenShare = !!teacherScreen && !teacherScreen.isMuted;
  const teacherCamera = teacher?.getTrackPublication(Track.Source.Camera);
  const hasTeacherCamera = !!teacherCamera && !teacherCamera.isMuted;

  // Download notes as .txt
  const downloadNotes = () => {
    const now = new Date();
    const content = `SmartUp Observation Notes
Room: ${roomName} (${roomId})
Observer: ${observerName} (${observerRole})
Date: ${fmtDateLongIST(now)}
──────────────────────────────────────────
${notes}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartup_notes_${roomId}_${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Ghost header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm">👻</span>
          <span className="text-sm font-medium text-white">{roomName}</span>
          <span className="text-xs text-gray-500">— Observing as {observerName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-xs text-green-400">
            👁 Invisible
          </span>
          <button
            onClick={() => setAudioRoomEnabled(!audioRoomEnabled)}
            className={cn(
              'rounded px-2 py-0.5 text-xs',
              audioRoomEnabled ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500'
            )}
          >
            {audioRoomEnabled ? '🔊 Audio On' : '🔇 Audio Off'}
          </button>
          <button
            onClick={onLeave}
            className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400 hover:text-white"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Main body: content + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Main content (65%) */}
        <div className="flex-[2] overflow-hidden p-2">
          {hasScreenShare && teacher ? (
            <WhiteboardComposite
              teacher={teacher}
              className="h-full w-full rounded-lg"
            />
          ) : hasTeacherCamera && teacher ? (
            <div className="flex h-full items-center justify-center">
              <VideoTile
                participant={teacher}
                size="large"
                showName={true}
                showMicIndicator={true}
                className="max-h-full max-w-full rounded-lg"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="mb-2 text-4xl">📚</div>
                <p>{teacher ? 'Audio only — no camera active' : 'Waiting for teacher...'}</p>
              </div>
            </div>
          )}

          {/* Teacher audio */}
          {audioRoomEnabled && teacher && teacher.getTrackPublication(Track.Source.Microphone)?.track && (
            <AudioTrack
              trackRef={{
                participant: teacher,
                publication: teacher.getTrackPublication(Track.Source.Microphone)!,
                source: Track.Source.Microphone,
              } as TrackReference}
            />
          )}
        </div>

        {/* Right: Sidebar (35%) */}
        <div className="flex w-[320px] flex-col border-l border-gray-800 overflow-y-auto">
          {/* Teacher card */}
          {teacher && (
            <div className="border-b border-gray-800 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Teacher</h3>
              <div className="flex items-center gap-2">
                <VideoTile
                  participant={teacher}
                  size="small"
                  showName={true}
                  showMicIndicator={true}
                />
              </div>
            </div>
          )}

          {/* Students grid */}
          <div className="border-b border-gray-800 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Students ({students.length}) · 📷{' '}
              {students.filter((s) => {
                const cam = s.getTrackPublication(Track.Source.Camera);
                return cam && !cam.isMuted;
              }).length}{' '}
              on
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {students.map((s) => (
                <VideoTile
                  key={s.identity}
                  participant={s}
                  size="small"
                  showName={true}
                  showMicIndicator={false}
                  className="w-full h-[70px]"
                />
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="border-b border-gray-800 p-3 text-xs text-gray-400 space-y-1">
            <p>Hands raised: {/* would track via data channel */}0</p>
            <p>Room: {roomId}</p>
          </div>

          {/* Private Notes */}
          <div className="flex-1 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Private Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 5000))}
              placeholder="Type notes here..."
              className="h-32 w-full rounded-lg bg-gray-800 p-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              maxLength={5000}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-gray-600">{notes.length}/5000</span>
              <button
                onClick={downloadNotes}
                disabled={!notes.trim()}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                💾 Download Notes (.txt)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
