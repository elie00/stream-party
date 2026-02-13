/**
 * Search Socket Handlers
 * Handles search events for messages and users
 */
import { Server, Socket } from 'socket.io';
import { searchService } from '../../services/searchService';
import { SearchParams } from '@stream-party/shared';
import { logger } from '../../utils/logger';

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerSearchHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Search messages by content with optional filters
   */
  socket.on('search:messages', async (data: SearchParams) => {
    try {
      if (!data.query || data.query.trim().length < 2) {
        socket.emit('search:results', { results: [] });
        return;
      }

      const results = await searchService.searchMessages({
        query: data.query,
        serverId: data.serverId,
        channelId: data.channelId,
        userId: data.userId,
        limit: data.limit,
        offset: data.offset,
      });

      socket.emit('search:results', { results });

      logger.debug(`Search messages for "${data.query}" by ${user.displayName}: ${results.length} results`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search messages';
      logger.error('search:messages error', { error: message });
      socket.emit('search:error', { message: 'Search failed. Please try again.' });
    }
  });

  /**
   * Search users by display name, optionally within a server
   */
  socket.on('search:users', async (data: { query: string; serverId?: string }) => {
    try {
      if (!data.query || data.query.trim().length < 2) {
        socket.emit('search:users-results', { users: [] });
        return;
      }

      const users = await searchService.searchUsers(data.query, data.serverId);

      socket.emit('search:users-results', { users });

      logger.debug(`Search users for "${data.query}" by ${user.displayName}: ${users.length} results`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search users';
      logger.error('search:users error', { error: message });
      socket.emit('search:error', { message: 'User search failed. Please try again.' });
    }
  });
}
