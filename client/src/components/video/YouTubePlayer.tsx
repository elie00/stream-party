/**
 * YouTube Player Component
 * Uses YouTube IFrame API directly without external libraries
 */
import { useRef, useEffect, useCallback, useState } from 'react';

// YouTube Player API types
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
}

interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

// YouTube Player States
const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

// Player state mapping
type PlayerState = 'playing' | 'paused' | 'ended' | 'buffering';

interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onStateChange: (state: 'playing' | 'paused' | 'ended') => void;
  onReady: () => void;
  volume?: number;
  muted?: boolean;
}

// Declare YT on window
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId: string;
          playerVars?: {
            autoplay?: 0 | 1;
            controls?: 0 | 1;
            disablekb?: 0 | 1;
            fs?: 0 | 1;
            modestbranding?: 0 | 1;
            rel?: 0 | 1;
            showinfo?: 0 | 1;
            iv_load_policy?: 1 | 3;
            playsinline?: 0 | 1;
          };
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: YTPlayerEvent) => void;
            onError?: (event: YTPlayerEvent) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: typeof YT_PLAYER_STATE;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubePlayer({
  videoId,
  isPlaying,
  currentTime,
  onTimeUpdate,
  onStateChange,
  onReady,
  volume = 100,
  muted = false,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const lastEmittedTimeRef = useRef<number>(0);
  const isSeekingRef = useRef(false);
  const lastKnownStateRef = useRef<PlayerState>('paused');

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  // Initialize player when API is ready
  const initPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    const playerId = `youtube-player-${videoId}`;

    // Create a div for the player
    const playerDiv = document.createElement('div');
    playerDiv.id = playerId;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(playerDiv);

    playerRef.current = new window.YT.Player(playerDiv, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        disablekb: 0,
        fs: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
      },
      events: {
        onReady: () => {
          setIsPlayerReady(true);
          onReady();
        },
        onStateChange: (event: YTPlayerEvent) => {
          const state = event.data;
          switch (state) {
            case YT_PLAYER_STATE.PLAYING:
              lastKnownStateRef.current = 'playing';
              onStateChange('playing');
              break;
            case YT_PLAYER_STATE.PAUSED:
              lastKnownStateRef.current = 'paused';
              onStateChange('paused');
              break;
            case YT_PLAYER_STATE.ENDED:
              lastKnownStateRef.current = 'ended';
              onStateChange('ended');
              break;
            case YT_PLAYER_STATE.BUFFERING:
              // Don't change state during buffering
              break;
          }
        },
        onError: (event: YTPlayerEvent) => {
          console.error('YouTube Player Error:', event.data);
        },
      },
    });
  }, [videoId, onReady, onStateChange]);

  // Wait for API to be ready
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        initPlayer();
      };
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  // Time update interval
  useEffect(() => {
    if (!isPlayerReady) return;

    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (playerRef.current && !isSeekingRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        // Only emit if time changed significantly (more than 0.1 seconds)
        if (Math.abs(currentTime - lastEmittedTimeRef.current) > 0.1) {
          lastEmittedTimeRef.current = currentTime;
          onTimeUpdate(currentTime);
        }
      }
    }, 250);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [isPlayerReady, onTimeUpdate]);

  // Sync play/pause state
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const player = playerRef.current;
    const currentState = player.getPlayerState();

    if (isPlaying && currentState !== YT_PLAYER_STATE.PLAYING) {
      player.playVideo();
    } else if (!isPlaying && currentState === YT_PLAYER_STATE.PLAYING) {
      player.pauseVideo();
    }
  }, [isPlaying, isPlayerReady]);

  // Sync seek time
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const player = playerRef.current;
    const playerTime = player.getCurrentTime();

    // Only seek if difference is more than 1 second
    if (Math.abs(playerTime - currentTime) > 1) {
      isSeekingRef.current = true;
      player.seekTo(currentTime, true);
      // Reset seeking flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 500);
    }
  }, [currentTime, isPlayerReady]);

  // Sync volume
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const player = playerRef.current;
    player.setVolume(volume);
  }, [volume, isPlayerReady]);

  // Sync muted state
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const player = playerRef.current;
    if (muted) {
      player.mute();
    } else {
      player.unMute();
    }
  }, [muted, isPlayerReady]);

  // Handle video ID change
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    // Re-initialize player for new video
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      setIsPlayerReady(false);
      initPlayer();
    }
  }, [videoId, isPlayerReady, initPlayer]);

  return (
    <div className="youtube-player-wrapper w-full h-full bg-black rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}

export default YouTubePlayer;
