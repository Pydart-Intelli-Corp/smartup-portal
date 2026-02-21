'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  VideoTrack,
  type TrackReference,
} from '@livekit/components-react';
import { Track, type RemoteTrackPublication, type RemoteParticipant, type Participant } from 'livekit-client';
import TeacherOverlay from './TeacherOverlay';
import { cn } from '@/lib/utils';

/**
 * WhiteboardComposite — Displays tablet screen share as the full whiteboard
 * background, with teacher's camera overlaid as a background-removed cutout.
 *
 * Two-device setup:
 *   - Screen share can come from the teacher_screen participant (tablet)
 *     OR from the teacher's primary participant (single-device screen share)
 *   - Camera track always comes from the primary teacher participant
 *
 * The composite renders:
 *   1. Screen share video → full area, object-fit: contain (never cropped)
 *   2. TeacherOverlay (MediaPipe) → draggable corner, transparent bg
 */

export interface WhiteboardCompositeProps {
  /** The primary teacher participant (laptop — camera + mic) */
  teacher: Participant;
  /** Optional: the teacher's screen device participant */
  teacherScreenDevice?: RemoteParticipant | null;
  /** Class name for sizing */
  className?: string;
}

export default function WhiteboardComposite({
  teacher,
  teacherScreenDevice,
  className,
}: WhiteboardCompositeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const teacherVideoRef = useRef<HTMLVideoElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Find screen share: prefer screen device, fallback to primary teacher
  const screenSource = teacherScreenDevice || teacher;
  const screenSharePub = screenSource.getTrackPublication(Track.Source.ScreenShare) as RemoteTrackPublication | undefined;

  // Camera track: always from primary teacher
  const cameraPub = teacher.getTrackPublication(Track.Source.Camera) as RemoteTrackPublication | undefined;
  const hasCameraTrack = !!cameraPub && !cameraPub.isMuted && !!cameraPub.track;

  // Measure container for overlay sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Capture a reference to the teacher's camera <video> element for MediaPipe
  const captureTeacherVideoRef = useCallback((node: HTMLVideoElement | null) => {
    teacherVideoRef.current = node;
  }, []);

  if (!screenSharePub || !screenSharePub.track) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-950', className)}>
        <div className="text-center">
          <div className="mb-2 text-3xl">🖥️</div>
          <p className="text-gray-500 text-sm">Waiting for teacher to share screen...</p>
          <p className="text-gray-600 text-xs mt-1">The whiteboard will appear when screen sharing starts</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-black', className)}>
      {/* Layer 1: Screen share track — fills the entire main area */}
      <VideoTrack
        trackRef={{
          participant: screenSource,
          publication: screenSharePub,
          source: Track.Source.ScreenShare,
        } as TrackReference}
        className="h-full w-full object-contain"
      />

      {/* Hidden video element: teacher's camera for MediaPipe input */}
      {hasCameraTrack && (
        <video
          ref={captureTeacherVideoRef}
          autoPlay
          playsInline
          muted
          className="sr-only"
          // The track will be attached by LiveKit when it subscribes
        />
      )}

      {/* Layer 2: Teacher overlay — AI background removed cutout (falls back to regular PIP) */}
      <TeacherOverlay
        active={hasCameraTrack}
        videoElement={teacherVideoRef.current}
        teacher={teacher}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
      />
    </div>
  );
}
