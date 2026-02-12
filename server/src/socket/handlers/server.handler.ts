/**
 * Server/Community Socket Handlers
 * Handles server join/leave events and member notifications
 */
import { Server, Socket } from 'socket.io';
import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { ServerWithDetails, ServerMemberWithUser, Channel } from '@stream-party/shared';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

// Track which servers each socket is connected to
const socketServers = new Map<string, Set<string>>();

export function registerServerHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Join a server room
   * This is called when a user opens a server in the UI
   */
  socket.on('server:join', async (data: { serverId: string }, cb: (res: { success: boolean; error?: string }) => void) => {
    try {
      const { serverId } = data;

      // Check if user is a member of this server
      const membership = await db.query.serverMembers.findFirst({
        where: and(
          eq(schema.serverMembers.serverId, serverId),
          eq(schema.serverMembers.userId, user.userId)
        ),
      });

      if (!membership) {
        cb({ success: false, error: 'You are not a member of this server' });
        return;
      }

      // Get server details with channels and members
      const server = await db.query.servers.findFirst({
        where: eq(schema.servers.id, serverId),
        with: {
          channels: {
            orderBy: (channels, { asc }) => [asc(channels.position)],
          },
          members: {
            with: {
              user: {
                columns: {
                  displayName: true,
                },
              },
            },
          },
        },
      });

      if (!server) {
        cb({ success: false, error: 'Server not found' });
        return;
      }

      // Join the socket room for this server
      socket.join(`server:${serverId}`);

      // Track this server for the socket
      const servers = socketServers.get(socket.id) || new Set<string>();
      servers.add(serverId);
      socketServers.set(socket.id, servers);

      // Build response
      const serverData: ServerWithDetails = {
        id: server.id,
        name: server.name,
        icon: server.icon,
        description: server.description,
        ownerId: server.ownerId,
        inviteCode: server.inviteCode,
        createdAt: server.createdAt,
        channels: server.channels.map((ch) => ({
          id: ch.id,
          serverId: ch.serverId,
          name: ch.name,
          type: ch.type as 'text' | 'voice',
          position: ch.position,
          topic: ch.topic,
          createdAt: ch.createdAt,
        })),
        members: server.members.map((m) => ({
          id: m.id,
          serverId: m.serverId,
          userId: m.userId,
          role: m.role as 'owner' | 'admin' | 'moderator' | 'member',
          joinedAt: m.joinedAt,
          user: { displayName: m.user.displayName },
        })),
      };

      // Notify other server members that this user is now online
      socket.to(`server:${serverId}`).emit('server:member-online', {
        serverId,
        userId: user.userId,
        displayName: user.displayName,
      });

      cb({ success: true });
      socket.emit('server:joined', serverData);

      logger.info(`User joined server room`, {
        userId: user.userId,
        serverId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join server';
      cb({ success: false, error: message });
      logger.error('server:join error', { error: message });
    }
  });

  /**
   * Leave a server room
   */
  socket.on('server:leave', (data: { serverId: string }) => {
    try {
      const { serverId } = data;

      // Leave the socket room
      socket.leave(`server:${serverId}`);

      // Remove from tracking
      const servers = socketServers.get(socket.id);
      if (servers) {
        servers.delete(serverId);
        if (servers.size === 0) {
          socketServers.delete(socket.id);
        }
      }

      // Notify other server members
      socket.to(`server:${serverId}`).emit('server:member-offline', {
        serverId,
        userId: user.userId,
      });

      socket.emit('server:left', { serverId });

      logger.info(`User left server room`, {
        userId: user.userId,
        serverId,
      });
    } catch (error) {
      logger.error('server:leave error', { error: String(error) });
    }
  });

  /**
   * Handle disconnect - leave all server rooms
   */
  socket.on('disconnect', async () => {
    try {
      const servers = socketServers.get(socket.id);
      if (servers) {
        for (const serverId of servers) {
          // Notify other server members
          socket.to(`server:${serverId}`).emit('server:member-offline', {
            serverId,
            userId: user.userId,
          });

          // Leave the socket room
          socket.leave(`server:${serverId}`);
        }
        socketServers.delete(socket.id);
      }
    } catch (error) {
      logger.error('Server disconnect error', { error: String(error) });
    }
  });
}

/**
 * Notify all members of a server about a new member
 */
export async function notifyServerMemberJoined(
  io: AnyServer,
  serverId: string,
  member: ServerMemberWithUser
) {
  io.to(`server:${serverId}`).emit('server:member-joined', {
    serverId,
    member,
  });
}

/**
 * Notify all members of a server about a member leaving
 */
export async function notifyServerMemberLeft(
  io: AnyServer,
  serverId: string,
  userId: string
) {
  io.to(`server:${serverId}`).emit('server:member-left', {
    serverId,
    userId,
  });
}

/**
 * Notify all members of a server about a new channel
 */
export async function notifyServerChannelCreated(
  io: AnyServer,
  serverId: string,
  channel: Channel
) {
  io.to(`server:${serverId}`).emit('server:channel-created', {
    serverId,
    channel,
  });
}

/**
 * Notify all members of a server about a channel being deleted
 */
export async function notifyServerChannelDeleted(
  io: AnyServer,
  serverId: string,
  channelId: string
) {
  io.to(`server:${serverId}`).emit('server:channel-deleted', {
    serverId,
    channelId,
  });
}
