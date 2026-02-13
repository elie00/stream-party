/**
 * Moderation Socket Handlers
 * Handles moderation events: warn, mute, kick, ban, logs, config
 */
import { Server, Socket } from 'socket.io';
import { moderationService } from '../../services/moderationService';
import { checkSocketPermission } from '../../middleware/permissions';
import { AutoModConfig } from '@stream-party/shared';
import { logger } from '../../utils/logger';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerModerationHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Warn a user
   */
  socket.on('mod:warn', async (data: { serverId: string; targetId: string; reason: string }) => {
    try {
      const log = await moderationService.warn(data.serverId, data.targetId, user.userId, data.reason);

      if (!log) {
        socket.emit('mod:error', { message: 'Failed to warn user. Check permissions.' });
        return;
      }

      // Broadcast to all server members
      io.to(`server:${data.serverId}`).emit('mod:warned', { log });

      logger.info(`User ${data.targetId} warned by ${user.displayName} in server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to warn user';
      logger.error('mod:warn error', { error: message });
      socket.emit('mod:error', { message: 'Failed to warn user.' });
    }
  });

  /**
   * Mute a user
   */
  socket.on('mod:mute', async (data: { serverId: string; targetId: string; reason: string; duration?: number }) => {
    try {
      const mutedUser = await moderationService.mute(
        data.serverId, data.targetId, user.userId, data.reason, data.duration
      );

      if (!mutedUser) {
        socket.emit('mod:error', { message: 'Failed to mute user. Check permissions or user may already be muted.' });
        return;
      }

      io.to(`server:${data.serverId}`).emit('mod:muted', { mutedUser });

      logger.info(`User ${data.targetId} muted by ${user.displayName} in server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mute user';
      logger.error('mod:mute error', { error: message });
      socket.emit('mod:error', { message: 'Failed to mute user.' });
    }
  });

  /**
   * Unmute a user
   */
  socket.on('mod:unmute', async (data: { serverId: string; targetId: string }) => {
    try {
      const success = await moderationService.unmute(data.serverId, data.targetId, user.userId);

      if (!success) {
        socket.emit('mod:error', { message: 'Failed to unmute user. Check permissions.' });
        return;
      }

      io.to(`server:${data.serverId}`).emit('mod:unmuted', { serverId: data.serverId, userId: data.targetId });

      logger.info(`User ${data.targetId} unmuted by ${user.displayName} in server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unmute user';
      logger.error('mod:unmute error', { error: message });
      socket.emit('mod:error', { message: 'Failed to unmute user.' });
    }
  });

  /**
   * Kick a user
   */
  socket.on('mod:kick', async (data: { serverId: string; targetId: string; reason: string }) => {
    try {
      const success = await moderationService.kick(data.serverId, data.targetId, user.userId, data.reason);

      if (!success) {
        socket.emit('mod:error', { message: 'Failed to kick user. Check permissions.' });
        return;
      }

      io.to(`server:${data.serverId}`).emit('mod:kicked', {
        serverId: data.serverId,
        userId: data.targetId,
        reason: data.reason,
      });

      logger.info(`User ${data.targetId} kicked by ${user.displayName} from server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to kick user';
      logger.error('mod:kick error', { error: message });
      socket.emit('mod:error', { message: 'Failed to kick user.' });
    }
  });

  /**
   * Ban a user
   */
  socket.on('mod:ban', async (data: { serverId: string; targetId: string; reason: string }) => {
    try {
      const bannedUser = await moderationService.ban(data.serverId, data.targetId, user.userId, data.reason);

      if (!bannedUser) {
        socket.emit('mod:error', { message: 'Failed to ban user. Check permissions or user may already be banned.' });
        return;
      }

      io.to(`server:${data.serverId}`).emit('mod:banned', { bannedUser });

      logger.info(`User ${data.targetId} banned by ${user.displayName} from server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ban user';
      logger.error('mod:ban error', { error: message });
      socket.emit('mod:error', { message: 'Failed to ban user.' });
    }
  });

  /**
   * Unban a user
   */
  socket.on('mod:unban', async (data: { serverId: string; targetId: string }) => {
    try {
      const success = await moderationService.unban(data.serverId, data.targetId, user.userId);

      if (!success) {
        socket.emit('mod:error', { message: 'Failed to unban user. Check permissions.' });
        return;
      }

      io.to(`server:${data.serverId}`).emit('mod:unbanned', { serverId: data.serverId, userId: data.targetId });

      logger.info(`User ${data.targetId} unbanned by ${user.displayName} in server ${data.serverId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unban user';
      logger.error('mod:unban error', { error: message });
      socket.emit('mod:error', { message: 'Failed to unban user.' });
    }
  });

  /**
   * Get moderation logs
   */
  socket.on('mod:get-logs', async (data: { serverId: string; limit?: number }) => {
    try {
      const allowed = await checkSocketPermission(user.userId, data.serverId, 'view_audit_log');
      if (!allowed) {
        socket.emit('mod:error', { message: 'Insufficient permissions to view logs.' });
        return;
      }

      const logs = await moderationService.getModerationLogs(data.serverId, data.limit);
      socket.emit('mod:logs', { logs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get logs';
      logger.error('mod:get-logs error', { error: message });
      socket.emit('mod:error', { message: 'Failed to get moderation logs.' });
    }
  });

  /**
   * Get muted users
   */
  socket.on('mod:get-muted', async (data: { serverId: string }) => {
    try {
      const allowed = await checkSocketPermission(user.userId, data.serverId, 'mute_members');
      if (!allowed) {
        socket.emit('mod:error', { message: 'Insufficient permissions to view muted users.' });
        return;
      }

      const mutedUsers = await moderationService.getMutedUsers(data.serverId);
      socket.emit('mod:muted-users', { mutedUsers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get muted users';
      logger.error('mod:get-muted error', { error: message });
      socket.emit('mod:error', { message: 'Failed to get muted users.' });
    }
  });

  /**
   * Get banned users
   */
  socket.on('mod:get-banned', async (data: { serverId: string }) => {
    try {
      const allowed = await checkSocketPermission(user.userId, data.serverId, 'ban_members');
      if (!allowed) {
        socket.emit('mod:error', { message: 'Insufficient permissions to view banned users.' });
        return;
      }

      const bannedUsers = await moderationService.getBannedUsers(data.serverId);
      socket.emit('mod:banned-users', { bannedUsers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get banned users';
      logger.error('mod:get-banned error', { error: message });
      socket.emit('mod:error', { message: 'Failed to get banned users.' });
    }
  });

  /**
   * Get auto-mod config
   */
  socket.on('mod:get-config', async (data: { serverId: string }) => {
    try {
      const allowed = await checkSocketPermission(user.userId, data.serverId, 'manage_server');
      if (!allowed) {
        socket.emit('mod:error', { message: 'Insufficient permissions to view config.' });
        return;
      }

      const config = await moderationService.getAutoModConfig(data.serverId);
      if (config) {
        socket.emit('mod:config', { config });
      } else {
        socket.emit('mod:error', { message: 'Failed to get auto-mod config.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get config';
      logger.error('mod:get-config error', { error: message });
      socket.emit('mod:error', { message: 'Failed to get auto-mod config.' });
    }
  });

  /**
   * Update auto-mod config
   */
  socket.on('mod:update-config', async (data: { serverId: string; config: Partial<AutoModConfig> }) => {
    try {
      const allowed = await checkSocketPermission(user.userId, data.serverId, 'manage_server');
      if (!allowed) {
        socket.emit('mod:error', { message: 'Insufficient permissions to update config.' });
        return;
      }

      const config = await moderationService.updateAutoModConfig(data.serverId, data.config);
      if (config) {
        io.to(`server:${data.serverId}`).emit('mod:config-updated', { config });
        logger.info(`Auto-mod config updated by ${user.displayName} in server ${data.serverId}`);
      } else {
        socket.emit('mod:error', { message: 'Failed to update auto-mod config.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update config';
      logger.error('mod:update-config error', { error: message });
      socket.emit('mod:error', { message: 'Failed to update auto-mod config.' });
    }
  });
}
