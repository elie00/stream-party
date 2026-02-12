/**
 * Video area component with player, overlay, and status
 * Supports both torrent/file playback and YouTube streaming
 * Updated with full YouTube integration and queue management
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { YouTubePlayer } from './YouTubePlayer';
import { YouTubeInput } from './YouTubeInput';
import { VideoQueue } from './VideoQueue';
import { CallOverlay } from '../call/CallOverlay';
import { TorrentStatus } from './TorrentStatus';
import { MagnetInput } from './MagnetInput';
import type Player from 'video.js/dist/types/player';
import type { RoomParticipant, VideoSource, VideoQueueItem, YouTubeMetadata } from '@stream-party/shared';
import type { YouTubePlayerAdapter } from '../../services/youTubeSyncEngine';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

interface VideoAreaProps {
  // Video source
  videoSrc: string | null;
  videoSource: VideoSource;
  youtubeVideoId: string | null;
  // Torrent state
  torrentLoading: boolean;
  torrentError: string | null;
  torrentActive: boolean;
  // Room state
  isHost: boolean;
  inCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStreamInfo>;
  participants: RoomParticipant[];
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  // YouTube queue
  videoQueue: VideoQueueItem[];
  currentVideo: VideoQueueItem | null;
  currentUserId: string;
  // Callbacks for torrent player
  onPlayerReady: (player: Player) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeeked: (time: number) => void;
  onMagnetSubmit: (magnetUri: string) => void;
  // Callbacks for YouTube
  onYouTubeSubmit?: (videoId: string, metadata: YouTubeMetadata) => void;
  onVote?: (videoId: string) => void;
  onRemove?: (videoId: string) => void;
  onYouTubePlayerReady?: (player: YouTubePlayerAdapter) => void;
  onYouTubePlay?: () => void;
  onYouTubePause?: () => void;
  onYouTubeSeek?: (time: number) => void;
  onYouTubeTimeUpdate?: (time: number) => void;
  onYouTubeStateChange?: (state: 'playing' | 'paused' | 'ended') => void;
}

type InputTab = 'torrent' | 'youtube';

export function VideoArea({
  videoSrc,
  videoSource,
  youtubeVideoId,
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
  isPlaying,
  currentTime,
  videoQueue,
  currentVideo,
  currentUserId,
  onPlayerReady,
  onPlay,
  onPause,
  onSeeked,
  onMagnetSubmit,
  onYouTubeSubmit,
  onVote,
  onRemove,
  onYouTubePlayerReady,
  onYouTubePlay,
  onYouTubePause,
  onYouTubeSeek,
  onYouTubeTimeUpdate,
  onYouTubeStateChange,
}: VideoAreaProps) {
  const [activeTab, setActiveTab] = useState<InputTab>(
    videoSource === 'youtube' ? 'youtube' : 'torrent'
  );
  const youTubePlayerRef = useRef<YouTubePlayerAdapter | null>(null);

  // Update active tab when video source changes
  useEffect(() => {
    if (videoSource === 'youtube') {
      setActiveTab('youtube');
    }
  }, [videoSource]);

  const handleYouTubeSubmit = useCallback((videoId: string, metadata: YouTubeMetadata) => {
    onYouTubeSubmit?.(videoId, metadata);
  }, [onYouTubeSubmit]);

  const handleVote = useCallback((videoId: string) => {
    onVote?.(videoId);
  }, [onVote]);

  const handleRemove = useCallback((videoId: string) => {
    onRemove?.(videoId);
  }, [onRemove]);

  // Handle YouTube player ready
  const handleYouTubePlayerReady = useCallback((player: YouTubePlayerAdapter) => {
    youTubePlayerRef.current = player;
    onYouTubePlayerReady?.(player);
  }, [onYouTubePlayerReady]);

  // Handle YouTube time update
  const handleYouTubeTimeUpdate = useCallback((time: number) => {
    onYouTubeTimeUpdate?.(time);
  }, [onYouTubeTimeUpdate]);

  // Handle YouTube state change
  const handleYouTubeStateChange = useCallback((state: 'playing' | 'paused' | 'ended') => {
    onYouTubeStateChange?.(state);
  }, [onYouTubeStateChange]);

  // Render the appropriate player based on video source
  const renderPlayer = () => {
    if (videoSource === 'youtube' && youtubeVideoId) {
      return (
        <YouTubePlayer
          videoId={youtubeVideoId}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onTimeUpdate={handleYouTubeTimeUpdate}
          onStateChange={handleYouTubeStateChange}
          onReady={handleYouTubePlayerReady}
        />
      );
    }

    if (videoSrc) {
      return (
        <VideoPlayer
          src={videoSrc}
          onReady={onPlayerReady}
          onPlay={onPlay}
          onPause={onPause}
          onSeeked={onSeeked}
        />
      );
    }

    return null;
  };

  // Render placeholder when no video
  const renderPlaceholder = () => {
    if (videoSrc || youtubeVideoId) return null;

    return (
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
                  ? 'Paste a magnet link or YouTube URL below to start watching'
                  : 'Waiting for host to load a video'}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Video Player or Placeholder */}
      <div className="flex-1 relative bg-black">
        {renderPlayer()}
        {renderPlaceholder()}

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
      {torrentActive && videoSource === 'torrent' && <TorrentStatus />}

      {/* Video Queue (for YouTube mode) */}
      {videoSource === 'youtube' && videoQueue.length > 0 && (
        <div className="px-4 py-2 bg-[#1a1a1a] border-t border-[#333]">
          <VideoQueue
            queue={videoQueue}
            currentVideo={currentVideo}
            currentUserId={currentUserId}
            onVote={handleVote}
            onRemove={handleRemove}
            isHost={isHost}
          />
        </div>
      )}

      {/* Input Area (host only) */}
      {isHost && (
        <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333]">
          {/* Tab Selector */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setActiveTab('torrent')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === 'torrent'
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-[#333] text-[#888] hover:bg-[#444] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Torrent / File
              </span>
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === 'youtube'
                  ? 'bg-[#ff0000] text-white'
                  : 'bg-[#333] text-[#888] hover:bg-[#444] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
                YouTube
                {videoSource === 'youtube' && youtubeVideoId && (
                  <span className="w-2 h-2 bg-green-500 rounded-full ml-1" />
                )}
              </span>
            </button>
          </div>

          {/* Input Content */}
          {activeTab === 'torrent' ? (
            <MagnetInput onSubmit={onMagnetSubmit} isLoading={torrentLoading} />
          ) : (
            <YouTubeInput onSubmit={handleYouTubeSubmit} isLoading={false} />
          )}
        </div>
      )}
    </div>
  );
}
