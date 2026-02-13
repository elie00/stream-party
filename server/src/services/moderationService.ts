/**
 * Moderation Service
 * Handles moderation actions, permissions, and logs
 */
import { eq, and, desc, gt, lt, or } from 'drizzle-orm';
import { db } from '../db';
import {
  moderationLogs,
  mutedUsers,
  bannedUsers,
  roles,
  channelPermissions,
  serverMembers,
  servers,
  users,
  autoModConfig,
} from '../db/schema';
import {
  ModerationLog,
  ModerationLogWithUsers,
  MutedUser,
  MutedUserWithDetails,
  BannedUser,
  BannedUserWithDetails,
  AutoModConfig,
  Permission,
  ModAction,
  Role,
} from '@stream-party/shared';
import { logger } from '../utils/logger';

// Default mute duration in minutes
const DEFAULT_MUTE_DURATION = 10;

// Spam tracking: serverId -> userId -> timestamps[]
const spamTracker = new Map<string, Map<string, number[]>>();
const SPAM_WINDOW_MS = 10_000; // 10 seconds

class ModerationService {
  // ===== Moderation Actions =====

  /**
   * Warn a user
   */
  async warn(
    serverId: string,
    targetId: string,
    moderatorId: string,
    reason: string
  ): Promise<ModerationLogWithUsers | null> {
    try {
      // Check if moderator has permission
      const hasPermission = await this.hasPermission(serverId, moderatorId, 'mute_members');
      if (!hasPermission) {
        logger.warn(`User ${moderatorId} lacks permission to warn in server ${serverId}`);
        return null;
      }

      const [log] = await db.insert(moderationLogs).values({
        serverId,
        action: 'warn',
        targetUserId: targetId,
        moderatorId,
        reason,
      }).returning();

      logger.info(`User ${targetId} warned by ${moderatorId} in server ${serverId}`);

      return await this.getLogWithUsers(log.id);
    } catch (error) {
      logger.error('Failed to warn user:', error);
      return null;
    }
  }

  /**
   * Mute a user
   */
  async mute(
    serverId: string,
    targetId: string,
    moderatorId: string,
    reason: string,
    duration?: number
  ): Promise<MutedUserWithDetails | null> {
    try {
      // Check if moderator has permission
      const hasPermission = await this.hasPermission(serverId, moderatorId, 'mute_members');
      if (!hasPermission) {
        logger.warn(`User ${moderatorId} lacks permission to mute in server ${serverId}`);
        return null;
      }

      // Check if user is already muted
      const existingMute = await this.getActiveMute(serverId, targetId);
      if (existingMute) {
        logger.warn(`User ${targetId} is already muted in server ${serverId}`);
        return null;
      }

      const muteDuration = duration || DEFAULT_MUTE_DURATION;
      const expiresAt = new Date(Date.now() + muteDuration * 60 * 1000);

      const [mutedUser] = await db.insert(mutedUsers).values({
        serverId,
        userId: targetId,
        mutedBy: moderatorId,
        reason,
        expiresAt,
      }).returning();

      // Log the action
      await db.insert(moderationLogs).values({
        serverId,
        action: 'mute',
        targetUserId: targetId,
        moderatorId,
        reason,
        duration: muteDuration,
      });

      logger.info(`User ${targetId} muted by ${moderatorId} for ${muteDuration} minutes in server ${serverId}`);

      return await this.getMutedUserWithDetails(mutedUser.id);
    } catch (error) {
      logger.error('Failed to mute user:', error);
      return null;
    }
  }

