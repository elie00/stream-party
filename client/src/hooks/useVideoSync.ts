/**
 * Custom hook for managing video synchronization
 */
import { useCallback, useEffect, useRef } from 'react';
import { syncEngine } from '../services/syncEngine';
import type Player from 'video.js/dist/types/player';

interface UseVideoSyncOptions {
  isHost: boolean;
}

interface UseVideoSyncReturn {
  setPlayer: (player: Player) => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleSeeked: (time: number) => void;
}

export function useVideoSync(options: UseVideoSyncOptions): UseVideoSyncReturn {
  const { isHost } = options;
  const playerRef = useRef<Player | null>(null);

  // Keep SyncEngine in sync with host status
  useEffect(() => {
    syncEngine.setHost(isHost);
  }, [isHost]);

  const setPlayer = useCallback((player: Player) => {
    playerRef.current = player;
    syncEngine.setPlayer(player);
  }, []);

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
    [isHost]
  );

  return {
    setPlayer,
    handlePlay,
    handlePause,
    handleSeeked,
  };
}
