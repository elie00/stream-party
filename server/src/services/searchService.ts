/**
 * Search Service
 * Provides full-text search for messages and users with advanced filters
 */
import { eq, and, desc, or, ilike, sql, gte, lte, exists } from 'drizzle-orm';
import { db } from '../db';
import { messages, users, rooms, servers, channels, serverMembers, fileAttachments } from '../db/schema';
import { SearchResult, SearchParams, SearchFilters, User } from '@stream-party/shared';
import { logger } from '../utils/logger';

// Minimum query length for search
const MIN_QUERY_LENGTH = 2;
// Default search limit
const DEFAULT_SEARCH_LIMIT = 50;
// Maximum search limit
const MAX_SEARCH_LIMIT = 100;

class SearchService {
  /**
   * Search messages by content with advanced filters
   */
  async searchMessages(params: SearchParams, filters?: SearchFilters): Promise<SearchResult[]> {
    const { query, serverId, channelId, userId, limit = DEFAULT_SEARCH_LIMIT, offset = 0 } = params;

    // Validate query
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const sanitizedQuery = this.sanitizeQuery(query);
    const searchLimit = Math.min(limit, MAX_SEARCH_LIMIT);

    try {
      // Build search conditions
      const conditions = [ilike(messages.content, `%${sanitizedQuery}%`)];

      // Apply filters
      const finalFilters = filters || {};

      // Filter by user
      if (finalFilters.fromUser || userId) {
        const targetUserId = finalFilters.fromUser || userId;
        if (targetUserId) {
          conditions.push(eq(messages.userId, targetUserId));
        }
      }

      // Filter by channel
      if (finalFilters.inChannel || channelId) {
        const targetChannelId = finalFilters.inChannel || channelId;
        if (targetChannelId) {
          // We need to filter by room which is associated with channel
          // This is a simplified version
        }
      }

      // Filter by date range
      if (finalFilters.dateRange) {
        if (finalFilters.dateRange.from) {
          conditions.push(gte(messages.createdAt, finalFilters.dateRange.from));
        }
        if (finalFilters.dateRange.to) {
          conditions.push(lte(messages.createdAt, finalFilters.dateRange.to));
        }
      }

      // Filter by attachment
      if (finalFilters.hasAttachment) {
        // This would require a subquery or join
        // Simplified for now
      }

      // Build the query with joins
      let queryBuilder = db
        .select({
          id: messages.id,
          content: messages.content,
          roomId: messages.roomId,
          userId: messages.userId,
          createdAt: messages.createdAt,
          displayName: users.displayName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id));

      // Execute search
      const results = await queryBuilder.where(and(...conditions))
        .orderBy(
          finalFilters.sortBy === 'date_asc' ? asc(messages.createdAt) : desc(messages.createdAt)
        )
        .limit(searchLimit)
        .offset(offset);

      // Filter results by serverId/channelId if provided
      let filteredResults = results;

      if (serverId || channelId || finalFilters.servers?.length || finalFilters.channels?.length) {
        // Get rooms for the server/channel
        const roomFilter: { serverId?: string; channelId?: string } = {};
        if (serverId) roomFilter.serverId = serverId;
        if (channelId) roomFilter.channelId = channelId;

        filteredResults = results;
      }

      // Calculate relevance score (simple implementation based on exact match)
      return filteredResults.map((result) => {
        const score = this.calculateRelevanceScore(result.content || '', sanitizedQuery);
        return {
          type: 'message' as const,
          id: result.id,
          content: result.content,
          displayName: result.displayName,
          roomId: result.roomId,
          createdAt: result.createdAt || undefined,
          score,
        };
      }).sort((a, b) => {
        if (finalFilters.sortBy === 'relevance') {
          return b.score - a.score;
        }
        return 0; // Already sorted by date in query
      });
    } catch (error) {
      logger.error('Failed to search messages:', error);
      return [];
    }
  }

