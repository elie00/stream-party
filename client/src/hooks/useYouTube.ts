/**
 * useYouTube hook
 * Provides YouTube video functionality for the client
 */
import { useState, useCallback } from 'react';
import type { YouTubeMetadata, YouTubeStream } from '@stream-party/shared';
import {
  getVideoInfo,
  getStreamUrl,
  extractVideoId,
  isValidYouTubeUrl,
} from '../services/youtubeApi';

interface UseYouTubeState {
  isLoading: boolean;
  error: string | null;
  metadata: YouTubeMetadata | null;
  stream: YouTubeStream | null;
}

interface UseYouTubeReturn extends UseYouTubeState {
  getVideoInfo: (url: string) => Promise<YouTubeMetadata | null>;
  getStreamUrl: (videoId: string) => Promise<YouTubeStream | null>;
  extractVideoId: (url: string) => string | null;
  isValidYouTubeUrl: (url: string) => boolean;
  reset: () => void;
}

const initialState: UseYouTubeState = {
  isLoading: false,
  error: null,
  metadata: null,
  stream: null,
};

export function useYouTube(): UseYouTubeReturn {
  const [state, setState] = useState<UseYouTubeState>(initialState);

  const handleGetVideoInfo = useCallback(async (url: string): Promise<YouTubeMetadata | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const metadata = await getVideoInfo(url);
      setState((prev) => ({ ...prev, isLoading: false, metadata }));
      return metadata;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get video info';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, []);

  const handleGetStreamUrl = useCallback(async (videoId: string): Promise<YouTubeStream | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const stream = await getStreamUrl(videoId);
      setState((prev) => ({ ...prev, isLoading: false, stream }));
      return stream;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get stream URL';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    getVideoInfo: handleGetVideoInfo,
    getStreamUrl: handleGetStreamUrl,
    extractVideoId,
    isValidYouTubeUrl,
    reset,
  };
}

export default useYouTube;
