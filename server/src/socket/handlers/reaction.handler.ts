import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, MessageReaction } from '@stream-party/shared';
import { MAX_REACTIONS_PER_MESSAGE } from '@stream-party/shared';
import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';
import { getRoomBySocket } from '../roomState';
import { isValidEmoji } from '../../services/embedService';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerReactionHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // Add a reaction to a message
  socket.on('reaction:add', async (data: { messageId: string; emoji: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      // Validate emoji
      if (!isValidEmoji(data.emoji)) {
        socket.emit('error', 'Invalid emoji');
        return;
      }

      // Check if message exists
      const message = await db.query.messages.findFirst({
        where: eq(schema.messages.id, data.messageId),
        with: {
          reactions: true,
        },
      });

      if (!message) {
        socket.emit('error', 'Message not found');
        return;
      }

      // Check if user already reacted with this emoji
      const existingReaction = await db.query.messageReactions.findFirst({
        where: and(
          eq(schema.messageReactions.messageId, data.messageId),
          eq(schema.messageReactions.userId, user.userId),
          eq(schema.messageReactions.emoji, data.emoji)
        ),
      });

      if (existingReaction) {
        // User already reacted with this emoji, ignore
        return;
      }

      // Check max reactions limit
      if (message.reactions && message.reactions.length >= MAX_REACTIONS_PER_MESSAGE) {
        socket.emit('error', 'Maximum reactions reached for this message');
        return;
      }

      // Insert reaction
      const [reaction] = await db
        .insert(schema.messageReactions)
        .values({
          messageId: data.messageId,
          userId: user.userId,
          emoji: data.emoji,
        })
        .returning();

      const messageReaction: MessageReaction = {
        id: reaction.id,
        messageId: reaction.messageId,
        userId: reaction.userId,
        emoji: reaction.emoji,
        createdAt: reaction.createdAt,
      };

      // Broadcast to room
      io.to(room.code).emit('reaction:added', {
        messageId: data.messageId,
        reaction: messageReaction,
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
      socket.emit('error', 'Failed to add reaction');
    }
  });

  // Remove a reaction from a message
  socket.on('reaction:remove', async (data: { messageId: string; reactionId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      // Find the reaction
      const reaction = await db.query.messageReactions.findFirst({
        where: eq(schema.messageReactions.id, data.reactionId),
      });

      if (!reaction) {
        socket.emit('error', 'Reaction not found');
        return;
      }

      // Only allow user to remove their own reaction
      if (reaction.userId !== user.userId) {
        socket.emit('error', 'Cannot remove another user\'s reaction');
        return;
      }

      // Delete reaction
      await db
        .delete(schema.messageReactions)
        .where(eq(schema.messageReactions.id, data.reactionId));

      // Broadcast to room
      io.to(room.code).emit('reaction:removed', {
        messageId: data.messageId,
        reactionId: data.reactionId,
      });
    } catch (error) {
      console.error('Error removing reaction:', error);
      socket.emit('error', 'Failed to remove reaction');
    }
  });
}