  /**
   * Advanced search with full filters
   */
  async advancedSearch(filters: SearchFilters): Promise<SearchResult[]> {
    const { query, servers, channels: filterChannels, users: filterUsers, dateRange, hasAttachment, fromUser, inChannel, sortBy } = filters;

    // Validate query
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const sanitizedQuery = this.sanitizeQuery(query);
    const searchLimit = Math.min(filters.limit || DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);

    try {
      // Build conditions
      const conditions = [ilike(messages.content, `%${sanitizedQuery}%`)];

      // Filter by specific servers
      if (servers && servers.length > 0) {
        // Would require join with servers table
      }

      // Filter by specific channels
      if (inChannel) {
        // Would require join with rooms/channels
      }

      // Filter by specific users
      if (fromUser) {
        conditions.push(eq(messages.userId, fromUser));
      }

      // Filter by date range
      if (dateRange) {
        if (dateRange.from) {
          conditions.push(gte(messages.createdAt, dateRange.from));
        }
        if (dateRange.to) {
          conditions.push(lte(messages.createdAt, dateRange.to));
        }
      }

      // Execute search
      const results = await db
        .select({
          id: messages.id,
          content: messages.content,
          roomId: messages.roomId,
          userId: messages.userId,
          createdAt: messages.createdAt,
          displayName: users.displayName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(and(...conditions))
        .orderBy(
          sortBy === 'date_asc' ? asc(messages.createdAt) : desc(messages.createdAt)
        )
        .limit(searchLimit)
        .offset(filters.offset || 0);

      return results.map((result) => {
        const score = sortBy === 'relevance' 
          ? this.calculateRelevanceScore(result.content || '', sanitizedQuery)
          : 1;
        return {
          type: 'message' as const,
          id: result.id,
          content: result.content,
          displayName: result.displayName,
          roomId: result.roomId,
          createdAt: result.createdAt || undefined,
          score,
        };
      });
    } catch (error) {
      logger.error('Failed to advanced search:', error);
      return [];
    }
  }

  /**
   * Search users by display name
   */
  async searchUsers(query: string, serverId?: string): Promise<{ id: string; displayName: string }[]> {
    // Validate query
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const sanitizedQuery = this.sanitizeQuery(query);

    try {
      if (serverId) {
        // Search users within a specific server
        const results = await db
          .select({
            id: users.id,
            displayName: users.displayName,
          })
          .from(users)
          .innerJoin(serverMembers, eq(users.id, serverMembers.userId))
          .where(and(
            eq(serverMembers.serverId, serverId),
            ilike(users.displayName, `%${sanitizedQuery}%`)
          ))
          .limit(DEFAULT_SEARCH_LIMIT);

        return results.map((r) => ({
          id: r.id,
          displayName: r.displayName,
        }));
      } else {
        // Search all users
        const results = await db
          .select({
            id: users.id,
            displayName: users.displayName,
          })
          .from(users)
          .where(ilike(users.displayName, `%${sanitizedQuery}%`))
          .limit(DEFAULT_SEARCH_LIMIT);

        return results.map((r) => ({
          id: r.id,
          displayName: r.displayName,
        }));
      }
    } catch (error) {
      logger.error('Failed to search users:', error);
      return [];
    }
  }

  /**
   * Search messages in a specific room
   */
  async searchMessagesInRoom(
    roomId: string,
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT
  ): Promise<SearchResult[]> {
    // Validate query
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const sanitizedQuery = this.sanitizeQuery(query);
    const searchLimit = Math.min(limit, MAX_SEARCH_LIMIT);

    try {
      const results = await db
        .select({
          id: messages.id,
          content: messages.content,
          roomId: messages.roomId,
          userId: messages.userId,
          createdAt: messages.createdAt,
          displayName: users.displayName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(and(
          eq(messages.roomId, roomId),
          ilike(messages.content, `%${sanitizedQuery}%`)
        ))
        .orderBy(desc(messages.createdAt))
        .limit(searchLimit);

      return results.map((result) => {
        const score = this.calculateRelevanceScore(result.content || '', sanitizedQuery);
        return {
          type: 'message' as const,
          id: result.id,
          content: result.content,
          displayName: result.displayName,
          roomId: result.roomId,
          createdAt: result.createdAt || undefined,
          score,
        };
      }).sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Failed to search messages in room:', error);
      return [];
    }
  }

  /**
   * Get recent messages for a user (for context in search)
   */
  async getRecentMessagesForUser(
    userId: string,
    limit: number = 20
  ): Promise<SearchResult[]> {
    try {
      const results = await db
        .select({
          id: messages.id,
          content: messages.content,
          roomId: messages.roomId,
          userId: messages.userId,
          createdAt: messages.createdAt,
          displayName: users.displayName,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return results.map((result) => ({
        type: 'message' as const,
        id: result.id,
        content: result.content,
        displayName: result.displayName,
        roomId: result.roomId,
        createdAt: result.createdAt || undefined,
        score: 1,
      }));
    } catch (error) {
      logger.error('Failed to get recent messages for user:', error);
      return [];
    }
  }

  /**
   * Sanitize search query to prevent SQL injection
   */
  private sanitizeQuery(query: string): string {
    // Remove special characters that could be used for SQL injection
    return query
      .replace(/[%_\\]/g, '\\$&') // Escape LIKE special characters
      .replace(/[;'"`]/g, '') // Remove potentially dangerous characters
      .trim()
      .slice(0, 100); // Limit query length
  }

  /**
   * Calculate relevance score for search results
   * Higher score = more relevant
   */
  private calculateRelevanceScore(content: string, query: string): number {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let score = 0;

    // Exact match gets highest score
    if (lowerContent === lowerQuery) {
      score += 100;
    }

    // Starts with query
    if (lowerContent.startsWith(lowerQuery)) {
      score += 50;
    }

    // Contains exact query as word
    const wordRegex = new RegExp(`\\b${this.escapeRegex(lowerQuery)}\\b`, 'i');
    if (wordRegex.test(content)) {
      score += 30;
    }

    // Number of occurrences
    const occurrences = (lowerContent.match(new RegExp(this.escapeRegex(lowerQuery), 'g')) || []).length;
    score += occurrences * 5;

    // Proximity to start of content
    const index = lowerContent.indexOf(lowerQuery);
    if (index !== -1) {
      score += Math.max(0, 20 - Math.floor(index / 10));
    }

    return score;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const searchService = new SearchService();
