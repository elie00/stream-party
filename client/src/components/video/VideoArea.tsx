/**
 * Video area component with player, overlay, and status
 */
import { VideoPlayer } from './VideoPlayer';
import { CallOverlay } from '../call/CallOverlay';
import { TorrentStatus } from './TorrentStatus';
import { MagnetInput } from './MagnetInput';
import type Player from 'video.js/dist/types/player';
import type { RoomParticipant } from '@stream-party/shared';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

interface VideoAreaProps {
  videoSrc: string | null;
  torrentLoading: boolean;
  torrentError: string | null;
  torrentActive: boolean;
  isHost: boolean;
  inCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStreamInfo>;
  participants: RoomParticipant[];
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  onPlayerReady: (player: Player) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeeked: (time: number) => void;
  onMagnetSubmit: (magnetUri: string) => void;
}

export function VideoArea({
  videoSrc,
  torrentLoading,
  torrentError,
  torrentActive,
  isHost,
  inCall,
  localStream,
  remoteStreams,
  participants,
  localAudioEnabled,
  localVideoEnabled,
  onPlayerReady,
  onPlay,
  onPause,
  onSeeked,
  onMagnetSubmit,
}: VideoAreaProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Video Player or Placeholder */}
      <div className="flex-1 relative bg-black">
        {videoSrc ? (
          <VideoPlayer
            src={videoSrc}
            onReady={onPlayerReady}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={onSeeked}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              {torrentLoading ? (
                <>
                  <div className="w-10 h-10 border-2 border-[#333] border-t-[#7c3aed] rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-[#a0a0a0] text-sm">Loading torrent...</div>
                </>
              ) : torrentError ? (
                <>
                  <div className="text-red-400 text-lg mb-2">Error</div>
                  <div className="text-[#a0a0a0] text-sm max-w-md">{torrentError}</div>
                </>
              ) : (
                <>
                  <div className="text-[#a0a0a0] text-lg mb-2">No Video Loaded</div>
                  <div className="text-[#555] text-sm">
                    {isHost
                      ? 'Paste a magnet link below to start watching'
                      : 'Waiting for host to load a video'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Call Overlay - positioned over the video area */}
        {inCall && (
          <CallOverlay
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={participants}
            localAudioEnabled={localAudioEnabled}
            localVideoEnabled={localVideoEnabled}
          />
        )}
      </div>

      {/* Torrent Status Bar */}
      {torrentActive && <TorrentStatus />}

      {/* Magnet Input (host only) */}
      {isHost && (
        <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333]">
          <MagnetInput onSubmit={onMagnetSubmit} isLoading={torrentLoading} />
        </div>
      )}
    </div>
  );
}
