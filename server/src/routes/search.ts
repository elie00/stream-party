import { Router, Request, Response } from 'express';
import { searchService } from '../services/searchService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/search/messages
 * Search messages by content
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { query, serverId, channelId, userId, limit, offset } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters',
        code: 'INVALID_QUERY',
      });
    }

    const results = await searchService.searchMessages({
      query,
      serverId: serverId as string | undefined,
      channelId: channelId as string | undefined,
      userId: userId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ error: 'Search failed', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/search/users
 * Search users by display name
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { query, serverId } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters',
        code: 'INVALID_QUERY',
      });
    }

    const results = await searchService.searchUsers(query, serverId as string | undefined);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed', code: 'INTERNAL_ERROR' });
  }
});

export default router;
