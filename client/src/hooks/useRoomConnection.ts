/**
 * Custom hook for managing room connection via Socket.IO
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { useChatStore } from '../stores/chatStore';
import { getSocket, connectSocket } from '../services/socket';
import { syncEngine } from '../services/syncEngine';
import { useToastStore } from '../components/ui/Toast';
import type { RoomState, RoomParticipant, SyncState, ChatMessage } from '@stream-party/shared';

interface UseRoomConnectionOptions {
  onMagnetChanged?: (data: { magnetUri: string; selectedFileIndex: number | null }) => void;
  onFileSelected?: (fileIndex: number) => void;
}

export function useRoomConnection(options: UseRoomConnectionOptions = {}) {
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
  const { addMessage, setHistory, setTyping, clearMessages } = useChatStore();
  const addToast = useToastStore((state) => state.addToast);
  
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Join room
  const joinRoom = useCallback(() => {
    if (!code || !isAuthenticated()) return;

    const socket = getSocket();
    connectSocket();

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
  }, [code, isAuthenticated, addToast, navigate]);

  // Leave room
  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:leave');
    syncEngine.destroy();
    clearRoom();
    clearMessages();
  }, [clearRoom, clearMessages]);

  // Set up socket listeners
  useEffect(() => {
    if (!isAuthenticated()) {
      addToast('Please log in first', 'error');
      navigate('/');
      return;
    }

    if (!code) {
      navigate('/');
      return;
    }

    const socket = getSocket();
    connectSocket();

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
      optionsRef.current.onMagnetChanged?.(data);
    };

    const handleFileSelected = (fileIndex: number) => {
      setFileIndex(fileIndex);
      optionsRef.current.onFileSelected?.(fileIndex);
    };

    const handleSyncState = (state: SyncState) => {
      setSyncState(state);
      syncEngine.handleSyncState(state);
    };

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
      addMessage(message);
    };

    const handleChatHistory = (messages: ChatMessage[]) => {
      const currentMessages = useChatStore.getState().messages;
      setHistory(messages, currentMessages.length > 0);
    };

    const handleChatTyping = (data: { userId: string; isTyping: boolean }) => {
      const currentRoom = useRoomStore.getState().room;
      const participant = currentRoom?.participants.find((p) => p.userId === data.userId);
      setTyping(data.userId, participant?.displayName || 'Someone', data.isTyping);
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

    // Join room
    joinRoom();

    // Cleanup
    return () => {
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
      leaveRoom();
    };
  }, [code]); // Only re-run if code changes

  return {
    room,
    joinRoom,
    leaveRoom,
  };
}
