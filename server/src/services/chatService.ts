import { db, schema } from '../db/index';
import { eq, and, desc, lt, sql, isNull } from 'drizzle-orm';
import type { ChatMessage, MessageThread } from '@stream-party/shared';
import { MAX_CHAT_MESSAGE_LENGTH } from '@stream-party/shared';

/**
 * Edit a message - only the author can edit their own message
 */
export async function editMessage(
  messageId: string,
  userId: string,
  newContent: string
): Promise<{ success: boolean; error?: string; message?: ChatMessage }> {
  // Validate content
  if (!newContent || newContent.trim().length === 0) {
    return { success: false, error: 'Message content cannot be empty' };
  }

  if (newContent.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { success: false, error: 'Message content is too long' };
  }

  // Check if message exists and belongs to user
  const existingMessage = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageId),
  });

  if (!existingMessage) {
    return { success: false, error: 'Message not found' };
  }

  if (existingMessage.userId !== userId) {
    return { success: false, error: 'You can only edit your own messages' };
  }

  if (existingMessage.isDeleted) {
    return { success: false, error: 'Cannot edit a deleted message' };
  }

  // Update message
  const [updatedMessage] = await db
    .update(schema.messages)
    .set({
      content: newContent.trim(),
      editedAt: new Date(),
    })
    .where(eq(schema.messages.id, messageId))
    .returning();

  // Get the user info
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, updatedMessage.userId),
  });

  const message: ChatMessage = {
    id: updatedMessage.id,
    roomId: updatedMessage.roomId,
    userId: updatedMessage.userId,
    content: updatedMessage.content,
    createdAt: updatedMessage.createdAt,
    editedAt: updatedMessage.editedAt || undefined,
    isDeleted: updatedMessage.isDeleted || false,
    parentId: updatedMessage.parentId || undefined,
    threadId: updatedMessage.threadId || undefined,
    user: { displayName: user?.displayName || 'Unknown' },
    reactions: [],
    embeds: [],
  };

  return { success: true, message };
}

/**
 * Delete a message (soft delete) - only the author can delete their own message
 */
export async function deleteMessage(
  messageId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if message exists and belongs to user
  const existingMessage = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageId),
  });

  if (!existingMessage) {
    return { success: false, error: 'Message not found' };
  }

  if (existingMessage.userId !== userId) {
    return { success: false, error: 'You can only delete your own messages' };
  }

  if (existingMessage.isDeleted) {
    return { success: false, error: 'Message is already deleted' };
  }

  // Soft delete message
  await db
    .update(schema.messages)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      content: '', // Clear content
    })
    .where(eq(schema.messages.id, messageId));

  return { success: true };
}

/**
 * Create a reply to a message (creates thread if not exists)
 */
export async function createReply(
  roomId: string,
  userId: string,
  parentId: string,
  content: string,
  displayName: string
): Promise<{ success: boolean; error?: string; reply?: ChatMessage; replyCount?: number }> {
  // Validate content
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Message content cannot be empty' };
  }

  if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { success: false, error: 'Message content is too long' };
  }

  // Check if parent message exists
  const parentMessage = await db.query.messages.findFirst({
    where: eq(schema.messages.id, parentId),
  });

  if (!parentMessage) {
    return { success: false, error: 'Parent message not found' };
  }

  if (parentMessage.isDeleted) {
    return { success: false, error: 'Cannot reply to a deleted message' };
  }

  // Check if thread already exists
  let thread = await db.query.messageThreads.findFirst({
    where: eq(schema.messageThreads.parentMessageId, parentId),
  });

  // Create thread if doesn't exist
  if (!thread) {
    const [newThread] = await db
      .insert(schema.messageThreads)
      .values({
        roomId,
        parentMessageId: parentId,
      })
      .returning();
    thread = newThread;
  }

  // Create the reply message
  const [reply] = await db
    .insert(schema.messages)
    .values({
      roomId,
      userId,
      content: content.trim(),
      parentId,
      threadId: thread.id,
    })
    .returning();

  // Update thread reply count and last reply time
  await db
    .update(schema.messageThreads)
    .set({
      replyCount: sql`${schema.messageThreads.replyCount} + 1`,
      lastReplyAt: new Date(),
    })
    .where(eq(schema.messageThreads.id, thread.id));

  const chatReply: ChatMessage = {
    id: reply.id,
    roomId: reply.roomId,
    userId: reply.userId,
    content: reply.content,
    createdAt: reply.createdAt,
    parentId: reply.parentId || undefined,
    threadId: reply.threadId || undefined,
    user: { displayName },
    reactions: [],
    embeds: [],
  };

  // Get updated reply count
  const updatedThread = await db.query.messageThreads.findFirst({
    where: eq(schema.messageThreads.id, thread.id),
  });

  return { 
    success: true, 
    reply: chatReply, 
    replyCount: updatedThread?.replyCount || 1 
  };
}

