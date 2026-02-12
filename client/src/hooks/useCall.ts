/**
 * Custom hook for managing WebRTC calls
 */
import { useState, useCallback, useEffect } from 'react';
import { peerManager } from '../services/peerManager';
import { getSocket } from '../services/socket';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../components/ui/Toast';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

interface UseCallReturn {
  inCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStreamInfo>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  joinCall: () => Promise<void>;
  leaveCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
}

export function useCall(): UseCallReturn {
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStreamInfo>>(new Map());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  // Set up peer manager callbacks
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
      }
    );
  }, []);

  // Set up RTC event listeners
  useEffect(() => {
    const socket = getSocket();

    const handleRtcUserJoinedCall = (userId: string) => {
      // Update participant's inCall status in room store
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
    };

    const handleRtcUserLeftCall = (userId: string) => {
      // Update participant's inCall status in room store
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

    socket.on('rtc:user-joined-call', handleRtcUserJoinedCall);
    socket.on('rtc:user-left-call', handleRtcUserLeftCall);
    socket.on('rtc:offer', handleRtcOffer);
    socket.on('rtc:answer', handleRtcAnswer);
    socket.on('rtc:ice-candidate', handleRtcIceCandidate);

    return () => {
      socket.off('rtc:user-joined-call', handleRtcUserJoinedCall);
      socket.off('rtc:user-left-call', handleRtcUserLeftCall);
      socket.off('rtc:offer', handleRtcOffer);
      socket.off('rtc:answer', handleRtcAnswer);
      socket.off('rtc:ice-candidate', handleRtcIceCandidate);
    };
  }, []);

  const joinCall = useCallback(async () => {
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

  const leaveCall = useCallback(() => {
    const socket = getSocket();
    socket.emit('rtc:leave-call');

    peerManager.destroyAll();
    setInCall(false);
    setLocalStream(null);
    setRemoteStreams(new Map());
    setAudioEnabled(true);
    setVideoEnabled(true);
  }, []);

  const toggleAudio = useCallback(() => {
    const enabled = peerManager.toggleAudio();
    setAudioEnabled(enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const enabled = peerManager.toggleVideo();
    setVideoEnabled(enabled);
  }, []);

  return {
    inCall,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
  };
}
