/**
 * Notification Preferences Service
 * Manages user notification preferences
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { notificationPreferences } from '../db/schema';
import { NotificationPreferences } from '@stream-party/shared';
import { logger } from '../utils/logger';

// Default preferences
const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId'> = {
  allMessages: false,
  mentions: true,
  directMessages: true,
  serverInvites: true,
  friendRequests: true,
  sounds: true,
  desktopNotifications: true,
  notificationDuration: 5,
  mutedServers: [],
  mutedChannels: [],
};

class NotificationPreferencesService {
  /**
   * Get preferences for a user
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (!prefs) {
      // Create default preferences
      return this.createDefaultPreferences(userId);
    }

    return {
      userId: prefs.userId,
      allMessages: prefs.allMessages,
      mentions: prefs.mentions,
      directMessages: prefs.directMessages,
      serverInvites: prefs.serverInvites,
      friendRequests: prefs.friendRequests,
      sounds: prefs.sounds,
      desktopNotifications: prefs.desktopNotifications,
      notificationDuration: prefs.notificationDuration,
      mutedServers: prefs.mutedServers ?? [],
      mutedChannels: prefs.mutedChannels ?? [],
    };
  }

  /**
   * Create default preferences for a user
   */
  private async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const [prefs] = await db.insert(notificationPreferences)
      .values({
        userId,
        ...DEFAULT_PREFERENCES,
      })
      .returning();

    return {
      userId: prefs.userId,
      allMessages: prefs.allMessages,
      mentions: prefs.mentions,
      directMessages: prefs.directMessages,
      serverInvites: prefs.serverInvites,
      friendRequests: prefs.friendRequests,
      sounds: prefs.sounds,
      desktopNotifications: prefs.desktopNotifications,
      notificationDuration: prefs.notificationDuration,
      mutedServers: prefs.mutedServers ?? [],
      mutedChannels: prefs.mutedChannels ?? [],
    };
  }

  /**
   * Update preferences for a user
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, 'userId'>>
  ): Promise<NotificationPreferences> {
    // First ensure preferences exist
    const existing = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (!existing) {
      // Create with defaults first, then update
      const defaultPrefs = await this.createDefaultPreferences(userId);
      return this.updatePreferences(userId, updates);
    }

    const [updated] = await db.update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    logger.info(`Notification preferences updated for user ${userId}`);

    return {
      userId: updated.userId,
      allMessages: updated.allMessages,
      mentions: updated.mentions,
      directMessages: updated.directMessages,
      serverInvites: updated.serverInvites,
      friendRequests: updated.friendRequests,
      sounds: updated.sounds,
      desktopNotifications: updated.desktopNotifications,
      notificationDuration: updated.notificationDuration,
      mutedServers: updated.mutedServers ?? [],
      mutedChannels: updated.mutedChannels ?? [],
    };
  }

  /**
   * Mute/unmute a server
   */
  async toggleServerMute(userId: string, serverId: string, muted: boolean): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);
    const mutedServers = muted
      ? [...prefs.mutedServers, serverId]
      : prefs.mutedServers.filter(id => id !== serverId);

    return this.updatePreferences(userId, { mutedServers });
  }

  /**
   * Mute/unmute a channel
   */
  async toggleChannelMute(userId: string, channelId: string, muted: boolean): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId);
    const mutedChannels = muted
      ? [...prefs.mutedChannels, channelId]
      : prefs.mutedChannels.filter(id => id !== channelId);

    return this.updatePreferences(userId, { mutedChannels });
  }

  /**
   * Check if notifications should be sent based on preferences
   */
  async shouldNotify(
    userId: string,
    type: 'mention' | 'directMessage' | 'serverInvite' | 'friendRequest' | 'allMessages'
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    switch (type) {
      case 'mention':
        return prefs.mentions;
      case 'directMessage':
        return prefs.directMessages;
      case 'serverInvite':
        return prefs.serverInvites;
      case 'friendRequest':
        return prefs.friendRequests;
      case 'allMessages':
        return prefs.allMessages;
      default:
        return true;
    }
  }

  /**
   * Check if a server is muted
   */
  async isServerMuted(userId: string, serverId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.mutedServers.includes(serverId);
  }

  /**
   * Check if a channel is muted
   */
  async isChannelMuted(userId: string, channelId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.mutedChannels.includes(channelId);
  }
}

// Export singleton instance
export const notificationPreferencesService = new NotificationPreferencesService();
