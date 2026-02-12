import ytdl from 'ytdl-core';
import { createLogger } from '../utils/logger';

const logger = createLogger('youtube');

// ===== Interfaces =====
export interface YouTubeMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  channel: string;
  viewCount: number;
}

export interface YouTubeStream {
  url: string;
  quality: string;
  mimeType: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

// ===== Cache =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const metadataCache = new Map<string, CacheEntry<YouTubeMetadata>>();
const streamCache = new Map<string, CacheEntry<YouTubeStream[]>>();

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ===== Video ID Extraction =====
const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
];

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// ===== Error Handling =====
export class YouTubeError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_URL' | 'VIDEO_NOT_FOUND' | 'VIDEO_PRIVATE' | 'VIDEO_UNAVAILABLE' | 'EXTRACTION_FAILED'
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

// ===== Metadata Extraction =====
/**
 * Get video metadata using ytdl-core
 */
export async function getVideoMetadata(videoId: string): Promise<YouTubeMetadata> {
  // Check cache first
  const cached = getFromCache(metadataCache, videoId);
  if (cached) {
    logger.debug(`Metadata cache hit for video: ${videoId}`);
    return cached;
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Validate video exists and get info
    if (!ytdl.validateURL(videoUrl)) {
      throw new YouTubeError('Invalid YouTube URL', 'INVALID_URL');
    }

    const info = await ytdl.getInfo(videoUrl);

    // Check if video is playable
    if (info.videoDetails.isPrivate) {
      throw new YouTubeError('This video is private', 'VIDEO_PRIVATE');
    }

    if (!info.videoDetails.isCrawlable) {
      throw new YouTubeError('This video is not available', 'VIDEO_UNAVAILABLE');
    }

    const metadata: YouTubeMetadata = {
      id: videoId,
      title: info.videoDetails.title,
      description: info.videoDetails.description?.slice(0, 500) || '',
      thumbnail: 
        info.videoDetails.thumbnails?.[0]?.url || 
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: parseInt(info.videoDetails.lengthSeconds, 10) || 0,
      channel: info.videoDetails.author.name,
      viewCount: parseInt(info.videoDetails.viewCount, 10) || 0,
    };

    // Cache the result
    setCache(metadataCache, videoId, metadata);
    logger.info(`Extracted metadata for video: ${videoId}`, { title: metadata.title });

    return metadata;
  } catch (error) {
    if (error instanceof YouTubeError) {
      throw error;
    }

    // Handle specific ytdl-core errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('Video unavailable')) {
      throw new YouTubeError('Video not found or unavailable', 'VIDEO_NOT_FOUND');
    }
    
    if (errorMessage.includes('private')) {
      throw new YouTubeError('This video is private', 'VIDEO_PRIVATE');
    }

    logger.error(`Failed to extract metadata for video: ${videoId}`, { error: errorMessage });
    throw new YouTubeError(`Failed to extract video metadata: ${errorMessage}`, 'EXTRACTION_FAILED');
  }
}

// ===== Streaming URL Extraction =====
/**
 * Get streaming URLs for a video
 */
export async function getStreamingUrls(videoId: string): Promise<YouTubeStream[]> {
  // Check cache first
  const cached = getFromCache(streamCache, videoId);
  if (cached) {
    logger.debug(`Stream cache hit for video: ${videoId}`);
    return cached;
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    if (!ytdl.validateURL(videoUrl)) {
      throw new YouTubeError('Invalid YouTube URL', 'INVALID_URL');
    }

    const info = await ytdl.getInfo(videoUrl);

    // Check if video is playable
    if (info.videoDetails.isPrivate) {
      throw new YouTubeError('This video is private', 'VIDEO_PRIVATE');
    }

    // Extract formats
    const formats = info.formats
      .filter(format => format.url) // Only formats with direct URLs
      .map(format => ({
        url: format.url!,
        quality: format.qualityLabel || format.audioQuality || 'unknown',
        mimeType: format.mimeType || 'video/mp4',
        hasAudio: !!format.audioBitrate,
        hasVideo: !!format.qualityLabel,
      }));

    if (formats.length === 0) {
      throw new YouTubeError('No playable formats found', 'EXTRACTION_FAILED');
    }

    // Sort by quality (video with audio first, then video only, then audio only)
    formats.sort((a, b) => {
      if (a.hasVideo && a.hasAudio && !(b.hasVideo && b.hasAudio)) return -1;
      if (b.hasVideo && b.hasAudio && !(a.hasVideo && a.hasAudio)) return 1;
      if (a.hasVideo && !b.hasVideo) return -1;
      if (b.hasVideo && !a.hasVideo) return 1;
      return 0;
    });

    // Cache the result
    setCache(streamCache, videoId, formats);
    logger.info(`Extracted ${formats.length} streaming formats for video: ${videoId}`);

    return formats;
  } catch (error) {
    if (error instanceof YouTubeError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to extract streaming URLs for video: ${videoId}`, { error: errorMessage });
    throw new YouTubeError(`Failed to extract streaming URLs: ${errorMessage}`, 'EXTRACTION_FAILED');
  }
}

/**
 * Get the best streaming URL (video with audio, or best available)
 */
export async function getStreamingUrl(videoId: string): Promise<YouTubeStream> {
  const formats = await getStreamingUrls(videoId);
  
  // Prefer video with audio
  const videoWithAudio = formats.find(f => f.hasVideo && f.hasAudio);
  if (videoWithAudio) return videoWithAudio;

  // Fall back to first video format
  const videoOnly = formats.find(f => f.hasVideo);
  if (videoOnly) return videoOnly;

  // Fall back to audio only
  const audioOnly = formats.find(f => f.hasAudio);
  if (audioOnly) return audioOnly;

  // Return first available
  return formats[0];
}

// ===== Cache Management =====
/**
 * Clear all caches
 */
export function clearCache(): void {
  metadataCache.clear();
  streamCache.clear();
  logger.info('YouTube caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { metadata: number; streams: number } {
  return {
    metadata: metadataCache.size,
    streams: streamCache.size,
  };
}
