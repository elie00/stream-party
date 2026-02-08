import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore, useIsHost } from '../stores/roomStore';
import { getSocket, connectSocket } from '../services/socket';
import { syncEngine } from '../services/syncEngine';
import { webtorrentService } from '../services/webtorrent';
import { peerManager } from '../services/peerManager';
import type { TorrentFileInfo } from '../services/webtorrent';
import { useToastStore } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { VideoPlayer } from '../components/video/VideoPlayer';
import { MagnetInput } from '../components/video/MagnetInput';
import { FileSelector } from '../components/video/FileSelector';
import { TorrentStatus } from '../components/video/TorrentStatus';
import { ChatPanel } from '../components/chat/ChatPanel';
import { CallOverlay } from '../components/call/CallOverlay';
import { CallControls } from '../components/call/CallControls';
import { ShareModal } from '../components/room/ShareModal';
import { ParticipantList } from '../components/room/ParticipantList';
import { useChatStore } from '../stores/chatStore';
import type { RoomState, RoomParticipant, SyncState, ChatMessage } from '@stream-party/shared';
import type Player from 'video.js/dist/types/player';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

export function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    room,
    setRoom,
    clearRoom,
    setSyncState,
    addParticipant,
    removeParticipant,
    setHost,
    setMagnet,
    setFileIndex,
  } = useRoomStore();
  const isHost = useIsHost();
  const addToast = useToastStore((state) => state.addToast);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Chat store
  const { addMessage: addChatMessage, setHistory: setChatHistory, setTyping: setChatTyping, clearMessages: clearChatMessages } = useChatStore();

  // Video / torrent state
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [torrentFiles, setTorrentFiles] = useState<TorrentFileInfo[]>([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [torrentActive, setTorrentActive] = useState(false);
  const [torrentLoading, setTorrentLoading] = useState(false);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const playerRef = useRef<Player | null>(null);

  // Call state
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStreamInfo>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // ---------- Load a torrent and get a video stream URL ----------
  const loadTorrent = useCallback(
    async (magnetUri: string, fileIndex: number | null) => {
      setTorrentLoading(true);
      setTorrentError(null);
      setVideoSrc(null);
      setTorrentActive(false);

      try {
        await webtorrentService.addTorrent(magnetUri);
        setTorrentActive(true);

        const videoFiles = webtorrentService.getVideoFiles();

        if (videoFiles.length === 0) {
          setTorrentError('No video files found in this torrent.');
          setTorrentLoading(false);
          return;
        }

        // If fileIndex provided, use it directly
        if (fileIndex !== null) {
          const url = await webtorrentService.getStreamUrl(fileIndex);
          setVideoSrc(url);
          setTorrentLoading(false);
          return;
        }

        // Auto-select if only one video file
        if (videoFiles.length === 1) {
          const url = await webtorrentService.getStreamUrl(videoFiles[0].index);
          setVideoSrc(url);
          setTorrentLoading(false);

          // If host, notify server of file selection
          if (isHost) {
            const socket = getSocket();
            socket.emit('room:select-file', { fileIndex: videoFiles[0].index });
          }
          return;
        }

        // Multiple files: show selector (host) or wait for host selection (non-host)
        setTorrentFiles(videoFiles);
        if (isHost) {
          setShowFileSelector(true);
        }
        setTorrentLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load torrent';
        setTorrentError(message);
        addToast('Failed to load torrent', 'error');
        setTorrentLoading(false);
      }
    },
    [isHost, addToast],
  );

  // ---------- Handle host submitting a magnet link ----------
  const handleMagnetSubmit = useCallback(
    (magnetUri: string) => {
      const socket = getSocket();
      socket.emit('room:set-magnet', { magnetUri });
      loadTorrent(magnetUri, null);
    },
    [loadTorrent],
  );

  // ---------- Handle file selection from modal ----------
  const handleFileSelect = useCallback(
    async (fileIndex: number) => {
      setShowFileSelector(false);
      setTorrentLoading(true);

      try {
        const url = await webtorrentService.getStreamUrl(fileIndex);
        setVideoSrc(url);

        if (isHost) {
          const socket = getSocket();
          socket.emit('room:select-file', { fileIndex });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load file';
        setTorrentError(message);
        addToast(message, 'error');
      }

      setTorrentLoading(false);
    },
    [isHost, addToast],
  );

  // ---------- Player event callbacks ----------
  const handlePlayerReady = useCallback((player: Player) => {
    playerRef.current = player;
    syncEngine.setPlayer(player);
  }, []);

  // Keep SyncEngine in sync with host status
  useEffect(() => {
    syncEngine.setHost(isHost);
  }, [isHost]);

  const handlePlay = useCallback(() => {
    if (!isHost || syncEngine.isIgnoringEvents()) return;
    syncEngine.emitPlay();
  }, [isHost]);

  const handlePause = useCallback(() => {
    if (!isHost || syncEngine.isIgnoringEvents()) return;
    syncEngine.emitPause();
  }, [isHost]);

  const handleSeeked = useCallback(
    (time: number) => {
      if (!isHost || syncEngine.isIgnoringEvents()) return;
      syncEngine.emitSeek(time);
    },
    [isHost],
  );

  // ---------- Call handlers ----------
  const handleJoinCall = useCallback(async () => {
    try {
      const stream = await peerManager.getLocalStream();
      setLocalStream(stream);
      setInCall(true);
      setAudioEnabled(true);
      setVideoEnabled(true);

      const socket = getSocket();
      socket.emit('rtc:join-call');

      // Connect to all participants already in call
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom) {
        const myUserId = useAuthStore.getState().userId;
        currentRoom.participants.forEach((p) => {
          if (p.inCall && p.userId !== myUserId) {
            peerManager.createPeer(p.userId, true);
          }
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        addToast('Camera/microphone permission denied', 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to access camera/microphone';
        addToast(message, 'error');
      }
    }
  }, [addToast]);

  const handleLeaveCall = useCallback(() => {
    const socket = getSocket();
    socket.emit('rtc:leave-call');

    peerManager.destroyAll();
    setInCall(false);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setAudioEnabled(true);
    setVideoEnabled(true);
  }, []);

  const handleToggleAudio = useCallback(() => {
    const enabled = peerManager.toggleAudio();
    setAudioEnabled(enabled);
  }, []);

  const handleToggleVideo = useCallback(() => {
    const enabled = peerManager.toggleVideo();
    setVideoEnabled(enabled);
  }, []);

  // ---------- Set up peer manager callbacks ----------
  useEffect(() => {
    peerManager.setCallbacks(
      // onRemoteStream
      (userId, stream) => {
        if (stream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(userId, { stream, userId });
            return next;
          });
        }
      },
      // onRemoteStreamRemoved
      (userId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      },
    );
  }, []);

  // ---------- Socket listeners ----------
  useEffect(() => {
    // Ensure authenticated
    if (!isAuthenticated()) {
      addToast('Please log in first', 'error');
      navigate('/');
      return;
    }

    if (!code) {
      navigate('/');
      return;
    }

    // Connect socket
    const socket = getSocket();
    connectSocket();

    // Join room
    socket.emit('room:join', { code }, (res) => {
      if (!res.success) {
        addToast(res.error || 'Failed to join room', 'error');
        navigate('/');
        return;
      }
      // Late joiner: request current sync state from server
      syncEngine.requestSync();
      // Request chat history
      socket.emit('chat:history', {});
    });

    // ---- Room event handlers ----
    const handleRoomState = (roomState: RoomState) => {
      setRoom(roomState);
    };

    const handleUserJoined = (participant: RoomParticipant) => {
      addParticipant(participant);
      addToast(`${participant.displayName} joined the room`, 'info');
    };

    const handleUserLeft = (userId: string) => {
      const currentRoom = useRoomStore.getState().room;
      const participant = currentRoom?.participants.find((p) => p.userId === userId);
      if (participant) {
        addToast(`${participant.displayName} left the room`, 'info');
      }
      removeParticipant(userId);
    };

    const handleHostChanged = (hostId: string) => {
      setHost(hostId);
      addToast('Host changed', 'info');
    };

    const handleMagnetChanged = (data: { magnetUri: string; selectedFileIndex: number | null }) => {
      setMagnet(data.magnetUri, data.selectedFileIndex);
      // Non-host: automatically load the torrent
      loadTorrent(data.magnetUri, data.selectedFileIndex);
    };

    const handleFileSelected = (fileIndex: number) => {
      setFileIndex(fileIndex);
      // If we have an active torrent, load the selected file
      if (webtorrentService.getCurrentTorrent()) {
        setShowFileSelector(false);
        webtorrentService
          .getStreamUrl(fileIndex)
          .then((url) => setVideoSrc(url))
          .catch((err) => addToast(err.message || 'Failed to load file', 'error'));
      }
    };

    const handleSyncState = (state: SyncState) => {
      setSyncState(state);
      syncEngine.handleSyncState(state);
    };

    // Sync playback events from host via SyncEngine (with drift correction)
    const handleSyncPlay = (time: number) => {
      syncEngine.handlePlay(time);
    };

    const handleSyncPause = (time: number) => {
      syncEngine.handlePause(time);
    };

    const handleSyncSeek = (time: number) => {
      syncEngine.handleSeek(time);
    };

    const handleError = (message: string) => {
      addToast(message, 'error');
    };

    // ---- Chat event handlers ----
    const handleChatMessage = (message: ChatMessage) => {
      addChatMessage(message);
    };

    const handleChatHistory = (messages: ChatMessage[]) => {
      // If we already have messages, this is a "load more" prepend
      const currentMessages = useChatStore.getState().messages;
      setChatHistory(messages, currentMessages.length > 0);
    };

    const handleChatTyping = (data: { userId: string; isTyping: boolean }) => {
      // Look up display name from room participants
      const currentRoom = useRoomStore.getState().room;
      const participant = currentRoom?.participants.find((p) => p.userId === data.userId);
      setChatTyping(data.userId, participant?.displayName || 'Someone', data.isTyping);
    };

    // ---- RTC event handlers ----
    const handleRtcUserJoinedCall = (userId: string) => {
      // Update participant's inCall status in room store
      useRoomStore.setState((state) => {
        if (!state.room) return state;
        return {
          room: {
            ...state.room,
            participants: state.room.participants.map((p) =>
              p.userId === userId ? { ...p, inCall: true } : p,
            ),
          },
        };
      });
    };

    const handleRtcUserLeftCall = (userId: string) => {
      // Update participant's inCall status in room store
      useRoomStore.setState((state) => {
        if (!state.room) return state;
        return {
          room: {
            ...state.room,
            participants: state.room.participants.map((p) =>
              p.userId === userId ? { ...p, inCall: false } : p,
            ),
          },
        };
      });

      peerManager.handleUserLeftCall(userId);
    };

    const handleRtcOffer = (data: { from: string; signal: unknown }) => {
      peerManager.handleOffer(data.from, data.signal);
    };

    const handleRtcAnswer = (data: { from: string; signal: unknown }) => {
      peerManager.handleAnswer(data.from, data.signal);
    };

    const handleRtcIceCandidate = (data: { from: string; signal: unknown }) => {
      peerManager.handleIceCandidate(data.from, data.signal);
    };

    // Register listeners
    socket.on('room:state', handleRoomState);
    socket.on('room:user-joined', handleUserJoined);
    socket.on('room:user-left', handleUserLeft);
    socket.on('room:host-changed', handleHostChanged);
    socket.on('room:magnet-changed', handleMagnetChanged);
    socket.on('room:file-selected', handleFileSelected);
    socket.on('sync:state', handleSyncState);
    socket.on('sync:play', handleSyncPlay);
    socket.on('sync:pause', handleSyncPause);
    socket.on('sync:seek', handleSyncSeek);
    socket.on('error', handleError);
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:history', handleChatHistory);
    socket.on('chat:typing', handleChatTyping);
    socket.on('rtc:user-joined-call', handleRtcUserJoinedCall);
    socket.on('rtc:user-left-call', handleRtcUserLeftCall);
    socket.on('rtc:offer', handleRtcOffer);
    socket.on('rtc:answer', handleRtcAnswer);
    socket.on('rtc:ice-candidate', handleRtcIceCandidate);

    // Cleanup
    return () => {
      // Leave call if in one
      if (peerManager.getLocalStreamSync()) {
        socket.emit('rtc:leave-call');
        peerManager.destroyAll();
      }

      socket.emit('room:leave');
      socket.off('room:state', handleRoomState);
      socket.off('room:user-joined', handleUserJoined);
      socket.off('room:user-left', handleUserLeft);
      socket.off('room:host-changed', handleHostChanged);
      socket.off('room:magnet-changed', handleMagnetChanged);
      socket.off('room:file-selected', handleFileSelected);
      socket.off('sync:state', handleSyncState);
      socket.off('sync:play', handleSyncPlay);
      socket.off('sync:pause', handleSyncPause);
      socket.off('sync:seek', handleSyncSeek);
      socket.off('error', handleError);
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:history', handleChatHistory);
      socket.off('chat:typing', handleChatTyping);
      socket.off('rtc:user-joined-call', handleRtcUserJoinedCall);
      socket.off('rtc:user-left-call', handleRtcUserLeftCall);
      socket.off('rtc:offer', handleRtcOffer);
      socket.off('rtc:answer', handleRtcAnswer);
      socket.off('rtc:ice-candidate', handleRtcIceCandidate);
      syncEngine.destroy();
      clearRoom();
      clearChatMessages();
      webtorrentService.removeTorrent();
    };
  }, [code]);

  // ---------- Render ----------

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
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg md:text-xl font-semibold truncate">{room.name}</h1>
          <span className="text-xs md:text-sm text-[#a0a0a0] font-mono hidden sm:inline">{room.code}</span>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {/* Call Controls */}
          <CallControls
            inCall={inCall}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            onJoinCall={handleJoinCall}
            onLeaveCall={handleLeaveCall}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
          />

          {/* Participant Avatars */}
          <div className="hidden md:block">
            <ParticipantList
              participants={room.participants}
              hostId={room.hostId}
            />
          </div>

          {/* Mobile participant count */}
          <span className="md:hidden text-xs text-[#a0a0a0]">
            {room.participants.length}
            <svg className="w-4 h-4 inline ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>

          {/* Share Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            className="hidden sm:inline-flex"
          >
            {/* Share icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </Button>

          {/* Mobile share button (icon only) */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="sm:hidden p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            aria-label="Share room"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {/* Mobile chat toggle */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="lg:hidden p-2 bg-[#252525] hover:bg-[#333] text-white rounded-lg transition-colors relative"
            aria-label="Toggle chat"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video Player or Placeholder */}
          <div className="flex-1 relative bg-black">
            {videoSrc ? (
              <VideoPlayer
                src={videoSrc}
                onReady={handlePlayerReady}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
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
                participants={room.participants}
                localAudioEnabled={audioEnabled}
                localVideoEnabled={videoEnabled}
              />
            )}
          </div>

          {/* Torrent Status Bar */}
          {torrentActive && <TorrentStatus />}

          {/* Magnet Input (host only) */}
          {isHost && (
            <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333]">
              <MagnetInput onSubmit={handleMagnetSubmit} isLoading={torrentLoading} />
            </div>
          )}
        </div>

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
          onClose={() => setShowFileSelector(false)}
        />
      )}
    </div>
  );
}
