/**
 * Room Page - Main watching room component
 * Refactored to use custom hooks for better separation of concerns
 * Updated to use SFU-based calls for better scalability
 * Now supports YouTube video playback with queue management
 */
import { useState, useCallback, useEffect } from 'react';
import { useRoomStore, useIsHost } from '../stores/roomStore';
import { useYouTubeQueueStore } from '../stores/youtubeQueueStore';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { useTorrent } from '../hooks/useTorrent';
import { useSfuCall } from '../hooks/useSfuCall';
import { useVideoSync } from '../hooks/useVideoSync';
import { useYouTubeSync } from '../hooks/useYouTubeSync';
import { getSocket } from '../services/socket';
import { webtorrentService } from '../services/webtorrent';
import { RoomHeader } from '../components/room/RoomHeader';
import { VideoArea } from '../components/video/VideoArea';
import { ChatPanel } from '../components/chat/ChatPanel';
import { ShareModal } from '../components/room/ShareModal';
import { FileSelector } from '../components/video/FileSelector';
import { ScreenShareIndicator } from '../components/call/ScreenShareIndicator';
import type { TorrentFileInfo } from '../services/webtorrent';
import type { VideoSource, YouTubeMetadata, VideoQueueItem } from '@stream-party/shared';
import { useAuthStore } from '../stores/authStore';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

