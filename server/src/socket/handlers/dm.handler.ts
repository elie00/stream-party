import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@stream-party/shared';
import { MAX_CHAT_MESSAGE_LENGTH } from '@stream-party/shared';
import { dmService } from '../../services/dmService';
import { notificationService } from '../../services/notificationService';
import { sendNotificationToUser } from './notification.handler';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Map userId -> Set<socketId> for DM routing
const userSockets = new Map<string, Set<string>>();
// Map socketId -> userId for cleanup
const socketToUser = new Map<string, string>();

function registerUserSocket(userId: string, socketId: string) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socketId);
  socketToUser.set(socketId, userId);
}

function unregisterUserSocket(socketId: string) {
  const userId = socketToUser.get(socketId);
  if (userId) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(userId);
      }
    }
    socketToUser.delete(socketId);
  }
}

function emitToUser(io: TypedServer, userId: string, event: string, data: unknown) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event as any, data as any);
    }
  }
}

export function registerDMHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;
  if (!user) return;

  // Register this socket for DM routing
  registerUserSocket(user.userId, socket.id);

  // Join a personal room for DM notifications
  socket.join(`user:${user.userId}`);

  socket.on('dm:get-channels', async () => {
    try {
      const channels = await dmService.getChannels(user.userId);
      socket.emit('dm:channels', { channels });
    } catch (error) {
      console.error('Error getting DM channels:', error);
      socket.emit('dm:error', { message: 'Failed to get channels' });
    }
  });

  socket.on('dm:open', async (data: { targetUserId: string }) => {
    try {
      if (data.targetUserId === user.userId) {
        socket.emit('dm:error', { message: 'Cannot open DM with yourself' });
        return;
      }

      const channel = await dmService.getOrCreateChannel(user.userId, data.targetUserId);

      // Join the DM channel room for real-time updates
      socket.join(`dm:${channel.id}`);

      socket.emit('dm:channel-opened', { channel });
    } catch (error) {
      console.error('Error opening DM channel:', error);
      socket.emit('dm:error', { message: 'Failed to open DM channel' });
    }
  });

  socket.on('dm:send', async (data: { channelId: string; content: string }) => {
    try {
      const content = data.content.trim();
      if (!content || content.length > MAX_CHAT_MESSAGE_LENGTH) {
        socket.emit('dm:error', { message: 'Invalid message content' });
        return;
      }

      const message = await dmService.sendMessage(data.channelId, user.userId, content);

      // Emit to all participants in the channel room
      io.to(`dm:${data.channelId}`).emit('dm:message', { message });

      // Also emit to participants who might not have the channel room joined
      const participantIds = await dmService.getChannelParticipantIds(data.channelId);
      for (const participantId of participantIds) {
        if (participantId !== user.userId) {
          // Send to user's personal room as well
          emitToUser(io, participantId, 'dm:message', { message });

          // Create notification for the recipient
          try {
            const notification = await notificationService.create(participantId, {
              type: 'mention',
              title: `New message from ${user.displayName}`,
              content: content.length > 100 ? content.substring(0, 100) + '...' : content,
              data: { channelId: data.channelId, senderId: user.userId, type: 'dm' },
            });
            if (notification) {
              await sendNotificationToUser(io, participantId, notification);
            }
          } catch {
            // Non-critical, don't fail the message send
          }
        }
      }
    } catch (error) {
      console.error('Error sending DM:', error);
      socket.emit('dm:error', { message: 'Failed to send message' });
    }
  });

  socket.on('dm:history', async (data: { channelId: string; cursor?: string; limit?: number }) => {
    try {
      // Verify user is participant
      const participantIds = await dmService.getChannelParticipantIds(data.channelId);
      if (!participantIds.includes(user.userId)) {
        socket.emit('dm:error', { message: 'Not a participant of this channel' });
        return;
      }

      // Join the channel room for future messages
      socket.join(`dm:${data.channelId}`);

      const messages = await dmService.getMessages(data.channelId, data.limit, data.cursor);
      socket.emit('dm:history', { channelId: data.channelId, messages });
    } catch (error) {
      console.error('Error getting DM history:', error);
      socket.emit('dm:history', { channelId: data.channelId, messages: [] });
    }
  });

  socket.on('dm:typing-start', (data: { channelId: string }) => {
    socket.to(`dm:${data.channelId}`).emit('dm:typing', {
      channelId: data.channelId,
      userId: user.userId,
      isTyping: true,
    });
  });

  socket.on('dm:typing-stop', (data: { channelId: string }) => {
    socket.to(`dm:${data.channelId}`).emit('dm:typing', {
      channelId: data.channelId,
      userId: user.userId,
      isTyping: false,
    });
  });

  socket.on('disconnect', () => {
    unregisterUserSocket(socket.id);
  });
}