/**
 * Get thread with parent message and replies
 */
export async function getThread(
  parentMessageId: string
): Promise<{ success: boolean; error?: string; thread?: MessageThread }> {
  // Get thread
  const thread = await db.query.messageThreads.findFirst({
    where: eq(schema.messageThreads.parentMessageId, parentMessageId),
  });

  if (!thread) {
    return { success: false, error: 'Thread not found' };
  }

  // Get parent message with user
  const parentMessage = await db.query.messages.findFirst({
    where: eq(schema.messages.id, parentMessageId),
    with: {
      user: true,
    },
  });

  if (!parentMessage) {
    return { success: false, error: 'Parent message not found' };
  }

  // Get replies
  const replies = await db.query.messages.findMany({
    where: eq(schema.messages.threadId, thread.id),
    orderBy: desc(schema.messages.createdAt),
    with: {
      user: true,
    },
  });

  const chatReplies: ChatMessage[] = replies
    .filter(r => !r.isDeleted)
    .map((r) => ({
      id: r.id,
      roomId: r.roomId,
      userId: r.userId,
      content: r.content,
      createdAt: r.createdAt,
      editedAt: r.editedAt || undefined,
      isDeleted: r.isDeleted || false,
      deletedAt: r.deletedAt || undefined,
      parentId: r.parentId || undefined,
      threadId: r.threadId || undefined,
      user: { displayName: r.user?.displayName || 'Unknown' },
      reactions: [],
      embeds: [],
    }));

  const chatParentMessage: ChatMessage = {
    id: parentMessage.id,
    roomId: parentMessage.roomId,
    userId: parentMessage.userId,
    content: parentMessage.content,
    createdAt: parentMessage.createdAt,
    editedAt: parentMessage.editedAt || undefined,
    isDeleted: parentMessage.isDeleted || false,
    deletedAt: parentMessage.deletedAt || undefined,
    parentId: parentMessage.parentId || undefined,
    threadId: parentMessage.threadId || undefined,
    user: { displayName: parentMessage.user?.displayName || 'Unknown' },
    reactions: [],
    embeds: [],
    replyCount: thread.replyCount,
  };

  const result: MessageThread = {
    id: thread.id,
    roomId: thread.roomId,
    parentMessage: chatParentMessage,
    replies: chatReplies,
    lastReplyAt: thread.lastReplyAt,
    replyCount: thread.replyCount,
  };

  return { success: true, thread: result };
}

/**
 * Get replies for a thread with pagination
 */
export async function getReplies(
  threadId: string,
  limit: number = 50,
  before?: string
): Promise<{ success: boolean; error?: string; replies?: ChatMessage[]; hasMore?: boolean }> {
  const thread = await db.query.messageThreads.findFirst({
    where: eq(schema.messageThreads.id, threadId),
  });

  if (!thread) {
    return { success: false, error: 'Thread not found' };
  }

  let replies;

  if (before) {
    // Get cursor message
    const cursorMsg = await db.query.messages.findFirst({
      where: eq(schema.messages.id, before),
    });

    if (cursorMsg) {
      replies = await db.query.messages.findMany({
        where: and(
          eq(schema.messages.threadId, threadId),
          lt(schema.messages.createdAt, cursorMsg.createdAt),
          eq(schema.messages.isDeleted, false),
        ),
        orderBy: desc(schema.messages.createdAt),
        limit: limit + 1, // Get one extra to check if there's more
        with: {
          user: true,
        },
      });
    } else {
      replies = [];
    }
  } else {
    replies = await db.query.messages.findMany({
      where: and(
        eq(schema.messages.threadId, threadId),
        eq(schema.messages.isDeleted, false),
      ),
      orderBy: desc(schema.messages.createdAt),
      limit: limit + 1,
      with: {
        user: true,
      },
    });
  }

  const hasMore = replies.length > limit;
  const results = hasMore ? replies.slice(0, limit) : replies;

  const chatReplies: ChatMessage[] = results.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    userId: r.userId,
    content: r.content,
    createdAt: r.createdAt,
    editedAt: r.editedAt || undefined,
    isDeleted: r.isDeleted || false,
    deletedAt: r.deletedAt || undefined,
    parentId: r.parentId || undefined,
    threadId: r.threadId || undefined,
    user: { displayName: r.user?.displayName || 'Unknown' },
    reactions: [],
    embeds: [],
  }));

  return { success: true, replies: chatReplies, hasMore };
}

/**
 * Get reply count for a message
 */
export async function getReplyCount(messageId: string): Promise<number> {
  const thread = await db.query.messageThreads.findFirst({
    where: eq(schema.messageThreads.parentMessageId, messageId),
  });

  return thread?.replyCount || 0;
}
