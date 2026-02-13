/**
 * Presence Socket Handlers
 * Handles user presence status events
 */
import { Server, Socket } from 'socket.io';
import { presenceService } from '../../services/presenceService';
import { PresenceStatus, UserPresence, UserActivity } from '@stream-party/shared';
import { getRoomBySocket } from '../roomState';
import { logger } from '../../utils/logger';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerPresenceHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Set user status (online, idle, dnd, offline)
   */
  socket.on('presence:status', async (data: { status: PresenceStatus }) => {
    try {
      const presence = await presenceService.setStatus(user.userId, data.status);

      if (presence) {
        // Notify all rooms the user is in about the status change
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        
        for (const roomCode of rooms) {
          io.to(roomCode).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }

        logger.debug(`User ${user.displayName} set status to ${data.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set status';
      logger.error('presence:status error', { error: message });
    }
  });

  /**
   * Set custom status message with optional emoji
   */
  socket.on('presence:custom', async (data: { customStatus: string | null; statusEmoji?: string | null }) => {
    try {
      const presence = await presenceService.setCustomStatus(user.userId, data.customStatus, data.statusEmoji ?? null);

      if (presence) {
        // Notify all rooms the user is in
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        
        for (const roomCode of rooms) {
          io.to(roomCode).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }

        logger.debug(`User ${user.displayName} set custom status: ${data.customStatus || '(cleared)'}${data.statusEmoji ? ' ' + data.statusEmoji : ''}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set custom status';
      logger.error('presence:custom error', { error: message });
    }
  });

  /**
   * Set user activity (Watching, Playing, Listening)
   */
  socket.on('presence:activity', async (data: { activity: UserActivity | null }) => {
    try {
      const presence = await presenceService.setActivity(user.userId, data.activity);

      if (presence) {
        // Notify all rooms the user is in
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        
        for (const roomCode of rooms) {
          io.to(roomCode).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }

        logger.debug(`User ${user.displayName} set activity: ${data.activity ? data.activity.type + ' ' + data.activity.name : '(cleared)'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set activity';
      logger.error('presence:activity error', { error: message });
    }
  });

  /**
   * Get user status data
   */
  socket.on('presence:get', async (data: { userId: string }) => {
    try {
      const presence = await presenceService.getUserStatus(data.userId);
      
      if (presence) {
        socket.emit('presence:data', { presence });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get presence';
      logger.error('presence:get error', { error: message });
    }
  });

  /**
   * Set user status (legacy - backward compatibility)
   */
  socket.on('presence:set', async (data: { status: PresenceStatus }) => {
    try {
      const presence = await presenceService.setStatus(user.userId, data.status);

      if (presence) {
        // Notify all rooms the user is in about the status change
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        
        for (const roomCode of rooms) {
          io.to(roomCode).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }

        logger.debug(`User ${user.displayName} set status to ${data.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set status';
      logger.error('presence:set error', { error: message });
    }
  });

  /**
   * Set custom status message
   */
  socket.on('presence:custom-status', async (data: { customStatus: string | null }) => {
    try {
      const presence = await presenceService.setCustomStatus(user.userId, data.customStatus);

      if (presence) {
        // Notify all rooms the user is in
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        
        for (const roomCode of rooms) {
          io.to(roomCode).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }

        logger.debug(`User ${user.displayName} set custom status: ${data.customStatus || '(cleared)'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set custom status';
      logger.error('presence:custom-status error', { error: message });
    }
  });

  /**
   * Request presence for multiple users
   */
  socket.on('presence:request', async (data: { userIds: string[] }) => {
    try {
      if (!data.userIds || data.userIds.length === 0) {
        return;
      }

      // Limit the number of users to request at once
      const limitedUserIds = data.userIds.slice(0, 100);

      const presences = await presenceService.getStatuses(limitedUserIds);
      
      // Convert Map to Record for socket emission
      const presencesRecord: Record<string, UserPresence> = {};
      presences.forEach((presence, userId) => {
        presencesRecord[userId] = presence;
      });

      socket.emit('presence:bulk', { presences: presencesRecord });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get presences';
      logger.error('presence:request error', { error: message });
    }
  });

  /**
   * Handle connection - register user presence
   */
  (async () => {
    try {
      const presence = await presenceService.registerConnection(user.userId, socket.id);
      
      if (presence) {
        // Notify rooms about user coming online
        const room = getRoomBySocket(socket.id);
        if (room) {
          io.to(room.code).emit('presence:update', {
            userId: user.userId,
            presence,
          });
        }
      }
    } catch (error) {
      logger.error('Presence registration error', { error: String(error) });
    }
  })();

  /**
   * Handle disconnect - unregister user presence
   */
  socket.on('disconnect', async () => {
    try {
      const result = await presenceService.unregisterConnection(socket.id);
      
      if (result && result.isOffline) {
        // User is fully offline, notify rooms
        const room = getRoomBySocket(socket.id);
        if (room) {
          const presence = await presenceService.getStatus(result.userId);
          if (presence) {
            io.to(room.code).emit('presence:update', {
              userId: result.userId,
              presence,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Presence disconnect error', { error: String(error) });
    }
  });
}
