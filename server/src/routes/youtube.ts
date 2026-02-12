import { Router, Request, Response } from 'express';
import {
  extractVideoId,
  getVideoMetadata,
  getStreamingUrl,
  getStreamingUrls,
  YouTubeError,
  getCacheStats,
  clearCache,
} from '../services/youtubeService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/youtube/info
 * Get metadata for a YouTube video
 * Query params:
 *   - url: YouTube video URL or video ID
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: url',
        code: 'MISSING_URL' 
      });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL or video ID',
        code: 'INVALID_URL' 
      });
    }

    // Get video metadata
    const metadata = await getVideoMetadata(videoId);

    res.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    if (error instanceof YouTubeError) {
      logger.warn(`YouTube info error: ${error.message}`, { code: error.code });
      return res.status(getErrorStatusCode(error.code)).json({
        error: error.message,
        code: error.code,
      });
    }

    logger.error('YouTube info error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      error: 'Failed to get video information',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/youtube/stream
 * Get streaming URL for a YouTube video
 * Query params:
 *   - url: YouTube video URL or video ID
 *   - all: If 'true', return all available formats
 */
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const { url, all } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: url',
        code: 'MISSING_URL' 
      });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL or video ID',
        code: 'INVALID_URL' 
      });
    }

    // Get streaming URL(s)
    if (all === 'true') {
      const streams = await getStreamingUrls(videoId);
      res.json({
        success: true,
        data: {
          videoId,
          formats: streams,
        },
      });
    } else {
      const stream = await getStreamingUrl(videoId);
      res.json({
        success: true,
        data: {
          videoId,
          stream,
        },
      });
    }
  } catch (error) {
    if (error instanceof YouTubeError) {
      logger.warn(`YouTube stream error: ${error.message}`, { code: error.code });
      return res.status(getErrorStatusCode(error.code)).json({
        error: error.message,
        code: error.code,
      });
    }

    logger.error('YouTube stream error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ 
      error: 'Failed to get streaming URL',
      code: 'INTERNAL_ERROR' 
    });
  }
});

/**
 * GET /api/youtube/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (_req: Request, res: Response) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * DELETE /api/youtube/cache
 * Clear all caches
 */
router.delete('/cache', (_req: Request, res: Response) => {
  clearCache();
  res.json({
    success: true,
    message: 'Cache cleared',
  });
});

/**
 * Map YouTube error codes to HTTP status codes
 */
function getErrorStatusCode(code: string): number {
  switch (code) {
    case 'INVALID_URL':
      return 400;
    case 'VIDEO_NOT_FOUND':
      return 404;
    case 'VIDEO_PRIVATE':
      return 403;
    case 'VIDEO_UNAVAILABLE':
      return 404;
    case 'EXTRACTION_FAILED':
      return 500;
    default:
      return 500;
  }
}

export default router;
