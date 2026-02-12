/**
 * Notification Socket Handlers
 * Handles notification events (mark read, get notifications, etc.)
 */
import { Server, Socket } from 'socket.io';
import { notificationService } from '../../services/notificationService';
import { logger } from '../../utils/logger';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerNotificationHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Get notifications for the current user
   */
  socket.on('notification:get', async (data: { limit?: number; offset?: number }) => {
    try {
      const limit = Math.min(data.limit || 50, 100);
      const offset = Math.max(data.offset || 0, 0);

      const notifications = await notificationService.getNotifications(
        user.userId,
        limit,
        offset
      );

      socket.emit('notification:list', { notifications });

      logger.debug(`Sent ${notifications.length} notifications to user ${user.displayName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get notifications';
      logger.error('notification:get error', { error: message });
    }
  });

  /**
   * Mark a notification as read
   */
  socket.on('notification:mark-read', async (data: { notificationId: number }) => {
    try {
      const success = await notificationService.markAsRead(data.notificationId, user.userId);

      if (success) {
        socket.emit('notification:read', { notificationId: data.notificationId });

        // Send updated unread count
        const unreadCount = await notificationService.getUnreadCount(user.userId);
        socket.emit('notification:unread-count', { count: unreadCount });

        logger.debug(`User ${user.displayName} marked notification ${data.notificationId} as read`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
      logger.error('notification:mark-read error', { error: message });
    }
  });

  /**
   * Mark all notifications as read
   */
  socket.on('notification:mark-all-read', async () => {
    try {
      const count = await notificationService.markAllAsRead(user.userId);

      if (count > 0) {
        // Send updated unread count (should be 0)
        socket.emit('notification:unread-count', { count: 0 });

        logger.debug(`User ${user.displayName} marked ${count} notifications as read`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read';
      logger.error('notification:mark-all-read error', { error: message });
    }
  });

  /**
   * Get unread notification count
   */
  socket.on('notification:get-unread-count', async () => {
    try {
      const count = await notificationService.getUnreadCount(user.userId);
      socket.emit('notification:unread-count', { count });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get unread count';
      logger.error('notification:get-unread-count error', { error: message });
    }
  });

  /**
   * Send initial unread count on connection
   */
  (async () => {
    try {
      const count = await notificationService.getUnreadCount(user.userId);
      socket.emit('notification:unread-count', { count });
    } catch (error) {
      logger.error('Failed to send initial unread count', { error: String(error) });
    }
  })();
}

/**
 * Send a notification to a specific user via their socket connections
 * This is a helper function to be called from other handlers
 */
export async function sendNotificationToUser(
  io: AnyServer,
  userId: string,
  notification: { id: number; userId: string; type: string; title: string; content?: string; data?: Record<string, unknown>; read: boolean; createdAt: Date }
): Promise<void> {
  // Find all sockets for this user
  const sockets = await io.fetchSockets();
  
  for (const socket of sockets) {
    if (socket.data.user?.userId === userId) {
      socket.emit('notification:new', { notification });
      
      // Also send updated unread count
      const unreadCount = await notificationService.getUnreadCount(userId);
      socket.emit('notification:unread-count', { count: unreadCount });
    }
  }
}