  /**
   * Unmute a user
   */
  async unmute(serverId: string, targetId: string, moderatorId?: string): Promise<boolean> {
    try {
      // If moderator provided, check permission
      if (moderatorId) {
        const hasPermission = await this.hasPermission(serverId, moderatorId, 'mute_members');
        if (!hasPermission) {
          logger.warn(`User ${moderatorId} lacks permission to unmute in server ${serverId}`);
          return false;
        }
      }

      const result = await db.delete(mutedUsers)
        .where(and(
          eq(mutedUsers.serverId, serverId),
          eq(mutedUsers.userId, targetId)
        ))
        .returning();

      if (result.length > 0) {
        logger.info(`User ${targetId} unmuted in server ${serverId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to unmute user:', error);
      return false;
    }
  }

  /**
   * Kick a user from server
   */
  async kick(
    serverId: string,
    targetId: string,
    moderatorId: string,
    reason: string
  ): Promise<boolean> {
    try {
      // Check if moderator has permission
      const hasPermission = await this.hasPermission(serverId, moderatorId, 'kick_members');
      if (!hasPermission) {
        logger.warn(`User ${moderatorId} lacks permission to kick in server ${serverId}`);
        return false;
      }

      // Cannot kick the server owner
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, serverId),
      });
      if (server && server.ownerId === targetId) {
        logger.warn(`Cannot kick server owner ${targetId}`);
        return false;
      }

      // Remove from server members
      await db.delete(serverMembers)
        .where(and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, targetId)
        ));

      // Log the action
      await db.insert(moderationLogs).values({
        serverId,
        action: 'kick',
        targetUserId: targetId,
        moderatorId,
        reason,
      });

      logger.info(`User ${targetId} kicked by ${moderatorId} from server ${serverId}`);
      return true;
    } catch (error) {
      logger.error('Failed to kick user:', error);
      return false;
    }
  }

  /**
   * Ban a user from server
   */
  async ban(
    serverId: string,
    targetId: string,
    moderatorId: string,
    reason: string
  ): Promise<BannedUserWithDetails | null> {
    try {
      // Check if moderator has permission
      const hasPermission = await this.hasPermission(serverId, moderatorId, 'ban_members');
      if (!hasPermission) {
        logger.warn(`User ${moderatorId} lacks permission to ban in server ${serverId}`);
        return null;
      }

      // Cannot ban the server owner
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, serverId),
      });
      if (server && server.ownerId === targetId) {
        logger.warn(`Cannot ban server owner ${targetId}`);
        return null;
      }

      // Check if already banned
      const existingBan = await this.getBan(serverId, targetId);
      if (existingBan) {
        logger.warn(`User ${targetId} is already banned in server ${serverId}`);
        return null;
      }

      const [bannedUser] = await db.insert(bannedUsers).values({
        serverId,
        userId: targetId,
        bannedBy: moderatorId,
        reason,
      }).returning();

      // Remove from server members
      await db.delete(serverMembers)
        .where(and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, targetId)
        ));

      // Log the action
      await db.insert(moderationLogs).values({
        serverId,
        action: 'ban',
        targetUserId: targetId,
        moderatorId,
        reason,
      });

      logger.info(`User ${targetId} banned by ${moderatorId} from server ${serverId}`);

      return await this.getBannedUserWithDetails(bannedUser.id);
    } catch (error) {
      logger.error('Failed to ban user:', error);
      return null;
    }
  }

  /**
   * Unban a user
   */
  async unban(serverId: string, targetId: string, moderatorId: string): Promise<boolean> {
    try {
      // Check if moderator has permission
      const hasPermission = await this.hasPermission(serverId, moderatorId, 'ban_members');
      if (!hasPermission) {
        logger.warn(`User ${moderatorId} lacks permission to unban in server ${serverId}`);
        return false;
      }

      const result = await db.delete(bannedUsers)
        .where(and(
          eq(bannedUsers.serverId, serverId),
          eq(bannedUsers.userId, targetId)
        ))
        .returning();

      if (result.length > 0) {
        logger.info(`User ${targetId} unbanned in server ${serverId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to unban user:', error);
      return false;
    }
  }

  // ===== Status Checks =====

  /**
   * Check if a user is muted
   */
  async isMuted(serverId: string, userId: string): Promise<boolean> {
    const mute = await this.getActiveMute(serverId, userId);
    return mute !== null;
  }

  /**
   * Get active mute for a user
   */
  async getActiveMute(serverId: string, userId: string): Promise<MutedUser | null> {
    try {
      const now = new Date();
      const result = await db.query.mutedUsers.findFirst({
        where: and(
          eq(mutedUsers.serverId, serverId),
          eq(mutedUsers.userId, userId),
          or(
            gt(mutedUsers.expiresAt, now),
            eq(mutedUsers.expiresAt, null)
          )
        ),
      });

      return result ? this.mapToMutedUser(result) : null;
    } catch (error) {
      logger.error('Failed to check mute status:', error);
      return null;
    }
  }

  /**
   * Check if a user is banned
   */
  async isBanned(serverId: string, userId: string): Promise<boolean> {
    const ban = await this.getBan(serverId, userId);
    return ban !== null;
  }

  /**
   * Get ban for a user
   */
  async getBan(serverId: string, userId: string): Promise<BannedUser | null> {
    try {
      const result = await db.query.bannedUsers.findFirst({
        where: and(
          eq(bannedUsers.serverId, serverId),
          eq(bannedUsers.userId, userId)
        ),
      });

      return result ? this.mapToBannedUser(result) : null;
    } catch (error) {
      logger.error('Failed to check ban status:', error);
      return null;
    }
  }

  // ===== Permissions =====

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(serverId: string, userId: string, permission: Permission): Promise<boolean> {
    try {
      // Check if user is server owner
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, serverId),
      });

      if (server && server.ownerId === userId) {
        return true; // Owner has all permissions
      }

      // Check member role
      const member = await db.query.serverMembers.findFirst({
        where: and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, userId)
        ),
      });

