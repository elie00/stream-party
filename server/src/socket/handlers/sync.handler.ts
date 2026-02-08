import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SyncState } from '@stream-party/shared';
import { getRoomBySocket, updateSyncState } from '../roomState';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerSyncHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // Host broadcasts periodic sync state (every 1.5s from client)
  socket.on('sync:state', (state: SyncState) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return; // Only host can broadcast

    updateSyncState(room.code, state);
    // Broadcast to everyone else in the room
    socket.to(room.code).emit('sync:state', state);
  });

  // Discrete events: play, pause, seek - host only, immediate relay
  socket.on('sync:play', (time: number) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;
    socket.to(room.code).emit('sync:play', time);
  });

  socket.on('sync:pause', (time: number) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;
    socket.to(room.code).emit('sync:pause', time);
  });

  socket.on('sync:seek', (time: number) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;
    socket.to(room.code).emit('sync:seek', time);
  });

  // Buffer event - host can signal buffering to pause for all
  socket.on('sync:buffer', (isBuffering: boolean) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;
    socket.to(room.code).emit('sync:buffer', isBuffering);
  });

  // Late joiner requests current sync state
  socket.on('sync:request', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.lastSyncState) return;
    // Send current sync state to the requesting socket only
    socket.emit('sync:state', room.lastSyncState);
  });
}
