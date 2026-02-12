/**
 * YouTube Input Component
 * Input for pasting YouTube URLs with validation and metadata preview
 */
import { useState, useEffect, useCallback } from 'react';
import { useToastStore } from '../ui/Toast';
import { useYouTube } from '../../hooks/useYouTube';
import type { YouTubeMetadata } from '@stream-party/shared';

interface YouTubeInputProps {
  onSubmit: (videoId: string, metadata: YouTubeMetadata) => void;
  isLoading?: boolean;
}

// Format duration from seconds to mm:ss or hh:mm:ss
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format view count
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

export function YouTubeInput({ onSubmit, isLoading = false }: YouTubeInputProps) {
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<YouTubeMetadata | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const { getVideoInfo, extractVideoId, isValidYouTubeUrl } = useYouTube();

  // Debounced URL validation
  const validateUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setPreview(null);
      return;
    }

    const videoId = extractVideoId(trimmed);
    if (!videoId) {
      setPreview(null);
      return;
    }

    setIsValidating(true);
    try {
      const metadata = await getVideoInfo(trimmed);
      if (metadata) {
        setPreview(metadata);
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error('Failed to fetch video info:', error);
      setPreview(null);
    } finally {
      setIsValidating(false);
    }
  }, [extractVideoId, getVideoInfo]);

  // Debounce URL validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateUrl(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, validateUrl]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      addToast('Please enter a YouTube URL', 'error');
      return;
    }

    const videoId = extractVideoId(trimmed);
    if (!videoId) {
      addToast('Invalid YouTube URL. Please enter a valid YouTube video URL', 'error');
      return;
    }

    if (preview) {
      onSubmit(videoId, preview);
      // Reset after successful submit
      setValue('');
      setPreview(null);
    } else {
      addToast('Please wait for video validation', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && preview && !isLoading && !isValidating) {
      handleSubmit();
    }
  };

  const handleClear = () => {
    setValue('');
    setPreview(null);
  };

  return (
    <div className="w-full space-y-3">
      {/* Input Field */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a YouTube URL..."
            disabled={isLoading}
            className="w-full bg-[#222] border border-[#444] rounded-lg px-4 py-2 pr-10 text-sm text-white placeholder-[#666] focus:border-[#7c3aed] focus:outline-none disabled:opacity-50 transition-colors"
          />
          {isValidating && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#333] border-t-[#7c3aed] rounded-full animate-spin" />
            </div>
          )}
          {value && !isValidating && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !preview || isValidating}
          className="bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-[#444] disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
              </svg>
              Add to Queue
            </>
          )}
        </button>
      </div>

      {/* Video Preview */}
      {preview && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 flex gap-3">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <img
              src={preview.thumbnail}
              alt={preview.title}
              className="w-32 h-20 object-cover rounded"
            />
            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
              {formatDuration(preview.duration)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">
              {preview.title}
            </h4>
            <p className="text-[#888] text-xs mb-1">
              {preview.channel}
            </p>
            <p className="text-[#666] text-xs">
              {formatViewCount(preview.viewCount)}
            </p>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {value.trim() && !preview && !isValidating && (
        <div className="text-red-400 text-xs flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Invalid YouTube URL or video not found
        </div>
      )}
    </div>
  );
}

export default YouTubeInput;
