'use client';

import { useRef } from 'react';
import {
  VideoTrack,
  AudioTrack,
  useIsSpeaking,
  useTrackMutedIndicator,
  TrackReference,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { cn } from '@/lib/utils';

/**
 * VideoTile — Reusable participant video tile.
 * Used for teacher self-cam, student thumbnails, and participant previews.
 * Renders live video when camera is on, initials avatar when off.
 * Shows green border glow when participant is speaking.
 */

export interface VideoTileProps {
  participant: Participant;
  /** Tile size — affects dimensions */
  size?: 'small' | 'medium' | 'large';
  /** Mirror video (true for local self-view) */
  mirror?: boolean;
  /** Show name label at bottom */
  showName?: boolean;
  /** Show mic muted indicator on tile */
  showMicIndicator?: boolean;
  /** Show audio track (defaults to false for grid layouts) */
  playAudio?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

const SIZE_CLASSES: Record<string, string> = {
  small: 'w-[130px] h-[100px]',
  medium: 'w-[280px] h-[210px]',
  large: 'w-full h-full',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function VideoTile({
  participant,
  size = 'medium',
  mirror = false,
  showName = true,
  showMicIndicator = true,
  playAudio = false,
  className,
  onClick,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useIsSpeaking(participant);

  // Get camera track reference
  const cameraTrack = participant.getTrackPublication(Track.Source.Camera);
  const isCameraOn = !!cameraTrack && !cameraTrack.isMuted;
  const micTrack = participant.getTrackPublication(Track.Source.Microphone);
  const isMicOn = !!micTrack && !micTrack.isMuted;

  const displayName = participant.name || participant.identity;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-gray-800 border-2 transition-all duration-200',
        isSpeaking ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'border-gray-700',
        SIZE_CLASSES[size],
        onClick && 'cursor-pointer hover:border-gray-500',
        className
      )}
      onClick={onClick}
    >
      {/* Video track or avatar fallback */}
      {isCameraOn && cameraTrack?.track ? (
        <VideoTrack
          trackRef={{
            participant,
            publication: cameraTrack,
            source: Track.Source.Camera,
          } as TrackReference}
          className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-600 text-lg font-semibold text-white">
            {getInitials(displayName)}
          </div>
        </div>
      )}

      {/* Audio track (optionally played) */}
      {playAudio && micTrack?.track && (
        <AudioTrack
          trackRef={{
            participant,
            publication: micTrack,
            source: Track.Source.Microphone,
          } as TrackReference}
        />
      )}

      {/* Bottom overlay: name + mic indicator */}
      {(showName || showMicIndicator) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
          <div className="flex items-center gap-1.5">
            {showMicIndicator && (
              <span className="text-xs">
                {isMicOn ? (
                  <span className="text-green-400">🎤</span>
                ) : (
                  <span className="text-red-400">🔇</span>
                )}
              </span>
            )}
            {showName && (
              <span className="truncate text-xs font-medium text-white">
                {displayName}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
