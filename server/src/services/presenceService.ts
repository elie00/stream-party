/**
 * Presence Service
 * Manages user presence status (online, idle, dnd, offline)
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { userPresence, users } from '../db/schema';
import { PresenceStatus, UserPresence } from '@stream-party/shared';
import { logger } from '../utils/logger';

// In-memory presence cache for fast access
// Map<userId, UserPresence>
const presenceCache = new Map<string, UserPresence>();

// Map<userId, Set<socketId>> for tracking connections per user
const userSockets = new Map<string, Set<string>>();

// Map<socketId, userId> for reverse lookup
const socketToUser = new Map<string, string>();

class PresenceService {
  /**
   * Initialize presence for a user (called on first connection)
   */
  async initializePresence(userId: string): Promise<UserPresence> {
    // Check cache first
    const cached = presenceCache.get(userId);
    if (cached) {
      return cached;
    }

    // Check database
    let presence = await this.getPresenceFromDb(userId);

    if (!presence) {
      // Create new presence record
      const [newPresence] = await db.insert(userPresence).values({
        userId,
        status: 'online',
        customStatus: null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      presence = {
        userId: newPresence.userId,
        status: newPresence.status as PresenceStatus,
        customStatus: newPresence.customStatus,
        lastSeenAt: newPresence.lastSeenAt ?? new Date(),
      };
    }

    // Update cache
    presenceCache.set(userId, presence);

    return presence;
  }

  /**
   * Register a socket connection for a user
   */
  async registerConnection(userId: string, socketId: string): Promise<UserPresence | null> {
    // Track socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socketId);
    socketToUser.set(socketId, userId);

    // Initialize presence if needed
    const presence = await this.initializePresence(userId);

    // Set online if currently offline
    if (presence.status === 'offline') {
      await this.setStatus(userId, 'online');
    }

    logger.debug(`User ${userId} connected via socket ${socketId}`);

    return presenceCache.get(userId) || null;
  }

  /**
   * Unregister a socket connection
   */
  async unregisterConnection(socketId: string): Promise<{ userId: string; isOffline: boolean } | null> {
    const userId = socketToUser.get(socketId);
    if (!userId) return null;

    // Remove socket
    socketToUser.delete(socketId);
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        // No more connections, mark offline
        userSockets.delete(userId);
        await this.markOffline(userId);
        return { userId, isOffline: true };
      }
    }

    logger.debug(`User ${userId} disconnected socket ${socketId}`);
    return { userId, isOffline: false };
  }

  /**
   * Set user status
   */
  async setStatus(userId: string, status: PresenceStatus): Promise<UserPresence | null> {
    const now = new Date();

    // Update database
    await db.update(userPresence)
      .set({
        status,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userPresence.userId, userId));

    // Update cache
    const cached = presenceCache.get(userId);
    if (cached) {
      cached.status = status;
      cached.lastSeenAt = now;
    } else {
      // Create in cache
      presenceCache.set(userId, {
        userId,
        status,
        customStatus: null,
        lastSeenAt: now,
      });
    }

    logger.info(`User ${userId} status changed to ${status}`);

    return presenceCache.get(userId) || null;
  }

  /**
   * Set custom status message
   */
  async setCustomStatus(userId: string, customStatus: string | null): Promise<UserPresence | null> {
    const now = new Date();

    // Update database
    await db.update(userPresence)
      .set({
        customStatus,
        updatedAt: now,
      })
      .where(eq(userPresence.userId, userId));

    // Update cache
    const cached = presenceCache.get(userId);
    if (cached) {
      cached.customStatus = customStatus;
    } else {
      // Need to fetch from DB first
      const presence = await this.getPresenceFromDb(userId);
      if (presence) {
        presence.customStatus = customStatus;
        presenceCache.set(userId, presence);
      }
    }

    logger.info(`User ${userId} custom status set to: ${customStatus || '(cleared)'}`);

    return presenceCache.get(userId) || null;
  }

  /**
   * Mark user as offline
   */
  async markOffline(userId: string): Promise<void> {
    const now = new Date();

    // Update database
    await db.update(userPresence)
      .set({
        status: 'offline',
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userPresence.userId, userId));

    // Update cache
    const cached = presenceCache.get(userId);
    if (cached) {
      cached.status = 'offline';
      cached.lastSeenAt = now;
    }

    logger.info(`User ${userId} marked as offline`);
  }

  /**
   * Get presence for a single user
   */
  async getStatus(userId: string): Promise<UserPresence | null> {
    // Check cache first
    const cached = presenceCache.get(userId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const presence = await this.getPresenceFromDb(userId);
    if (presence) {
      presenceCache.set(userId, presence);
    }

    return presence;
  }

  /**
   * Get presence for multiple users
   */
  async getStatuses(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const userId of userIds) {
      const cached = presenceCache.get(userId);
      if (cached) {
        result.set(userId, cached);
      } else {
        uncachedIds.push(userId);
      }
    }

    // Fetch uncached from database
    if (uncachedIds.length > 0) {
      const presences = await db.query.userPresence.findMany({
        where: inArray(userPresence.userId, uncachedIds),
      });

      for (const p of presences) {
        const presence: UserPresence = {
          userId: p.userId,
          status: p.status as PresenceStatus,
          customStatus: p.customStatus,
          lastSeenAt: p.lastSeenAt ?? new Date(),
        };
        result.set(p.userId, presence);
        presenceCache.set(p.userId, presence);
      }
    }

    return result;
  }

  /**
   * Get presence from database
   */
  private async getPresenceFromDb(userId: string): Promise<UserPresence | null> {
    const presence = await db.query.userPresence.findFirst({
      where: eq(userPresence.userId, userId),
    });

    if (!presence) return null;

    return {
      userId: presence.userId,
      status: presence.status as PresenceStatus,
      customStatus: presence.customStatus,
      lastSeenAt: presence.lastSeenAt ?? new Date(),
    };
  }

  /**
   * Get all online users in a list
   */
  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    const presences = await this.getStatuses(userIds);
    return Array.from(presences.entries())
      .filter(([_, p]) => p.status !== 'offline')
      .map(([userId]) => userId);
  }

  /**
   * Check if a user is online
   */
  isUserOnline(userId: string): boolean {
    const sockets = userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Get all socket IDs for a user
   */
  getUserSockets(userId: string): string[] {
    const sockets = userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Clear cache for a user (useful for testing)
   */
  clearCache(userId: string): void {
    presenceCache.delete(userId);
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearAllCaches(): void {
    presenceCache.clear();
    userSockets.clear();
    socketToUser.clear();
  }
}

// Export singleton instance
export const presenceService = new PresenceService();