      if (!member) {
        return false;
      }

      // Admin role has all permissions
      if (member.role === 'admin') {
        return true;
      }

      // Moderator has limited permissions
      if (member.role === 'moderator') {
        const moderatorPermissions: Permission[] = [
          'mute_members',
          'kick_members',
          'manage_messages',
        ];
        return moderatorPermissions.includes(permission);
      }

      // Check custom roles
      const userRoles = await db.query.roles.findMany({
        where: eq(roles.serverId, serverId),
      });

      // For now, members don't have special permissions
      // This could be extended to check role-based permissions
      return false;
    } catch (error) {
      logger.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user in a server
   */
  async getUserPermissions(serverId: string, userId: string): Promise<Permission[]> {
    try {
      // Check if user is server owner
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, serverId),
      });

      if (server && server.ownerId === userId) {
        return ['admin', 'manage_channels', 'manage_roles', 'kick_members', 'ban_members', 
                'mute_members', 'manage_messages', 'view_audit_log', 'manage_server'];
      }

      // Check member role
      const member = await db.query.serverMembers.findFirst({
        where: and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, userId)
        ),
      });

      if (!member) {
        return [];
      }

      if (member.role === 'admin') {
        return ['admin', 'manage_channels', 'manage_roles', 'kick_members', 'ban_members',
                'mute_members', 'manage_messages', 'view_audit_log', 'manage_server'];
      }

      if (member.role === 'moderator') {
        return ['mute_members', 'kick_members', 'manage_messages', 'view_audit_log'];
      }

      return [];
    } catch (error) {
      logger.error('Failed to get user permissions:', error);
      return [];
    }
  }

  // ===== Logs =====

  /**
   * Get moderation logs for a server
   */
  async getModerationLogs(serverId: string, limit: number = 50): Promise<ModerationLogWithUsers[]> {
    try {
      const logs = await db.query.moderationLogs.findMany({
        where: eq(moderationLogs.serverId, serverId),
        orderBy: [desc(moderationLogs.createdAt)],
        limit,
      });

      const logsWithUsers: ModerationLogWithUsers[] = [];

      for (const log of logs) {
        const targetUser = await db.query.users.findFirst({
          where: eq(users.id, log.targetUserId),
        });

        const moderator = await db.query.users.findFirst({
          where: eq(users.id, log.moderatorId),
        });

        logsWithUsers.push({
          id: log.id,
          serverId: log.serverId,
          action: log.action as ModAction,
          targetUserId: log.targetUserId,
          moderatorId: log.moderatorId,
          reason: log.reason || undefined,
          duration: log.duration || undefined,
          createdAt: log.createdAt || new Date(),
          targetUser: { displayName: targetUser?.displayName || 'Unknown' },
          moderator: { displayName: moderator?.displayName || 'Unknown' },
        });
      }

      return logsWithUsers;
    } catch (error) {
      logger.error('Failed to get moderation logs:', error);
      return [];
    }
  }

  // ===== Muted/Banned Users Lists =====

  /**
   * Get all muted users for a server
   */
  async getMutedUsers(serverId: string): Promise<MutedUserWithDetails[]> {
    try {
      const now = new Date();
      const muted = await db.query.mutedUsers.findMany({
        where: and(
          eq(mutedUsers.serverId, serverId),
          or(
            gt(mutedUsers.expiresAt, now),
            eq(mutedUsers.expiresAt, null)
          )
        ),
      });

      const results: MutedUserWithDetails[] = [];

      for (const m of muted) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, m.userId),
        });

        const mutedByUser = await db.query.users.findFirst({
          where: eq(users.id, m.mutedBy),
        });

        results.push({
          id: m.id,
          serverId: m.serverId,
          userId: m.userId,
          mutedBy: m.mutedBy,
          reason: m.reason || undefined,
          expiresAt: m.expiresAt || undefined,
          createdAt: m.createdAt || new Date(),
          user: { displayName: user?.displayName || 'Unknown' },
          mutedByUser: { displayName: mutedByUser?.displayName || 'Unknown' },
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to get muted users:', error);
      return [];
    }
  }

  /**
   * Get all banned users for a server
   */
  async getBannedUsers(serverId: string): Promise<BannedUserWithDetails[]> {
    try {
      const banned = await db.query.bannedUsers.findMany({
        where: eq(bannedUsers.serverId, serverId),
      });

      const results: BannedUserWithDetails[] = [];

      for (const b of banned) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, b.userId),
        });

        const bannedByUser = await db.query.users.findFirst({
          where: eq(users.id, b.bannedBy),
        });

        results.push({
          id: b.id,
          serverId: b.serverId,
          userId: b.userId,
          bannedBy: b.bannedBy,
          reason: b.reason || undefined,
          createdAt: b.createdAt || new Date(),
          user: { displayName: user?.displayName || 'Unknown' },
          bannedByUser: { displayName: bannedByUser?.displayName || 'Unknown' },
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to get banned users:', error);
      return [];
    }
  }

  // ===== Auto-Mod Config =====

  /**
   * Get auto-mod config for a server
   */
  async getAutoModConfig(serverId: string): Promise<AutoModConfig | null> {
    try {
      const config = await db.query.autoModConfig.findFirst({
        where: eq(autoModConfig.serverId, serverId),
      });

      if (!config) {
        // Create default config
        const [newConfig] = await db.insert(autoModConfig).values({
          serverId,
        }).returning();

        return this.mapToAutoModConfig(newConfig);
      }

      return this.mapToAutoModConfig(config);
    } catch (error) {
      logger.error('Failed to get auto-mod config:', error);
      return null;
    }
  }

  /**
   * Update auto-mod config for a server
   */
  async updateAutoModConfig(
    serverId: string,
    config: Partial<AutoModConfig>
  ): Promise<AutoModConfig | null> {
    try {
      const existing = await this.getAutoModConfig(serverId);
      if (!existing) {
        return null;
      }

      const [updated] = await db.update(autoModConfig)
        .set({
          enableSpamProtection: config.enableSpamProtection,
          enableLinkFilter: config.enableLinkFilter,
          enableWordFilter: config.enableWordFilter,
          bannedWords: config.bannedWords,
          spamThreshold: config.spamThreshold,
          muteDuration: config.muteDuration,
        })
        .where(eq(autoModConfig.serverId, serverId))
        .returning();

      logger.info(`Updated auto-mod config for server ${serverId}`);

      return this.mapToAutoModConfig(updated);
    } catch (error) {
      logger.error('Failed to update auto-mod config:', error);
      return null;
    }
  }

  /**
   * Check a message against auto-mod rules (word filter, link filter, spam detection)
   */
  async checkMessage(
    serverId: string,
    userId: string,
    content: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const config = await this.getAutoModConfig(serverId);
      if (!config) {
        return { allowed: true };
      }

      // Check word filter
      if (config.enableWordFilter && config.bannedWords.length > 0) {
        const lowerContent = content.toLowerCase();
        for (const word of config.bannedWords) {
          if (lowerContent.includes(word.toLowerCase())) {
            return { allowed: false, reason: `Message contains banned word: ${word}` };
          }
        }
      }

      // Check link filter
      if (config.enableLinkFilter) {
        const urlPattern = /https?:\/\/[^\s]+/i;
        if (urlPattern.test(content)) {
          return { allowed: false, reason: 'Links are not allowed in this server' };
        }
      }

      // Check spam protection
      if (config.enableSpamProtection) {
        const isSpam = this.trackAndCheckSpam(serverId, userId, config.spamThreshold);
        if (isSpam) {
          return { allowed: false, reason: 'Sending messages too quickly (spam detected)' };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check message:', error);
      return { allowed: true };
    }
  }

  // ===== Role Management =====

  /**
   * Create a new role in a server
   */
  async createRole(
    serverId: string,
    name: string,
    color: string,
    permissions: string[]
  ): Promise<Role> {
    try {
      const existingRoles = await db
        .select({ position: roles.position })
        .from(roles)
        .where(eq(roles.serverId, serverId));

      const maxPosition = existingRoles.reduce(
        (max, r) => Math.max(max, r.position ?? 0),
        0
      );

      const [role] = await db
        .insert(roles)
        .values({
          serverId,
          name,
          color,
          permissions,
          position: maxPosition + 1,
          isDefault: false,
        })
        .returning();

      logger.info(`Role "${name}" created in server ${serverId}`);
      return this.mapToRole(role);
    } catch (error) {
      logger.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Update a role
   */
  async updateRole(roleId: number, updates: Partial<Role>): Promise<Role> {
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
      if (updates.position !== undefined) updateData.position = updates.position;

      const [updated] = await db
        .update(roles)
        .set(updateData)
        .where(eq(roles.id, roleId))
        .returning();

      logger.info(`Role ${roleId} updated`);
      return this.mapToRole(updated);
    } catch (error) {
      logger.error('Failed to update role:', error);
      throw error;
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: number): Promise<void> {
    try {
      await db.delete(roles).where(eq(roles.id, roleId));
      logger.info(`Role ${roleId} deleted`);
    } catch (error) {
      logger.error('Failed to delete role:', error);
      throw error;
    }
  }

  /**
   * Get all roles for a server
   */
  async getRoles(serverId: string): Promise<Role[]> {
    try {
      const result = await db
        .select()
        .from(roles)
        .where(eq(roles.serverId, serverId))
        .orderBy(roles.position);

      return result.map(this.mapToRole);
    } catch (error) {
      logger.error('Failed to get roles:', error);
      return [];
    }
  }

  // ===== Cleanup =====

  /**
   * Clean up expired mutes
   */
  async cleanupExpiredMutes(): Promise<number> {
    try {
      const now = new Date();
      const result = await db.delete(mutedUsers)
        .where(lt(mutedUsers.expiresAt, now))
        .returning();

      if (result.length > 0) {
        logger.info(`Cleaned up ${result.length} expired mutes`);
      }

      return result.length;
    } catch (error) {
      logger.error('Failed to cleanup expired mutes:', error);
      return 0;
    }
  }

  // ===== Private Helpers =====

  private async getLogWithUsers(logId: number): Promise<ModerationLogWithUsers | null> {
    try {
      const log = await db.query.moderationLogs.findFirst({
        where: eq(moderationLogs.id, logId),
      });

      if (!log) return null;

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, log.targetUserId),
      });

      const moderator = await db.query.users.findFirst({
        where: eq(users.id, log.moderatorId),
      });

      return {
        id: log.id,
        serverId: log.serverId,
        action: log.action as ModAction,
        targetUserId: log.targetUserId,
        moderatorId: log.moderatorId,
        reason: log.reason || undefined,
        duration: log.duration || undefined,
        createdAt: log.createdAt || new Date(),
        targetUser: { displayName: targetUser?.displayName || 'Unknown' },
        moderator: { displayName: moderator?.displayName || 'Unknown' },
      };
    } catch (error) {
      logger.error('Failed to get log with users:', error);
      return null;
    }
  }

  private async getMutedUserWithDetails(mutedId: number): Promise<MutedUserWithDetails | null> {
    try {
      const muted = await db.query.mutedUsers.findFirst({
        where: eq(mutedUsers.id, mutedId),
      });

      if (!muted) return null;

      const user = await db.query.users.findFirst({
        where: eq(users.id, muted.userId),
      });

      const mutedByUser = await db.query.users.findFirst({
        where: eq(users.id, muted.mutedBy),
      });

      return {
        id: muted.id,
        serverId: muted.serverId,
        userId: muted.userId,
        mutedBy: muted.mutedBy,
        reason: muted.reason || undefined,
        expiresAt: muted.expiresAt || undefined,
        createdAt: muted.createdAt || new Date(),
        user: { displayName: user?.displayName || 'Unknown' },
        mutedByUser: { displayName: mutedByUser?.displayName || 'Unknown' },
      };
    } catch (error) {
      logger.error('Failed to get muted user with details:', error);
      return null;
    }
  }

  private async getBannedUserWithDetails(bannedId: number): Promise<BannedUserWithDetails | null> {
    try {
      const banned = await db.query.bannedUsers.findFirst({
        where: eq(bannedUsers.id, bannedId),
      });

      if (!banned) return null;

      const user = await db.query.users.findFirst({
        where: eq(users.id, banned.userId),
      });

      const bannedByUser = await db.query.users.findFirst({
        where: eq(users.id, banned.bannedBy),
      });

      return {
        id: banned.id,
        serverId: banned.serverId,
        userId: banned.userId,
        bannedBy: banned.bannedBy,
        reason: banned.reason || undefined,
        createdAt: banned.createdAt || new Date(),
        user: { displayName: user?.displayName || 'Unknown' },
        bannedByUser: { displayName: bannedByUser?.displayName || 'Unknown' },
      };
    } catch (error) {
      logger.error('Failed to get banned user with details:', error);
      return null;
    }
  }

  /**
   * Track message timestamps and check for spam
   */
  private trackAndCheckSpam(
    serverId: string,
    userId: string,
    threshold: number
  ): boolean {
    if (!spamTracker.has(serverId)) {
      spamTracker.set(serverId, new Map());
    }

    const serverMap = spamTracker.get(serverId)!;
    if (!serverMap.has(userId)) {
      serverMap.set(userId, []);
    }

    const timestamps = serverMap.get(userId)!;
    const now = Date.now();

    // Remove timestamps outside the window
    const cutoff = now - SPAM_WINDOW_MS;
    const recent = timestamps.filter((t) => t > cutoff);
    recent.push(now);
    serverMap.set(userId, recent);

    return recent.length > threshold;
  }

  private mapToRole(row: typeof roles.$inferSelect): Role {
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      color: row.color ?? '#99AAB5',
      position: row.position ?? 0,
      permissions: (row.permissions as Role['permissions']) ?? [],
      isDefault: row.isDefault ?? false,
    };
  }

  private mapToMutedUser(row: typeof mutedUsers.$inferSelect): MutedUser {
    return {
      id: row.id,
      serverId: row.serverId,
      userId: row.userId,
      mutedBy: row.mutedBy,
      reason: row.reason || undefined,
      expiresAt: row.expiresAt || undefined,
      createdAt: row.createdAt || new Date(),
    };
  }

  private mapToBannedUser(row: typeof bannedUsers.$inferSelect): BannedUser {
    return {
      id: row.id,
      serverId: row.serverId,
      userId: row.userId,
      bannedBy: row.bannedBy,
      reason: row.reason || undefined,
      createdAt: row.createdAt || new Date(),
    };
  }

  private mapToAutoModConfig(row: typeof autoModConfig.$inferSelect): AutoModConfig {
    return {
      id: row.id,
      serverId: row.serverId,
      enableSpamProtection: row.enableSpamProtection || false,
      enableLinkFilter: row.enableLinkFilter || false,
      enableWordFilter: row.enableWordFilter || false,
      bannedWords: row.bannedWords || [],
      spamThreshold: row.spamThreshold || 5,
      muteDuration: row.muteDuration || 10,
    };
  }
}

// Export singleton instance
export const moderationService = new ModerationService();
