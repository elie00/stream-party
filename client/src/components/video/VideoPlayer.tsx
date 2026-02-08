import { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';

interface VideoPlayerProps {
  src: string | null;
  onTimeUpdate?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: (time: number) => void;
  onReady?: (player: Player) => void;
}

export function VideoPlayer({
  src,
  onTimeUpdate,
  onPlay,
  onPause,
  onSeeked,
  onReady,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const callbacksRef = useRef({ onTimeUpdate, onPlay, onPause, onSeeked, onReady });

  // Keep callbacks ref current to avoid re-attaching listeners
  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onPlay, onPause, onSeeked, onReady };
  }, [onTimeUpdate, onPlay, onPause, onSeeked, onReady]);

  // Initialize player once
  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered');
    videoRef.current.appendChild(videoElement);

    const player = videojs(videoElement, {
      controls: true,
      responsive: true,
      fluid: false,
      fill: true,
      preload: 'auto',
      controlBar: {
        pictureInPictureToggle: false,
      },
    });

    playerRef.current = player;

    // Attach event handlers that delegate to current refs
    player.on('timeupdate', () => {
      callbacksRef.current.onTimeUpdate?.(player.currentTime() || 0);
    });
    player.on('play', () => {
      callbacksRef.current.onPlay?.();
    });
    player.on('pause', () => {
      callbacksRef.current.onPause?.();
    });
    player.on('seeked', () => {
      callbacksRef.current.onSeeked?.(player.currentTime() || 0);
    });

    callbacksRef.current.onReady?.(player);

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Update source when src changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (!src) {
      player.reset();
      return;
    }

    // Determine MIME type from URL
    let type = 'video/mp4';
    if (src.includes('.webm')) type = 'video/webm';
    else if (src.includes('.mkv')) type = 'video/x-matroska';
    else if (src.includes('.avi')) type = 'video/x-msvideo';

    player.src({ src, type });
  }, [src]);

  return (
    <div className="video-player-wrapper w-full h-full bg-black rounded-lg overflow-hidden">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
}
