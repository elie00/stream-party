import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@stream-party/shared';
import { getRoomBySocket, setParticipantInCall } from '../roomState';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerRtcHandlers(io: TypedServer, socket: TypedSocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // User joins a call
  socket.on('rtc:join-call', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    setParticipantInCall(room.code, socket.id, true);

    // Notify everyone else in the room
    socket.to(room.code).emit('rtc:user-joined-call', user.userId);
  });

  // User leaves a call
  socket.on('rtc:leave-call', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    setParticipantInCall(room.code, socket.id, false);

    socket.to(room.code).emit('rtc:user-left-call', user.userId);
  });

  // WebRTC signaling - relay offer to specific peer
  socket.on('rtc:offer', (data: { to: string; signal: unknown }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    // Find the target user's socket ID by userId
    const targetSocketId = findSocketIdByUserId(room, data.to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('rtc:offer', {
      from: user.userId,
      signal: data.signal,
    });
  });

  // Relay answer
  socket.on('rtc:answer', (data: { to: string; signal: unknown }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const targetSocketId = findSocketIdByUserId(room, data.to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('rtc:answer', {
      from: user.userId,
      signal: data.signal,
    });
  });

  // Relay ICE candidate
  socket.on('rtc:ice-candidate', (data: { to: string; signal: unknown }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const targetSocketId = findSocketIdByUserId(room, data.to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('rtc:ice-candidate', {
      from: user.userId,
      signal: data.signal,
    });
  });

  // On disconnect, also leave call
  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant?.inCall) {
      participant.inCall = false;
      socket.to(room.code).emit('rtc:user-left-call', user.userId);
    }
  });
}

/**
 * Find a socket ID by user ID within a room.
 * Participants are keyed by socketId, so we iterate to find the matching userId.
 */
function findSocketIdByUserId(
  room: { participants: Map<string, { userId: string; socketId: string }> },
  userId: string,
): string | null {
  for (const [, participant] of room.participants) {
    if (participant.userId === userId) {
      return participant.socketId;
    }
  }
  return null;
}
