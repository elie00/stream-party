import { useEffect, useRef } from 'react';

interface VideoThumbnailProps {
  stream: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
}

// Deterministic color from string
function getAvatarColor(name: string): string {
  const colors = [
    'bg-purple-600',
    'bg-blue-600',
    'bg-green-600',
    'bg-yellow-600',
    'bg-pink-600',
    'bg-indigo-600',
    'bg-red-600',
    'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function VideoThumbnail({
  stream,
  displayName,
  isLocal = false,
  isMuted = false,
}: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some((t) => t.enabled) ?? false;

  return (
    <div className="relative w-[120px] h-[90px] rounded-lg overflow-hidden bg-[#252525] flex-shrink-0 ring-1 ring-[#444]">
      {stream && hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center ${getAvatarColor(displayName)}`}
        >
          <span className="text-white text-2xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 flex items-center justify-between">
        <span className="text-white text-[10px] truncate">
          {isLocal ? 'You' : displayName}
        </span>
        {isMuted && (
          <svg
            className="w-3 h-3 text-red-400 flex-shrink-0 ml-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .36-.03.71-.08 1.06" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </div>
    </div>
  );
}
