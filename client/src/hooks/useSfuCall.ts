/**
 * Custom hook for managing SFU-based WebRTC calls
 * Replaces the mesh-based useCall hook for better scalability
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { sfuClient, ProducerInfo } from '../services/sfuClient';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../components/ui/Toast';
import { logger } from '../utils/logger';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

interface UseSfuCallReturn {
  inCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStreamInfo>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

export function useSfuCall(): UseSfuCallReturn {
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStreamInfo>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const pendingProducers = useRef<ProducerInfo[]>([]);

  // Set up SFU client callbacks
  useEffect(() => {
    sfuClient.setCallbacks(
      // onNewProducer
      (producerId: string) => {
        logger.info('New producer available', { producerId });
      },
      // onNewConsumer
      (userId: string, stream: MediaStream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(userId, { stream, userId });
          return next;
        });

        // Update participant's inCall status
        useRoomStore.setState((state) => {
          if (!state.room) return state;
          return {
            room: {
              ...state.room,
              participants: state.room.participants.map((p) =>
                p.userId === userId ? { ...p, inCall: true } : p
              ),
            },
          };
        });
      },
      // onProducerClosed
      (producerId: string) => {
        logger.info('Producer closed', { producerId });
      },
      // onPeerLeft
      (userId: string) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });

        // Update participant's inCall status
        useRoomStore.setState((state) => {
          if (!state.room) return state;
          return {
            room: {
              ...state.room,
              participants: state.room.participants.map((p) =>
                p.userId === userId ? { ...p, inCall: false } : p
              ),
            },
          };
        });
      }
    );
  }, []);

  // Consume pending producers after joining
  const consumePendingProducers = useCallback(async () => {
    for (const producer of pendingProducers.current) {
      try {
        await sfuClient.consume(producer);
      } catch (error) {
        logger.error('Failed to consume producer', { error: String(error) });
      }
    }
    pendingProducers.current = [];
  }, []);

  const joinCall = useCallback(async () => {
    try {
      // Join SFU room and get existing producers
      const producers = await sfuClient.join();
      pendingProducers.current = producers;

      // Start producing audio and video
      const stream = await sfuClient.startProducing(true, true, false);
      setLocalStream(stream);
      setInCall(true);
      setAudioEnabled(true);
      setVideoEnabled(true);

      // Consume existing producers
      await consumePendingProducers();

      logger.info('Joined SFU call');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        addToast('Camera/microphone permission denied', 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to access camera/microphone';
        addToast(message, 'error');
        logger.error('Failed to join SFU call', { error: message });
      }
    }
  }, [addToast, consumePendingProducers]);

  const leaveCall = useCallback(() => {
    sfuClient.leave();
    setInCall(false);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setAudioEnabled(true);
    setVideoEnabled(true);
    setIsScreenSharing(false);
    logger.info('Left SFU call');
  }, []);

  const toggleAudio = useCallback(() => {
    const enabled = sfuClient.toggleAudio();
    setAudioEnabled(enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const enabled = sfuClient.toggleVideo();
    setVideoEnabled(enabled);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await sfuClient.startProducing(false, false, true);
      setIsScreenSharing(true);
      addToast('Screen sharing started', 'success');

      // Listen for when user stops sharing via browser UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          addToast('Screen sharing stopped', 'info');
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start screen sharing';
      addToast(message, 'error');
      logger.error('Failed to start screen share', { error: message });
    }
  }, [addToast]);

  const stopScreenShare = useCallback(() => {
    sfuClient.stopProducing();
    setIsScreenSharing(false);
    addToast('Screen sharing stopped', 'info');
  }, [addToast]);

  return {
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
  };
}
