/**
 * Room Page - Main watching room component
 * Refactored to use custom hooks for better separation of concerns
 */
import { useState, useCallback, useEffect } from 'react';
import { useRoomStore, useIsHost } from '../stores/roomStore';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { useTorrent } from '../hooks/useTorrent';
import { useCall } from '../hooks/useCall';
import { useVideoSync } from '../hooks/useVideoSync';
import { getSocket } from '../services/socket';
import { webtorrentService } from '../services/webtorrent';
import { RoomHeader } from '../components/room/RoomHeader';
import { VideoArea } from '../components/video/VideoArea';
import { ChatPanel } from '../components/chat/ChatPanel';
import { ShareModal } from '../components/room/ShareModal';
import { FileSelector } from '../components/video/FileSelector';
import type { TorrentFileInfo } from '../services/webtorrent';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

export function RoomPage() {
  const room = useRoomStore((state) => state.room);
  const isHost = useIsHost();

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Video sync hook
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

  // Call hook
  const {
    inCall,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
  } = useCall();

  // Room connection hook with callbacks
  const { leaveRoom } = useRoomConnection({
    onMagnetChanged: (data) => {
      // Non-host: automatically load the torrent
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
      loadTorrent(magnetUri, null);
    },
    [loadTorrent]
  );

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
        onJoinCall={joinCall}
        onLeaveCall={leaveCall}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onShare={() => setIsShareOpen(true)}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <VideoArea
          videoSrc={videoSrc}
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
          onPlayerReady={setPlayer}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeeked}
          onMagnetSubmit={handleMagnetSubmit}
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
