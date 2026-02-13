import { db, schema } from '../db/index';
import { eq, desc, lt, and, sql, inArray } from 'drizzle-orm';
import type { DirectMessageChannel, DirectMessage } from '@stream-party/shared';

class DMService {
  /**
   * Find or create a DM channel between two users
   */
  async getOrCreateChannel(userId1: string, userId2: string): Promise<DirectMessageChannel> {
    // Find existing channel where both users are participants
    const existingChannels = await db
      .select({ channelId: schema.directMessageParticipants.channelId })
      .from(schema.directMessageParticipants)
      .where(eq(schema.directMessageParticipants.userId, userId1));

    for (const { channelId } of existingChannels) {
      const otherParticipant = await db.query.directMessageParticipants.findFirst({
        where: and(
          eq(schema.directMessageParticipants.channelId, channelId),
          eq(schema.directMessageParticipants.userId, userId2),
        ),
      });

      if (otherParticipant) {
        // Channel exists, return it with full details
        return this.getChannelById(channelId);
      }
    }

    // Create new channel
    const [channel] = await db
      .insert(schema.directMessageChannels)
      .values({})
      .returning();

    // Add both participants
    await db.insert(schema.directMessageParticipants).values([
      { channelId: channel.id, userId: userId1 },
      { channelId: channel.id, userId: userId2 },
    ]);

    return this.getChannelById(channel.id);
  }

  /**
   * Get a channel by ID with participants
   */
  async getChannelById(channelId: string): Promise<DirectMessageChannel> {
    const channel = await db.query.directMessageChannels.findFirst({
      where: eq(schema.directMessageChannels.id, channelId),
      with: {
        participants: {
          with: {
            user: true,
          },
        },
        messages: {
          orderBy: desc(schema.directMessages.createdAt),
          limit: 1,
          with: {
            sender: true,
          },
        },
      },
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    const lastMsg = channel.messages[0];

    return {
      id: channel.id,
      participants: channel.participants.map((p) => ({
        userId: p.user.id,
        displayName: p.user.displayName,
      })),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            channelId: lastMsg.channelId,
            senderId: lastMsg.senderId,
            senderName: lastMsg.sender.displayName,
            content: lastMsg.content,
            editedAt: lastMsg.editedAt || undefined,
            createdAt: lastMsg.createdAt,
          }
        : undefined,
      createdAt: channel.createdAt,
    };
  }

  /**
   * List all DM channels for a user
   */
  async getChannels(userId: string): Promise<DirectMessageChannel[]> {
    const participantRows = await db.query.directMessageParticipants.findMany({
      where: eq(schema.directMessageParticipants.userId, userId),
    });

    const channelIds = participantRows.map((p) => p.channelId);
    if (channelIds.length === 0) return [];

    const channels: DirectMessageChannel[] = [];
    for (const channelId of channelIds) {
      try {
        const channel = await this.getChannelById(channelId);
        channels.push(channel);
      } catch {
        // Skip channels that can't be loaded
      }
    }

    // Sort by last message date (most recent first)
    channels.sort((a, b) => {
      const aDate = a.lastMessage?.createdAt || a.createdAt;
      const bDate = b.lastMessage?.createdAt || b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return channels;
  }

  /**
   * Send a direct message
   */
  async sendMessage(channelId: string, senderId: string, content: string): Promise<DirectMessage> {
    // Verify sender is a participant
    const participant = await db.query.directMessageParticipants.findFirst({
      where: and(
        eq(schema.directMessageParticipants.channelId, channelId),
        eq(schema.directMessageParticipants.userId, senderId),
      ),
    });

    if (!participant) {
      throw new Error('Not a participant of this channel');
    }

    const [message] = await db
      .insert(schema.directMessages)
      .values({
        channelId,
        senderId,
        content,
      })
      .returning();

    // Get sender info
    const sender = await db.query.users.findFirst({
      where: eq(schema.users.id, senderId),
    });

    return {
      id: message.id,
      channelId: message.channelId,
      senderId: message.senderId,
      senderName: sender?.displayName || 'Unknown',
      content: message.content,
      editedAt: message.editedAt || undefined,
      createdAt: message.createdAt,
    };
  }

  /**
   * Get message history for a channel
   */
  async getMessages(
    channelId: string,
    limit: number = 50,
    cursor?: string,
  ): Promise<DirectMessage[]> {
    const queryLimit = Math.min(limit, 50);

    let messagesResult;

    if (cursor) {
      const cursorMsg = await db.query.directMessages.findFirst({
        where: eq(schema.directMessages.id, cursor),
      });

      if (cursorMsg) {
        messagesResult = await db.query.directMessages.findMany({
          where: and(
            eq(schema.directMessages.channelId, channelId),
            lt(schema.directMessages.createdAt, cursorMsg.createdAt),
          ),
          orderBy: desc(schema.directMessages.createdAt),
          limit: queryLimit,
          with: { sender: true },
        });
      } else {
        messagesResult = [];
      }
    } else {
      messagesResult = await db.query.directMessages.findMany({
        where: eq(schema.directMessages.channelId, channelId),
        orderBy: desc(schema.directMessages.createdAt),
        limit: queryLimit,
        with: { sender: true },
      });
    }

    // Reverse to chronological order
    return messagesResult.reverse().map((m) => ({
      id: m.id,
      channelId: m.channelId,
      senderId: m.senderId,
      senderName: m.sender.displayName,
      content: m.content,
      editedAt: m.editedAt || undefined,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Get participant user IDs for a channel
   */
  async getChannelParticipantIds(channelId: string): Promise<string[]> {
    const participants = await db.query.directMessageParticipants.findMany({
      where: eq(schema.directMessageParticipants.channelId, channelId),
    });
    return participants.map((p) => p.userId);
  }
}

export const dmService = new DMService();
