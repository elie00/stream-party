/**
 * Channel Socket Handlers
 * Handles channel permissions, slowmode, and settings
 */
import { Server, Socket } from 'socket.io';
import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { permissionsService } from '../../services/permissionsService';
import { slowmodeService } from '../../services/slowmodeService';
import { ChannelPermissionOverride, Channel } from '@stream-party/shared';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerChannelHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Get channel permissions (overrides)
   */
  socket.on('channel:permissions:get', async (data: { channelId: string }, cb: (res: { overrides?: ChannelPermissionOverride[] }) => void) => {
    try {
      const overrides = await permissionsService.getChannelPermissions(data.channelId);
      cb({ overrides });
    } catch (error) {
      logger.error('channel:permissions:get error', { error: String(error) });
      cb({ overrides: [] });
    }
  });

  /**
   * Set channel permission override for a role
   */
  socket.on('channel:permissions:set', async (data: { 
    channelId: string; 
    roleId: number; 
    allow: string[]; 
    deny: string[] 
  }, cb: (res: { success: boolean }) => void) => {
    try {
      // Verify user has permission to manage permissions
      const channel = await db.query.channels.findFirst({
        where: eq(schema.channels.id, data.channelId),
      });

      if (!channel) {
        cb({ success: false });
        return;
      }

      const hasPermission = await permissionsService.hasChannelPermission(
        user.userId,
        data.channelId,
        'manage_permissions'
      );

      if (!hasPermission) {
        cb({ success: false });
        return;
      }

      await permissionsService.setRolePermission(
        data.channelId,
        data.roleId,
        data.allow,
        data.deny
      );

      cb({ success: true });
    } catch (error) {
      logger.error('channel:permissions:set error', { error: String(error) });
      cb({ success: false });
    }
  });

  /**
   * Remove channel permission override
   */
  socket.on('channel:permissions:remove', async (data: { 
    channelId: string; 
    roleId: number 
  }, cb: (res: { success: boolean }) => void) => {
    try {
      const hasPermission = await permissionsService.hasChannelPermission(
        user.userId,
        data.channelId,
        'manage_permissions'
      );

      if (!hasPermission) {
        cb({ success: false });
        return;
      }

      await permissionsService.removeRolePermission(data.channelId, data.roleId);
      cb({ success: true });
    } catch (error) {
      logger.error('channel:permissions:remove error', { error: String(error) });
      cb({ success: false });
    }
  });

  /**
   * Get channel settings (slowmode)
   */
  socket.on('channel:get-settings', async (data: { channelId: string }, cb: (res: { slowmode?: number; slowmodeRoles?: string[] }) => void) => {
    try {
      const settings = await slowmodeService.getSlowmode(data.channelId);
      cb(settings);
    } catch (error) {
      logger.error('channel:get-settings error', { error: String(error) });
      cb({ slowmode: 0, slowmodeRoles: [] });
    }
  });

  /**
   * Set channel slowmode
   */
  socket.on('channel:set-slowmode', async (data: { 
    channelId: string; 
    slowmode: number; 
    slowmodeRoles?: string[] 
  }, cb: (res: { success: boolean }) => void) => {
    try {
      // Verify user has permission to manage channel
      const hasPermission = await permissionsService.hasChannelPermission(
        user.userId,
        data.channelId,
        'manage_channel'
      );

      if (!hasPermission) {
        cb({ success: false });
        return;
      }

      await slowmodeService.setSlowmode(
        data.channelId,
        data.slowmode,
        data.slowmodeRoles || []
      );

      // Notify about slowmode change
      io.to(`channel:${data.channelId}`).emit('channel:slowmode-updated', {
        channelId: data.channelId,
        slowmode: data.slowmode,
        slowmodeRoles: data.slowmodeRoles || [],
      });

      cb({ success: true });
    } catch (error) {
      logger.error('channel:set-slowmode error', { error: String(error) });
      cb({ success: false });
    }
  });

  /**
   * Check if user can send message (slowmode check)
   */
  socket.on('channel:check-slowmode', async (data: { channelId: string }, cb: (res: { allowed: boolean; cooldown?: number }) => void) => {
    try {
      const allowed = await slowmodeService.checkSlowmode(user.userId, data.channelId);
      
      if (!allowed) {
        const cooldown = await slowmodeService.getSlowmodeCooldown(user.userId, data.channelId);
        cb({ allowed: false, cooldown });
        return;
      }

      cb({ allowed: true });
    } catch (error) {
      logger.error('channel:check-slowmode error', { error: String(error) });
      cb({ allowed: true }); // Allow on error
    }
  });

  /**
   * Record a message sent (for slowmode tracking)
   */
  socket.on('channel:message-sent', (data: { channelId: string }) => {
    try {
      slowmodeService.recordMessage(user.userId, data.channelId);
    } catch (error) {
      logger.error('channel:message-sent error', { error: String(error) });
    }
  });

  /**
   * Update channel (name, topic)
   */
  socket.on('channel:update', async (data: { 
    channelId: string; 
    name?: string; 
    topic?: string | null 
  }, cb: (res: { success: boolean; error?: string }) => void) => {
    try {
      const hasPermission = await permissionsService.hasChannelPermission(
        user.userId,
        data.channelId,
        'manage_channel'
      );

      if (!hasPermission) {
        cb({ success: false, error: 'Permission denied' });
        return;
      }

      await db.update(schema.channels)
        .set({
          name: data.name,
          topic: data.topic,
        })
        .where(eq(schema.channels.id, data.channelId));

      // Get updated channel
      const [channel] = await db.select()
        .from(schema.channels)
        .where(eq(schema.channels.id, data.channelId))
        .limit(1);

      if (channel) {
        // Notify server members
        io.to(`server:${channel.serverId}`).emit('server:channel-updated', {
          channel: {
            id: channel.id,
            serverId: channel.serverId,
            name: channel.name,
            type: channel.type as 'text' | 'voice',
            position: channel.position,
            topic: channel.topic,
            createdAt: channel.createdAt,
          },
        });
      }

      cb({ success: true });
    } catch (error) {
      logger.error('channel:update error', { error: String(error) });
      cb({ success: false, error: 'Failed to update channel' });
    }
  });
}

/**
 * Notify channel members about permission changes
 */
export async function notifyChannelPermissionChanged(
  io: AnyServer,
  channelId: string,
  overrides: ChannelPermissionOverride[]
) {
  io.to(`channel:${channelId}`).emit('channel:permissions-updated', {
    channelId,
    overrides,
  });
}

/**
 * Notify channel members about slowmode changes
 */
export async function notifyChannelSlowmodeChanged(
  io: AnyServer,
  channelId: string,
  slowmode: number,
  slowmodeRoles: string[]
) {
  io.to(`channel:${channelId}`).emit('channel:slowmode-updated', {
    channelId,
    slowmode,
    slowmodeRoles,
  });
}
