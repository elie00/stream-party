import { Router, Request, Response } from 'express';
import { moderationService } from '../services/moderationService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/moderation/:serverId/logs
 */
router.get('/:serverId/logs', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await moderationService.getLogs(serverId, limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get moderation logs error:', error);
    res.status(500).json({ error: 'Failed to get logs', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/moderation/:serverId/muted
 */
router.get('/:serverId/muted', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const muted = await moderationService.getMutedUsers(serverId);
    res.json({ success: true, data: muted });
  } catch (error) {
    logger.error('Get muted users error:', error);
    res.status(500).json({ error: 'Failed to get muted users', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/moderation/:serverId/banned
 */
router.get('/:serverId/banned', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const banned = await moderationService.getBannedUsers(serverId);
    res.json({ success: true, data: banned });
  } catch (error) {
    logger.error('Get banned users error:', error);
    res.status(500).json({ error: 'Failed to get banned users', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/moderation/:serverId/config
 */
router.get('/:serverId/config', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const config = await moderationService.getAutoModConfig(serverId);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Get auto-mod config error:', error);
    res.status(500).json({ error: 'Failed to get config', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/moderation/:serverId/config
 */
router.put('/:serverId/config', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const config = await moderationService.updateAutoModConfig(serverId, req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Update auto-mod config error:', error);
    res.status(500).json({ error: 'Failed to update config', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/moderation/:serverId/roles
 */
router.get('/:serverId/roles', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const roles = await moderationService.getRoles(serverId);
    res.json({ success: true, data: roles });
  } catch (error) {
    logger.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles', code: 'INTERNAL_ERROR' });
  }
});

export default router;