export function RoomPage() {
  const room = useRoomStore((state) => state.room);
  const isHost = useIsHost();
  const userId = useAuthStore((state) => state.userId);

  // YouTube queue store
  const {
    currentVideo,
    queue: videoQueue,
    isPlaying: isYouTubePlaying,
    currentTime: youTubeCurrentTime,
    videoId: youTubeVideoId,
    setCurrentVideo,
    addToQueue,
    removeFromQueue,
    vote,
    playNext,
    setIsPlaying,
    setCurrentTime,
    setVideoId,
    setQueue,
  } = useYouTubeQueueStore();

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [videoSource, setVideoSource] = useState<VideoSource>('torrent');

  // Video sync hook (for torrent/file playback)
  const { setPlayer, handlePlay, handlePause, handleSeeked } = useVideoSync({
    isHost,
  });

  // Torrent hook
  const {
    videoSrc,
    torrentFiles,
    showFileSelector,
    torrentActive,
    torrentLoading,
    torrentError,
    loadTorrent,
    handleFileSelect,
    closeFileSelector,
    clearTorrent,
  } = useTorrent({
    isHost,
  });

  // SFU Call hook
  const {
    inCall,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useSfuCall();

  // YouTube sync hook
  const {
    setPlayer: setYouTubePlayer,
    handlePlay: handleYouTubePlay,
    handlePause: handleYouTubePause,
    handleSeek: handleYouTubeSeek,
    handleSourceChange,
    addToQueue: addToYouTubeQueue,
    removeFromQueue: removeFromYouTubeQueue,
    voteSkip,
    requestSync,
    requestQueue,
  } = useYouTubeSync({
    isHost,
    onSourceChange: (newVideoId) => {
      if (newVideoId) {
        setVideoSource('youtube');
        setVideoId(newVideoId);
      } else {
        // Video ended, try to play next
        const next = playNext();
        if (!next) {
          setVideoSource('torrent');
        }
      }
    },
    onQueueChange: (newQueue) => {
      setQueue(newQueue);
    },
  });

  // Room connection hook with callbacks
  const { leaveRoom } = useRoomConnection({
    onMagnetChanged: (data) => {
      // Non-host: automatically load the torrent
      setVideoSource('torrent');
      loadTorrent(data.magnetUri, data.selectedFileIndex);
    },
    onFileSelected: (fileIndex) => {
      // If we have an active torrent, load the selected file
      if (webtorrentService.getCurrentTorrent()) {
        webtorrentService
          .getStreamUrl(fileIndex)
          .then((url) => {
            // Need to update videoSrc in torrent hook
            // For now, reload the torrent with the file index
          })
          .catch((err) => console.error('Failed to load file:', err));
      }
    },
  });

  // Handle host submitting a magnet link
  const handleMagnetSubmit = useCallback(
    (magnetUri: string) => {
      const socket = getSocket();
      socket.emit('room:set-magnet', { magnetUri });
      setVideoSource('torrent');
      loadTorrent(magnetUri, null);
    },
    [loadTorrent]
  );

  // Handle YouTube video submission
  const handleYouTubeSubmit = useCallback(
    (videoId: string, metadata: YouTubeMetadata) => {
      const queueItem: Omit<VideoQueueItem, 'position' | 'votes'> = {
        id: videoId,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
        channel: metadata.channel,
        addedBy: userId,
        addedAt: Date.now(),
      };

      // Add to local queue
      addToQueue({
        ...queueItem,
        position: videoQueue.length,
        votes: [],
      });

      // Emit to other participants
      addToYouTubeQueue(queueItem);

      // If no current video, set this as current
      if (!currentVideo) {
        setVideoSource('youtube');
        handleSourceChange(videoId);
      }
    },
    [userId, videoQueue.length, addToQueue, addToYouTubeQueue, currentVideo, handleSourceChange]
  );

  // Handle vote for skip
  const handleVote = useCallback(
    (videoId: string) => {
      vote(videoId, userId);
      voteSkip(videoId);
    },
    [userId, vote, voteSkip]
  );

  // Handle remove from queue
  const handleRemove = useCallback(
    (videoId: string) => {
      removeFromQueue(videoId);
      removeFromYouTubeQueue(videoId);
    },
    [removeFromQueue, removeFromYouTubeQueue]
  );

  // Handle video ended - play next in queue
  const handleVideoEnded = useCallback(() => {
    if (videoSource === 'youtube') {
      const next = playNext();
      if (next) {
        handleSourceChange(next.id);
      } else {
        // No more videos, switch back to torrent mode
        setVideoSource('torrent');
        handleSourceChange(null);
      }
    }
  }, [videoSource, playNext, handleSourceChange]);

  // Handle YouTube player time update
  const handleYouTubeTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
    },
    [setCurrentTime]
  );

  // Handle YouTube player state change
  const handleYouTubeStateChange = useCallback(
    (state: 'playing' | 'paused' | 'ended') => {
      if (state === 'playing') {
        setIsPlaying(true);
        if (isHost) {
          handleYouTubePlay();
        }
      } else if (state === 'paused') {
        setIsPlaying(false);
        if (isHost) {
          handleYouTubePause();
        }
      } else if (state === 'ended') {
        handleVideoEnded();
      }
    },
    [isHost, setIsPlaying, handleYouTubePlay, handleYouTubePause, handleVideoEnded]
  );

  // Request YouTube sync on mount
  useEffect(() => {
    if (room) {
      requestSync();
      requestQueue();
    }
  }, [room, requestSync, requestQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTorrent();
    };
  }, [clearTorrent]);

  // Loading state
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#333] border-t-[#7c3aed] rounded-full animate-spin" />
          <div className="text-[#a0a0a0]">Loading room...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f]">
      {/* Top Bar */}
      <RoomHeader
        roomName={room.name}
        roomCode={room.code}
        participantsCount={room.participants.length}
        participants={room.participants}
        hostId={room.hostId}
        inCall={inCall}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        onJoinCall={joinCall}
        onLeaveCall={leaveCall}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        onShare={() => setIsShareOpen(true)}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
      />

      {/* Screen Share Indicator */}
      {inCall && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <ScreenShareIndicator
            isLocalSharing={isScreenSharing}
            onStopScreenShare={stopScreenShare}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <VideoArea
          videoSrc={videoSrc}
          videoSource={videoSource}
          youtubeVideoId={youTubeVideoId}
          torrentLoading={torrentLoading}
          torrentError={torrentError}
          torrentActive={torrentActive}
          isHost={isHost}
          inCall={inCall}
          localStream={localStream}
          remoteStreams={remoteStreams}
          participants={room.participants}
          localAudioEnabled={audioEnabled}
          localVideoEnabled={videoEnabled}
          isPlaying={isYouTubePlaying}
          currentTime={youTubeCurrentTime}
          videoQueue={videoQueue}
          currentVideo={currentVideo}
          currentUserId={userId}
          onPlayerReady={setPlayer}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          onMagnetSubmit={handleMagnetSubmit}
          onYouTubeSubmit={handleYouTubeSubmit}
          onVote={handleVote}
          onRemove={handleRemove}
          onYouTubePlayerReady={setYouTubePlayer}
          onYouTubePlay={handleYouTubePlay}
          onYouTubePause={handleYouTubePause}
          onYouTubeSeek={handleYouTubeSeek}
          onYouTubeTimeUpdate={handleYouTubeTimeUpdate}
          onYouTubeStateChange={handleYouTubeStateChange}
        />

        {/* Chat Sidebar - Desktop: always visible when open, Tablet/Mobile: overlay */}
        {isChatOpen && (
          <>
            {/* Backdrop for mobile/tablet */}
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-30"
              onClick={() => setIsChatOpen(false)}
            />
            <div className="chat-sidebar">
              <ChatPanel onClose={() => setIsChatOpen(false)} />
            </div>
          </>
        )}

        {/* Chat Toggle Button (when closed on desktop) */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="hidden lg:block absolute top-4 right-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            Show Chat
          </button>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomCode={room.code}
      />

      {/* File Selector Modal */}
      {showFileSelector && (
        <FileSelector
          files={torrentFiles}
          onSelect={handleFileSelect}
          onClose={closeFileSelector}
        />
      )}
    </div>
  );
}
