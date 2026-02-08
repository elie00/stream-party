import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@stream-party/shared';
import { extractSocketUser, JWTPayload } from '../middleware/auth';
import { registerRoomHandlers } from './handlers/room.handler';
import { registerSyncHandlers } from './handlers/sync.handler';
import { registerChatHandlers } from './handlers/chat.handler';
import { registerRtcHandlers } from './handlers/rtc.handler';

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
  });

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

  // Register event handlers
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`User connected: ${user?.displayName} (${user?.userId})`);

    // Register room handlers
    registerRoomHandlers(io, socket);

    // Register sync handlers
    registerSyncHandlers(io, socket);

    // Register chat handlers
    registerChatHandlers(io, socket);

    // Register WebRTC signaling handlers
    registerRtcHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user?.displayName} (${user?.userId})`);
    });
  });

  return io;
}
