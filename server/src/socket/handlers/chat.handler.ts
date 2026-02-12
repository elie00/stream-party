import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, ChatMessage } from '@stream-party/shared';
import { MAX_CHAT_MESSAGE_LENGTH, CHAT_RATE_LIMIT } from '@stream-party/shared';
import { db, schema } from '../../db/index';
import { eq, desc, lt, and } from 'drizzle-orm';
import { getRoomBySocket } from '../roomState';
import { validateChatMessage } from '../../utils/validators';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Rate limiting state per socket: socketId -> array of message timestamps
const rateLimits = new Map<string, number[]>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(socketId) || [];
  // Remove timestamps outside the window
  const recent = timestamps.filter((t) => now - t < CHAT_RATE_LIMIT.windowMs);
  rateLimits.set(socketId, recent);
  return recent.length >= CHAT_RATE_LIMIT.maxMessages;
}

function recordMessage(socketId: string): void {
  const timestamps = rateLimits.get(socketId) || [];
  timestamps.push(Date.now());
  rateLimits.set(socketId, timestamps);
}

export function registerChatHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  socket.on('chat:message', async (data: { content: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      // Validate and sanitize content
      const validation = validateChatMessage(data.content, MAX_CHAT_MESSAGE_LENGTH);
      if (!validation.isValid) {
        socket.emit('error', validation.error || 'Invalid message');
        return;
      }

      // Rate limit check
      if (isRateLimited(socket.id)) {
        socket.emit('error', 'Rate limited: sending messages too fast');
        return;
      }
      recordMessage(socket.id);

      // Persist to database
      const [message] = await db
        .insert(schema.messages)
        .values({
          roomId: room.dbRoomId,
          userId: user.userId,
          content: validation.sanitized,
        })
        .returning();

      // Build chat message payload
      const chatMessage: ChatMessage = {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        createdAt: message.createdAt,
        user: { displayName: user.displayName },
      };

      // Broadcast to everyone in the room (including sender)
      io.to(room.code).emit('chat:message', chatMessage);
    } catch (error) {
      console.error('Error sending chat message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  socket.on('chat:history', async (data: { cursor?: string; limit?: number }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      const limit = Math.min(data.limit || 50, 50);

      let messages: Array<{ id: string; roomId: string; userId: string; content: string; createdAt: Date; user: { displayName: string } | null }>;

      if (data.cursor) {
        // Cursor-based pagination: get messages older than cursor
        const cursorMsg = await db.query.messages.findFirst({
          where: eq(schema.messages.id, data.cursor),
        });

        if (cursorMsg) {
          messages = await db.query.messages.findMany({
            where: and(
              eq(schema.messages.roomId, room.dbRoomId),
              lt(schema.messages.createdAt, cursorMsg.createdAt),
            ),
            orderBy: desc(schema.messages.createdAt),
            limit,
            with: {
              user: true,
            },
          });
        } else {
          messages = [];
        }
      } else {
        // Initial load: get most recent messages
        messages = await db.query.messages.findMany({
          where: eq(schema.messages.roomId, room.dbRoomId),
          orderBy: desc(schema.messages.createdAt),
          limit,
          with: {
            user: true,
          },
        });
      }

      // Reverse so messages are in chronological order (oldest first)
      const chatMessages: ChatMessage[] = (messages || []).reverse().map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        content: m.content,
        createdAt: m.createdAt,
        user: { displayName: m.user?.displayName || 'Unknown' },
      }));

      socket.emit('chat:history', chatMessages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      socket.emit('chat:history', []);
    }
  });

  socket.on('chat:typing-start', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    socket.to(room.code).emit('chat:typing', { userId: user.userId, isTyping: true });
  });

  socket.on('chat:typing-stop', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    socket.to(room.code).emit('chat:typing', { userId: user.userId, isTyping: false });
  });

  // Cleanup rate limit state on disconnect
  socket.on('disconnect', () => {
    rateLimits.delete(socket.id);
  });
}
