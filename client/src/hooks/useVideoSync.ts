import { useRef, useCallback, useEffect } from 'react';
import type Player from 'video.js/dist/types/player';
import { syncEngine } from '../services/syncEngine';

/**
 * Hook for managing video synchronization between host and peers.
 * 
 * - Host: broadcasts state every 1.5s and emits discrete events (play/pause/seek)
 * - Peers: receive state and apply drift correction
 */
export function useVideoSync(isHost: boolean) {
    const playerRef = useRef<Player | null>(null);

    // Update sync engine when host status changes
    useEffect(() => {
        syncEngine.setHost(isHost);
    }, [isHost]);

    // Set player reference in sync engine
    const setPlayer = useCallback((player: Player | null) => {
        playerRef.current = player;
        if (player) {
            syncEngine.setPlayer(player);
        }
    }, []);

    // Host-only event emitters
    const emitPlay = useCallback(() => {
        if (isHost) {
            syncEngine.emitPlay();
        }
    }, [isHost]);

    const emitPause = useCallback(() => {
        if (isHost) {
            syncEngine.emitPause();
        }
    }, [isHost]);

    const emitSeek = useCallback(
        (time: number) => {
            if (isHost) {
                syncEngine.emitSeek(time);
            }
        },
        [isHost],
    );

    // Request initial sync (for late joiners)
    const requestSync = useCallback(() => {
        syncEngine.requestSync();
    }, []);

    // Check if engine is ignoring events (during seek operations)
    const isIgnoringEvents = useCallback(() => {
        return syncEngine.isIgnoringEvents();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            syncEngine.destroy();
        };
    }, []);

    return {
        playerRef,
        setPlayer,
        emitPlay,
        emitPause,
        emitSeek,
        requestSync,
        isIgnoringEvents,
    };
}
