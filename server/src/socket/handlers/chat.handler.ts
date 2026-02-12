import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, ChatMessage, MessageEmbed } from '@stream-party/shared';
import { MAX_CHAT_MESSAGE_LENGTH, CHAT_RATE_LIMIT } from '@stream-party/shared';
import { db, schema } from '../../db/index';
import { eq, desc, lt, and } from 'drizzle-orm';
import { getRoomBySocket, getRoomParticipants } from '../roomState';
import { validateChatMessage } from '../../utils/validators';
import { generateEmbedsForMessage } from '../../services/embedService';
import { notificationService } from '../../services/notificationService';
import { sendNotificationToUser } from './notification.handler';

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

/**
 * Extract mentions from message content
 * Matches @username patterns
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_\-\s]+?)(?=\s|$|[^a-zA-Z0-9_\-\s])/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1].trim();
    if (username && !mentions.includes(username)) {
      mentions.push(username);
    }
  }
  
  return mentions;
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
        reactions: [],
        embeds: [],
      };

      // Broadcast to everyone in the room (including sender)
      io.to(room.code).emit('chat:message', chatMessage);

      // Handle mentions - create notifications for mentioned users
      const mentions = extractMentions(validation.sanitized);
      if (mentions.length > 0) {
        // Get room participants to find mentioned users
        const participants = getRoomParticipants(room.code);
        
        for (const mentionName of mentions) {
          // Find user by display name (case-insensitive)
          const mentionedParticipant = participants.find(
            p => p.displayName.toLowerCase() === mentionName.toLowerCase()
          );
          
          if (mentionedParticipant && mentionedParticipant.userId !== user.userId) {
            // Create mention notification
            const notification = await notificationService.createMentionNotification(
              mentionedParticipant.userId,
              user.displayName,
              room.dbRoomId,
              room.name,
              validation.sanitized
            );
            
            if (notification) {
              // Send real-time notification to the mentioned user
              await sendNotificationToUser(io, mentionedParticipant.userId, notification);
            }
          }
        }
      }

      // Generate embeds asynchronously (don't block the response)
      generateEmbedsForMessage(validation.sanitized)
        .then(async (embedsData) => {
          for (const embedData of embedsData) {
            try {
              const [embed] = await db
                .insert(schema.messageEmbeds)
                .values({
                  messageId: message.id,
                  type: embedData.type,
                  url: embedData.url,
                  title: embedData.title,
                  description: embedData.description,
                  image: embedData.image,
                  siteName: embedData.siteName,
                })
                .returning();

              const messageEmbed: MessageEmbed = {
                id: embed.id,
                messageId: embed.messageId,
                type: embed.type as MessageEmbed['type'],
                url: embed.url,
                title: embed.title || undefined,
                description: embed.description || undefined,
                image: embed.image || undefined,
                siteName: embed.siteName || undefined,
                createdAt: embed.createdAt,
              };

              io.to(room.code).emit('embed:generated', {
                messageId: message.id,
                embed: messageEmbed,
              });
            } catch (embedError) {
              console.error('Error saving embed:', embedError);
            }
          }
        })
        .catch((embedError) => {
          console.error('Error generating embeds:', embedError);
        });
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

      type MessageWithRelations = {
        id: string;
        roomId: string;
        userId: string;
        content: string;
        createdAt: Date;
        user: { displayName: string } | null;
        reactions: Array<{ id: string; messageId: string; userId: string; emoji: string; createdAt: Date }>;
        embeds: Array<{ id: string; messageId: string; type: string; url: string; title: string | null; description: string | null; image: string | null; siteName: string | null; createdAt: Date }>;
      };

      let messages: MessageWithRelations[];

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
              reactions: true,
              embeds: true,
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
            reactions: true,
            embeds: true,
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
        reactions: m.reactions?.map((r) => ({
          id: r.id,
          messageId: r.messageId,
          userId: r.userId,
          emoji: r.emoji,
          createdAt: r.createdAt,
        })) || [],
        embeds: m.embeds?.map((e) => ({
          id: e.id,
          messageId: e.messageId,
          type: e.type as MessageEmbed['type'],
          url: e.url,
          title: e.title || undefined,
          description: e.description || undefined,
          image: e.image || undefined,
          siteName: e.siteName || undefined,
          createdAt: e.createdAt,
        })) || [],
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
