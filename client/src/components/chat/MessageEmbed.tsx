import { useState } from 'react';
import type { MessageEmbed as MessageEmbedType } from '@stream-party/shared';

interface MessageEmbedProps {
  embed: MessageEmbedType;
}

export function MessageEmbed({ embed }: MessageEmbedProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Render image embed
  if (embed.type === 'image') {
    return (
      <div className="mt-2 max-w-md">
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a]"
        >
          {!imageLoaded && !imageError && (
            <div className="w-full h-40 bg-[#2a2a2a] animate-pulse flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#444]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <img
            src={embed.url}
            alt={embed.title || 'Image'}
            className={`max-w-full max-h-80 object-contain ${imageLoaded ? 'block' : 'hidden'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {imageError && (
            <div className="p-4 text-center text-[#888] text-sm">
              Failed to load image
            </div>
          )}
        </a>
      </div>
    );
  }

  // Render video embed (YouTube, etc.)
  if (embed.type === 'video') {
    const youtubeId = extractYouTubeId(embed.url);
    
    if (youtubeId) {
      return (
        <div className="mt-2 max-w-md">
          <div className="rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a]">
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative group"
            >
              <div className="relative aspect-video bg-[#0a0a0a]">
                <img
                  src={embed.image || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                  alt={embed.title || 'Video thumbnail'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to lower quality thumbnail
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('/hqdefault.jpg')) {
                      target.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
            {(embed.title || embed.siteName) && (
              <div className="p-3">
                {embed.siteName && (
                  <div className="text-xs text-[#888] mb-1">{embed.siteName}</div>
                )}
                {embed.title && (
                  <a
                    href={embed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#a78bfa] hover:underline line-clamp-2"
                  >
                    {embed.title}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // Render link/article embed
  return (
    <div className="mt-2 max-w-md">
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
      >
        {embed.image && (
          <div className="aspect-video bg-[#0a0a0a]">
            <img
              src={embed.image}
              alt={embed.title || 'Preview'}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken image
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-3">
          {embed.siteName && (
            <div className="text-xs text-[#888] mb-1">{embed.siteName}</div>
          )}
          {embed.title && (
            <div className="text-sm font-medium text-[#e0e0e0] line-clamp-2 mb-1">
              {embed.title}
            </div>
          )}
          {embed.description && (
            <div className="text-xs text-[#888] line-clamp-2">
              {embed.description}
            </div>
          )}
          <div className="text-xs text-[#666] mt-2 truncate">
            {new URL(embed.url).hostname}
          </div>
        </div>
      </a>
    </div>
  );
}

// Helper to extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
