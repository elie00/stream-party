/**
 * YouTube API client service
 * Handles communication with the server's YouTube endpoints
 */
import type { YouTubeMetadata, YouTubeStream } from '@stream-party/shared';

const API_BASE = '/api/youtube';

class YouTubeApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'YouTubeApiError';
  }
}

async function fetchYouTubeApi<T>(path: string, options?: RequestInit): Promise<T> {
  // Get token from localStorage
  const authData = JSON.parse(localStorage.getItem('stream-party-auth') || '{}');
  const token = authData?.state?.token;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new YouTubeApiError(response.status, errorData.error || response.statusText);
  }

  return response.json();
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;

  // Handle various YouTube URL formats
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: https://youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // Live URL: https://www.youtube.com/live/VIDEO_ID
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If the input is just a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Validate if a URL is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

/**
 * Get video metadata from the server
 */
export async function getVideoInfo(url: string): Promise<YouTubeMetadata> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new YouTubeApiError(400, 'Invalid YouTube URL');
  }

  return fetchYouTubeApi<YouTubeMetadata>(`/info?url=${encodeURIComponent(url)}`);
}

/**
 * Get video info by video ID
 */
export async function getVideoInfoById(videoId: string): Promise<YouTubeMetadata> {
  return fetchYouTubeApi<YouTubeMetadata>(`/info?id=${videoId}`);
}

/**
 * Get stream URL for a YouTube video
 */
export async function getStreamUrl(videoId: string): Promise<YouTubeStream> {
  return fetchYouTubeApi<YouTubeStream>(`/stream/${videoId}`);
}

/**
 * Get multiple stream qualities for a video
 */
export async function getStreams(videoId: string): Promise<YouTubeStream[]> {
  const response = await fetchYouTubeApi<{ streams: YouTubeStream[] }>(`/stream/${videoId}/all`);
  return response.streams;
}

export const youtubeApi = {
  extractVideoId,
  isValidYouTubeUrl,
  getVideoInfo,
  getVideoInfoById,
  getStreamUrl,
  getStreams,
};
