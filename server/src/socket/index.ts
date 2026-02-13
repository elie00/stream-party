import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@stream-party/shared';
import { extractSocketUser, JWTPayload } from '../middleware/auth';
import { registerRoomHandlers } from './handlers/room.handler';
import { registerSyncHandlers } from './handlers/sync.handler';
import { registerChatHandlers } from './handlers/chat.handler';
import { registerRtcHandlers } from './handlers/rtc.handler';
import { registerSfuHandlers } from './handlers/sfu.handler';
import { registerVoiceHandlers } from './handlers/voice.handler';
import { registerReactionHandlers } from './handlers/reaction.handler';
import { registerEmbedHandlers } from './handlers/embed.handler';
import { registerServerHandlers } from './handlers/server.handler';
import { registerYouTubeHandlers } from './handlers/youtube.handler';
import { registerPresenceHandlers } from './handlers/presence.handler';
import { registerNotificationHandlers } from './handlers/notification.handler';
import { registerSearchHandlers } from './handlers/search.handler';
import { registerModerationHandlers } from './handlers/moderation.handler';
import { registerDMHandlers } from './handlers/dm.handler';
import { logger } from '../utils/logger';

// Extend Socket.IO socket data type
declare module 'socket.io' {
  interface SocketData {
    user?: JWTPayload;
  }
}

export function createSocketServer(httpServer: HTTPServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    // Max payload size
    maxHttpBufferSize: 1e6, // 1MB max
  });

  // Rate limiting state per socket
  const socketRateLimit = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
  const RATE_LIMIT_MAX_EVENTS = 50; // 50 events per second

  // Authentication middleware
  io.use((socket, next) => {
    const user = extractSocketUser(socket);

    if (!user) {
      next(new Error('Authentication failed'));
      return;
    }

    socket.data.user = user;
    next();
  });

  // Rate limiting and payload validation middleware
  io.use((socket, next) => {
    socket.use(([_event, data], nextPacket) => {
      // Check payload size
      try {
        const payloadSize = JSON.stringify(data).length;
        if (payloadSize > 10000) { // 10KB max per event
          console.warn(`Payload too large from ${socket.id}: ${payloadSize} bytes`);
          socket.emit('error', 'Payload too large');
          return;
        }
      } catch {
        // If we can't stringify, it's probably fine (or will fail elsewhere)
      }

      // Rate limiting per socket
      const now = Date.now();
      let rateData = socketRateLimit.get(socket.id);

      if (!rateData || now > rateData.resetAt) {
        rateData = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        socketRateLimit.set(socket.id, rateData);
      }

      rateData.count++;

      if (rateData.count > RATE_LIMIT_MAX_EVENTS) {
        console.warn(`Rate limit exceeded for socket ${socket.id}`);
        socket.emit('error', 'Rate limit exceeded');
        return;
      }

      nextPacket();
    });

    // Cleanup rate limit data on disconnect
    socket.on('disconnect', () => {
      socketRateLimit.delete(socket.id);
    });

    next();
  });

  // Register event handlers
  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info(`User connected: ${user?.displayName} (${user?.userId})`);

    // Register room handlers
    registerRoomHandlers(io, socket);

    // Register sync handlers
    registerSyncHandlers(io, socket);

    // Register chat handlers
    registerChatHandlers(io, socket);

    // Register WebRTC signaling handlers (legacy mesh)
    registerRtcHandlers(io, socket);

    // Register SFU handlers (mediasoup)
    registerSfuHandlers(io, socket);

    // Register voice channel handlers
    registerVoiceHandlers(io, socket);

    // Register reaction handlers
    registerReactionHandlers(io, socket);

    // Register embed handlers
    registerEmbedHandlers(io, socket);

    // Register server handlers
    registerServerHandlers(io, socket);

    // Register YouTube handlers
    registerYouTubeHandlers(io, socket);

    // Register presence handlers
    registerPresenceHandlers(io, socket);

    // Register notification handlers
    registerNotificationHandlers(io, socket);

    // Register search handlers
    registerSearchHandlers(io, socket);

    // Register moderation handlers
    registerModerationHandlers(io, socket);

    // Register DM handlers
    registerDMHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${user?.displayName} (${user?.userId})`);
    });
  });

  return io;
}
