import { useState, useCallback, useEffect, useRef } from 'react';
import { peerManager } from '../services/peerManager';
import { getSocket } from '../services/socket';
import { logger } from '../utils/logger';

interface RemoteStream {
    userId: string;
    stream: MediaStream;
}

/**
 * Hook for managing WebRTC peer connections for video/audio calls.
 * 
 * Handles:
 * - Local media stream acquisition
 * - Peer connection management (mesh topology)
 * - Audio/video toggle
 * - Remote stream tracking
 */
export function useWebRTC() {
    const [inCall, setInCall] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const isInitializedRef = useRef(false);

    // Initialize peer manager callbacks
    useEffect(() => {
        if (isInitializedRef.current) return;
        isInitializedRef.current = true;

        peerManager.setCallbacks(
            // On remote stream
            (userId, stream) => {
                if (stream) {
                    logger.debug(`Received remote stream from ${userId}`);
                    setRemoteStreams((prev) => {
                        // Replace existing or add new
                        const filtered = prev.filter((s) => s.userId !== userId);
                        return [...filtered, { userId, stream }];
                    });
                }
            },
            // On remote stream removed
            (userId) => {
                logger.debug(`Remote stream removed for ${userId}`);
                setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
            },
        );
    }, []);

    // Join call - acquire local stream and notify server
    const joinCall = useCallback(async () => {
        try {
            const stream = await peerManager.getLocalStream();
            setLocalStream(stream);
            getSocket().emit('rtc:join-call');
            setInCall(true);
            logger.info('Joined call');
        } catch (err) {
            logger.error('Failed to join call', err);
            throw err;
        }
    }, []);

    // Leave call - destroy all peers and notify server
    const leaveCall = useCallback(() => {
        peerManager.destroyAll();
        getSocket().emit('rtc:leave-call');
        setInCall(false);
        setLocalStream(null);
        setRemoteStreams([]);
        logger.info('Left call');
    }, []);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        const enabled = peerManager.toggleAudio();
        setAudioEnabled(enabled);
        return enabled;
    }, []);

    // Toggle video
    const toggleVideo = useCallback(() => {
        const enabled = peerManager.toggleVideo();
        setVideoEnabled(enabled);
        return enabled;
    }, []);

    // Handle incoming WebRTC signals
    const handleUserJoinedCall = useCallback((userId: string) => {
        if (inCall) {
            peerManager.handleUserJoinedCall(userId);
        }
    }, [inCall]);

    const handleUserLeftCall = useCallback((userId: string) => {
        peerManager.handleUserLeftCall(userId);
        setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
    }, []);

    const handleOffer = useCallback((data: { from: string; signal: unknown }) => {
        peerManager.handleOffer(data.from, data.signal);
    }, []);

    const handleAnswer = useCallback((data: { from: string; signal: unknown }) => {
        peerManager.handleAnswer(data.from, data.signal);
    }, []);

    const handleIceCandidate = useCallback((data: { from: string; signal: unknown }) => {
        peerManager.handleIceCandidate(data.from, data.signal);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (inCall) {
                peerManager.destroyAll();
            }
        };
    }, [inCall]);

    return {
        // State
        inCall,
        localStream,
        remoteStreams,
        audioEnabled,
        videoEnabled,
        // Actions
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        // Signal handlers (to be connected to socket events)
        handleUserJoinedCall,
        handleUserLeftCall,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
    };
}
