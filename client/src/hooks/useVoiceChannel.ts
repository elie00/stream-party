/**
 * Voice Channel Hook
 * Manages voice channel state and push-to-talk functionality
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { logger } from '../utils/logger';

// Types
export interface VoiceChannel {
  id: string;
  roomId: string;
  name: string;
  position: number;
  bitrate: number;
  createdAt: Date;
}

export interface VoiceParticipant {
  channelId: string;
  userId: string;
  displayName: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isPushingToTalk: boolean;
  joinedAt: Date;
}

export interface VoiceChannelWithParticipants {
  channel: VoiceChannel;
  participants: VoiceParticipant[];
}

interface UseVoiceChannelOptions {
  pttKey?: string; // Default: 'Space'
  onJoin?: (channel: VoiceChannelWithParticipants) => void;
  onLeave?: (channelId: string) => void;
  onError?: (message: string) => void;
}

interface UseVoiceChannelReturn {
  // State
  channels: VoiceChannelWithParticipants[];
  currentChannel: VoiceChannel | null;
  participants: VoiceParticipant[];
  isInVoice: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isPushingToTalk: boolean;
  speakingUsers: Set<string>;
  
  // Actions
  getChannels: () => void;
  createChannel: (name: string, bitrate?: number) => void;
  deleteChannel: (channelId: string) => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
}

type AnySocket = {
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
};

export function useVoiceChannel(options: UseVoiceChannelOptions = {}): UseVoiceChannelReturn {
  const {
    pttKey = 'Space',
    onJoin,
    onLeave,
    onError,
  } = options;

  // State
  const [channels, setChannels] = useState<VoiceChannelWithParticipants[]>([]);
  const [currentChannel, setCurrentChannel] = useState<VoiceChannel | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPushingToTalk, setIsPushingToTalk] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // Refs
  const pttActiveRef = useRef(false);
  const socketRef = useRef<AnySocket | null>(null);

  // Get socket reference
  useEffect(() => {
    socketRef.current = getSocket() as unknown as AnySocket;
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Voice channels list
    const handleChannels = (data: VoiceChannelWithParticipants[]) => {
      setChannels(data);
    };

    // Channel created
    const handleChannelCreated = (data: { channel: VoiceChannel }) => {
      setChannels(prev => [...prev, { channel: data.channel, participants: [] }]);
    };

    // Channel deleted
    const handleChannelDeleted = (data: { channelId: string }) => {
      setChannels(prev => prev.filter(c => c.channel.id !== data.channelId));
      
      if (currentChannel?.id === data.channelId) {
        setCurrentChannel(null);
        setParticipants([]);
        setIsInVoice(false);
      }
    };

    // Joined channel
    const handleJoined = (data: VoiceChannelWithParticipants) => {
      setCurrentChannel(data.channel);
      setParticipants(data.participants);
      setIsInVoice(true);
      setIsMuted(true);
      setIsPushingToTalk(false);
      onJoin?.(data);
    };

    // User joined
    const handleUserJoined = (data: { channelId: string; participant: VoiceParticipant }) => {
      setChannels(prev => prev.map(c => {
        if (c.channel.id === data.channelId) {
          const exists = c.participants.some(p => p.userId === data.participant.userId);
          if (exists) return c;
          return {
            ...c,
            participants: [...c.participants, data.participant],
          };
        }
        return c;
      }));

      if (currentChannel?.id === data.channelId) {
        setParticipants(prev => {
          const exists = prev.some(p => p.userId === data.participant.userId);
          if (exists) return prev;
          return [...prev, data.participant];
        });
      }
    };

    // User left
    const handleUserLeft = (data: { channelId: string; userId: string }) => {
      setChannels(prev => prev.map(c => {
        if (c.channel.id === data.channelId) {
          return {
            ...c,
            participants: c.participants.filter(p => p.userId !== data.userId),
          };
        }
        return c;
      }));

      if (currentChannel?.id === data.channelId) {
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      }

      onLeave?.(data.channelId);
    };

    // User speaking
    const handleUserSpeaking = (data: { channelId: string; userId: string; isSpeaking: boolean }) => {
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        if (data.isSpeaking) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });

      // Update participant state
      setChannels(prev => prev.map(c => {
        if (c.channel.id === data.channelId) {
          return {
            ...c,
            participants: c.participants.map(p => 
              p.userId === data.userId 
                ? { ...p, isPushingToTalk: data.isSpeaking }
                : p
            ),
          };
        }
        return c;
      }));

      if (currentChannel?.id === data.channelId) {
        setParticipants(prev => prev.map(p => 
          p.userId === data.userId 
            ? { ...p, isPushingToTalk: data.isSpeaking }
            : p
        ));
      }
    };

    // User muted
    const handleUserMuted = (data: { channelId: string; userId: string; isMuted: boolean }) => {
      setChannels(prev => prev.map(c => {
        if (c.channel.id === data.channelId) {
          return {
            ...c,
            participants: c.participants.map(p => 
              p.userId === data.userId 
                ? { ...p, isMuted: data.isMuted }
                : p
            ),
          };
        }
        return c;
      }));

      if (currentChannel?.id === data.channelId) {
        setParticipants(prev => prev.map(p => 
          p.userId === data.userId 
            ? { ...p, isMuted: data.isMuted }
            : p
        ));
      }
    };

    // User deafened
    const handleUserDeafened = (data: { channelId: string; userId: string; isDeafened: boolean }) => {
      setChannels(prev => prev.map(c => {
        if (c.channel.id === data.channelId) {
          return {
            ...c,
            participants: c.participants.map(p => 
              p.userId === data.userId 
                ? { ...p, isDeafened: data.isDeafened }
                : p
            ),
          };
        }
        return c;
      }));

      if (currentChannel?.id === data.channelId) {
        setParticipants(prev => prev.map(p => 
          p.userId === data.userId 
            ? { ...p, isDeafened: data.isDeafened }
            : p
        ));
      }
    };

    // Error
    const handleError = (data: { message: string }) => {
      logger.error('Voice channel error', { message: data.message });
      onError?.(data.message);
    };

    // Register listeners
    socket.on('voice:channels', handleChannels);
    socket.on('voice:channel-created', handleChannelCreated);
    socket.on('voice:channel-deleted', handleChannelDeleted);
    socket.on('voice:joined', handleJoined);
    socket.on('voice:user-joined', handleUserJoined);
    socket.on('voice:user-left', handleUserLeft);
    socket.on('voice:user-speaking', handleUserSpeaking);
    socket.on('voice:user-muted', handleUserMuted);
    socket.on('voice:user-deafened', handleUserDeafened);
    socket.on('voice:error', handleError);

    return () => {
      socket.off('voice:channels', handleChannels);
      socket.off('voice:channel-created', handleChannelCreated);
      socket.off('voice:channel-deleted', handleChannelDeleted);
      socket.off('voice:joined', handleJoined);
      socket.off('voice:user-joined', handleUserJoined);
      socket.off('voice:user-left', handleUserLeft);
      socket.off('voice:user-speaking', handleUserSpeaking);
      socket.off('voice:user-muted', handleUserMuted);
      socket.off('voice:user-deafened', handleUserDeafened);
      socket.off('voice:error', handleError);
    };
  }, [currentChannel?.id, onJoin, onLeave, onError]);

  // Push-to-talk keyboard handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.code === pttKey && !pttActiveRef.current && isInVoice) {
        pttActiveRef.current = true;
        setIsPushingToTalk(true);
        setIsMuted(false);
        socketRef.current?.emit('voice:push-to-talk-start');
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === pttKey && pttActiveRef.current) {
        pttActiveRef.current = false;
        setIsPushingToTalk(false);
        setIsMuted(true);
        socketRef.current?.emit('voice:push-to-talk-stop');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pttKey, isInVoice]);

  // Actions
  const getChannels = useCallback(() => {
    socketRef.current?.emit('voice:get-channels');
  }, []);

  const createChannel = useCallback((name: string, bitrate?: number) => {
    socketRef.current?.emit('voice:create-channel', { name, bitrate });
  }, []);

  const deleteChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('voice:delete-channel', { channelId });
  }, []);

  const joinChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('voice:join-channel', { channelId });
  }, []);

  const leaveChannel = useCallback(() => {
    socketRef.current?.emit('voice:leave-channel');
    setCurrentChannel(null);
    setParticipants([]);
    setIsInVoice(false);
    setIsMuted(true);
    setIsPushingToTalk(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!isInVoice) return;
    socketRef.current?.emit('voice:toggle-mute');
    setIsMuted(prev => !prev);
  }, [isInVoice]);

  const toggleDeafen = useCallback(() => {
    if (!isInVoice) return;
    socketRef.current?.emit('voice:toggle-deafen');
    setIsDeafened(prev => !prev);
  }, [isInVoice]);

  const startPushToTalk = useCallback(() => {
    if (!isInVoice || pttActiveRef.current) return;
    pttActiveRef.current = true;
    setIsPushingToTalk(true);
    setIsMuted(false);
    socketRef.current?.emit('voice:push-to-talk-start');
  }, [isInVoice]);

  const stopPushToTalk = useCallback(() => {
    if (!pttActiveRef.current) return;
    pttActiveRef.current = false;
    setIsPushingToTalk(false);
    setIsMuted(true);
    socketRef.current?.emit('voice:push-to-talk-stop');
  }, []);

  return {
    // State
    channels,
    currentChannel,
    participants,
    isInVoice,
    isMuted,
    isDeafened,
    isPushingToTalk,
    speakingUsers,
    
    // Actions
    getChannels,
    createChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    startPushToTalk,
    stopPushToTalk,
  };
}
