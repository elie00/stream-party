/**
 * Notification Service
 * Manages user notifications (mentions, replies, reactions, etc.)
 */
import { eq, desc, and, lt } from 'drizzle-orm';
import { db } from '../db';
import { notifications } from '../db/schema';
import { Notification, NotificationType, CreateNotificationInput } from '@stream-party/shared';
import { notificationPreferencesService } from './notificationPreferencesService';
import { logger } from '../utils/logger';

// Default number of days to keep notifications
const DEFAULT_DAYS_TO_KEEP = 30;

// Rate limiting for notifications (per user per type)
const NOTIFICATION_COOLDOWN_MS = 5000; // 5 seconds
const notificationCooldowns = new Map<string, Map<string, number>>();

class NotificationService {
  /**
   * Create a new notification (checks preferences)
   */
  async create(userId: string, input: CreateNotificationInput): Promise<Notification | null> {
    // Check rate limiting
    if (this.isRateLimited(userId, input.type)) {
      logger.debug(`Notification rate limited for user ${userId}, type ${input.type}`);
      return null;
    }

    // Check notification preferences
    const shouldNotify = await this.checkPreferences(userId, input.type);
    if (!shouldNotify) {
      logger.debug(`Notification blocked by preferences for user ${userId}, type ${input.type}`);
      return null;
    }

    try {
      const [notification] = await db.insert(notifications).values({
        userId,
        type: input.type,
        title: input.title,
        content: input.content || null,
        data: input.data || null,
        read: false,
      }).returning();

      // Update rate limit
      this.setRateLimit(userId, input.type);

      logger.info(`Created notification for user ${userId}: ${input.title}`);

      return this.mapToNotification(notification);
    } catch (error) {
      logger.error('Failed to create notification:', error);
      return null;
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private async checkPreferences(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    try {
      switch (type) {
        case 'mention':
          return await notificationPreferencesService.shouldNotify(userId, 'mention');
        case 'reply':
          return await notificationPreferencesService.shouldNotify(userId, 'mention');
        case 'reaction':
          // Reactions are less intrusive, could have separate setting
          return true;
        case 'join':
          return await notificationPreferencesService.shouldNotify(userId, 'mention');
        case 'file':
          return await notificationPreferencesService.shouldNotify(userId, 'mention');
        case 'system':
          return true; // System notifications always go through
        default:
          return true;
      }
    } catch (error) {
      // If preferences check fails, allow notification
      logger.warn('Failed to check notification preferences, allowing notification');
      return true;
    }
  }

  /**
   * Create multiple notifications at once
   */
  async createBulk(
    users: { userId: string; input: CreateNotificationInput }[]
  ): Promise<Notification[]> {
    const results: Notification[] = [];

    for (const { userId, input } of users) {
      const notification = await this.create(userId, input);
      if (notification) {
        results.push(notification);
      }
    }

    return results;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number, userId: string): Promise<boolean> {
    try {
      const result = await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return result.length > 0;
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ))
        .returning();

      logger.info(`Marked ${result.length} notifications as read for user ${userId}`);
      return result.length;
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    try {
      const result = await db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: [desc(notifications.createdAt)],
        limit,
        offset,
      });

      return result.map(this.mapToNotification);
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      return [];
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await db.query.notifications.findMany({
        where: and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ),
        columns: {
          id: true,
        },
      });

      return result.length;
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysToKeep: number = DEFAULT_DAYS_TO_KEEP): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await db.delete(notifications)
        .where(lt(notifications.createdAt, cutoffDate))
        .returning();

      logger.info(`Cleaned up ${result.length} old notifications`);
      return result.length;
    } catch (error) {
      logger.error('Failed to cleanup old notifications:', error);
      return 0;
    }
  }

  /**
   * Delete a specific notification
   */
  async deleteNotification(notificationId: number, userId: string): Promise<boolean> {
    try {
      const result = await db.delete(notifications)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return result.length > 0;
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      return false;
    }
  }

  /**
   * Create a mention notification
   */
  async createMentionNotification(
    mentionedUserId: string,
    mentionerName: string,
    roomId: string,
    roomName: string,
    messagePreview: string
  ): Promise<Notification | null> {
    return this.create(mentionedUserId, {
      type: 'mention',
      title: `${mentionerName} vous a mentionné`,
      content: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview,
      data: {
        roomId,
        roomName,
        mentionerName,
      },
    });
  }

  /**
   * Create a reaction notification
   */
  async createReactionNotification(
    messageUserId: string,
    reactorName: string,
    emoji: string,
    messageId: string,
    roomId: string
  ): Promise<Notification | null> {
    return this.create(messageUserId, {
      type: 'reaction',
      title: `${reactorName} a réagi ${emoji}`,
      content: 'À votre message',
      data: {
        messageId,
        roomId,
        emoji,
        reactorName,
      },
    });
  }

  /**
   * Create a join notification (for room hosts)
   */
  async createJoinNotification(
    hostId: string,
    userName: string,
    roomId: string,
    roomName: string
  ): Promise<Notification | null> {
    return this.create(hostId, {
      type: 'join',
      title: `${userName} a rejoint ${roomName}`,
      content: 'Un nouveau participant a rejoint votre room',
      data: {
        roomId,
        userName,
      },
    });
  }

  /**
   * Create a system notification
   */
  async createSystemNotification(
    userId: string,
    title: string,
    content?: string,
    data?: Record<string, unknown>
  ): Promise<Notification | null> {
    return this.create(userId, {
      type: 'system',
      title,
      content,
      data,
    });
  }

  /**
   * Check if a notification is rate limited for a user
   */
  private isRateLimited(userId: string, type: NotificationType): boolean {
    const userCooldowns = notificationCooldowns.get(userId);
    if (!userCooldowns) return false;

    const lastNotification = userCooldowns.get(type);
    if (!lastNotification) return false;

    return Date.now() - lastNotification < NOTIFICATION_COOLDOWN_MS;
  }

  /**
   * Set rate limit for a user notification type
   */
  private setRateLimit(userId: string, type: NotificationType): void {
    if (!notificationCooldowns.has(userId)) {
      notificationCooldowns.set(userId, new Map());
    }
    notificationCooldowns.get(userId)!.set(type, Date.now());
  }

  /**
   * Map database result to Notification type
   */
  private mapToNotification(row: typeof notifications.$inferSelect): Notification {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type as NotificationType,
      title: row.title,
      content: row.content || undefined,
      data: row.data || undefined,
      read: row.read || false,
      createdAt: row.createdAt || new Date(),
    };
  }

  /**
   * Clear rate limit cache for a user (useful for testing)
   */
  clearRateLimitCache(userId?: string): void {
    if (userId) {
      notificationCooldowns.delete(userId);
    } else {
      notificationCooldowns.clear();
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
