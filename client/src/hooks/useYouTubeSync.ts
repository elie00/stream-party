/**
 * Custom hook for managing YouTube video synchronization
 */
import { useCallback, useEffect, useRef } from 'react';
import { 
  youTubeSyncEngine, 
  YouTubePlayerAdapter 
} from '../services/youTubeSyncEngine';
import type { VideoQueueItem, YouTubeSyncState } from '@stream-party/shared';
import { getSocket } from '../services/socket';

interface UseYouTubeSyncOptions {
  isHost: boolean;
  onSourceChange?: (videoId: string | null) => void;
  onQueueChange?: (queue: VideoQueueItem[]) => void;
}

interface UseYouTubeSyncReturn {
  setPlayer: (player: YouTubePlayerAdapter) => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleSeek: (time: number) => void;
  handleSourceChange: (videoId: string | null) => void;
  addToQueue: (video: Omit<VideoQueueItem, 'position' | 'votes'>) => void;
  removeFromQueue: (videoId: string) => void;
  voteSkip: (videoId: string) => void;
  requestSync: () => void;
  requestQueue: () => void;
}

export function useYouTubeSync(options: UseYouTubeSyncOptions): UseYouTubeSyncReturn {
  const { isHost, onSourceChange, onQueueChange } = options;
  const playerRef = useRef<YouTubePlayerAdapter | null>(null);

  // Keep YouTubeSyncEngine in sync with host status
  useEffect(() => {
    youTubeSyncEngine.setHost(isHost);
  }, [isHost]);

  // Set up socket event listeners
  useEffect(() => {
    const socket = getSocket();

    // Handle incoming YouTube sync state
    const handleYoutubeState = (state: YouTubeSyncState) => {
      youTubeSyncEngine.handleSyncState(state);
    };

    // Handle play event from host
    const handleYoutubePlay = () => {
      youTubeSyncEngine.handlePlay();
    };

    // Handle pause event from host
    const handleYoutubePause = () => {
      youTubeSyncEngine.handlePause();
    };

    // Handle seek event from host
    const handleYoutubeSeek = (data: { time: number }) => {
      youTubeSyncEngine.handleSeek(data.time);
    };

    // Handle source change from host
    const handleYoutubeSource = (data: { videoId: string | null }) => {
      youTubeSyncEngine.handleSource(data.videoId);
      onSourceChange?.(data.videoId);
    };

    // Handle queue add
    const handleQueueAdd = (data: { video: VideoQueueItem }) => {
      youTubeSyncEngine.handleQueueAdd(data.video);
    };

    // Handle queue remove
    const handleQueueRemove = (data: { videoId: string }) => {
      youTubeSyncEngine.handleQueueRemove(data.videoId);
    };

    // Handle queue vote
    const handleQueueVote = (data: { videoId: string; userId: string; votes: string[] }) => {
      youTubeSyncEngine.handleQueueVote(data);
    };

    // Handle queue sync
    const handleQueueSync = (data: { queue: VideoQueueItem[] }) => {
      youTubeSyncEngine.handleQueueSync(data.queue);
      onQueueChange?.(data.queue);
    };

    // Register event handlers
    socket.on('youtube:state', handleYoutubeState);
    socket.on('youtube:play', handleYoutubePlay);
    socket.on('youtube:pause', handleYoutubePause);
    socket.on('youtube:seek', handleYoutubeSeek);
    socket.on('youtube:source', handleYoutubeSource);
    socket.on('queue:add', handleQueueAdd);
    socket.on('queue:remove', handleQueueRemove);
    socket.on('queue:vote', handleQueueVote);
    socket.on('queue:sync', handleQueueSync);

    // Register callback handlers with sync engine
    if (onSourceChange) {
      youTubeSyncEngine.on('youtube:source', onSourceChange);
    }
    if (onQueueChange) {
      youTubeSyncEngine.on('queue:sync', onQueueChange);
    }

    // Cleanup
    return () => {
      socket.off('youtube:state', handleYoutubeState);
      socket.off('youtube:play', handleYoutubePlay);
      socket.off('youtube:pause', handleYoutubePause);
      socket.off('youtube:seek', handleYoutubeSeek);
      socket.off('youtube:source', handleYoutubeSource);
      socket.off('queue:add', handleQueueAdd);
      socket.off('queue:remove', handleQueueRemove);
      socket.off('queue:vote', handleQueueVote);
      socket.off('queue:sync', handleQueueSync);

      if (onSourceChange) {
        youTubeSyncEngine.off('youtube:source');
      }
      if (onQueueChange) {
        youTubeSyncEngine.off('queue:sync');
      }
    };
  }, [onSourceChange, onQueueChange]);

  const setPlayer = useCallback((player: YouTubePlayerAdapter) => {
    playerRef.current = player;
    youTubeSyncEngine.setPlayer(player);
  }, []);

  const handlePlay = useCallback(() => {
    if (!isHost || youTubeSyncEngine.isIgnoringEvents()) return;
    youTubeSyncEngine.emitPlay();
  }, [isHost]);

  const handlePause = useCallback(() => {
    if (!isHost || youTubeSyncEngine.isIgnoringEvents()) return;
    youTubeSyncEngine.emitPause();
  }, [isHost]);

  const handleSeek = useCallback((time: number) => {
    if (!isHost || youTubeSyncEngine.isIgnoringEvents()) return;
    youTubeSyncEngine.emitSeek(time);
  }, [isHost]);

  const handleSourceChange = useCallback((videoId: string | null) => {
    if (!isHost) return;
    youTubeSyncEngine.emitSource(videoId);
  }, [isHost]);

  const addToQueue = useCallback((video: Omit<VideoQueueItem, 'position' | 'votes'>) => {
    youTubeSyncEngine.emitQueueAdd(video);
  }, []);

  const removeFromQueue = useCallback((videoId: string) => {
    youTubeSyncEngine.emitQueueRemove(videoId);
  }, []);

  const voteSkip = useCallback((videoId: string) => {
    youTubeSyncEngine.emitQueueVote(videoId);
  }, []);

  const requestSync = useCallback(() => {
    youTubeSyncEngine.requestSync();
  }, []);

  const requestQueue = useCallback(() => {
    youTubeSyncEngine.requestQueue();
  }, []);

  return {
    setPlayer,
    handlePlay,
    handlePause,
    handleSeek,
    handleSourceChange,
    addToQueue,
    removeFromQueue,
    voteSkip,
    requestSync,
    requestQueue,
  };
}
