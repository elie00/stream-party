import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@stream-party/shared';
import { db, schema } from '../../db/index';
import { eq } from 'drizzle-orm';
import * as roomState from '../roomState';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  socket.on('room:join', async (data, callback) => {
    try {
      const { code } = data;

      // Verify room exists in database and is active
      const room = await db.query.rooms.findFirst({
        where: eq(schema.rooms.code, code),
      });

      if (!room || !room.isActive) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Check if room is already in memory, otherwise create it
      let activeRoom = roomState.getRoom(code);
      if (!activeRoom) {
        activeRoom = roomState.createRoom(code, room.name, room.hostId, room.id);
        activeRoom.magnetUri = room.magnetUri;
        activeRoom.selectedFileIndex = room.selectedFileIndex;
      }

      // Check max participants
      if (activeRoom.participants.size >= room.maxParticipants) {
        callback({ success: false, error: 'Room is full' });
        return;
      }

      // Add participant to in-memory state
      roomState.addParticipant(code, socket.id, user.userId, user.displayName);

      // Join socket room
      await socket.join(code);

      // Broadcast user joined to others in room
      socket.to(code).emit('room:user-joined', {
        userId: user.userId,
        displayName: user.displayName,
        joinedAt: new Date(),
        isHost: user.userId === activeRoom.hostId,
        inCall: false,
      });

      // Send room state to the joining user
      const state = roomState.getRoomState(code);
      if (state) {
        socket.emit('room:state', state);
      }

      callback({ success: true });
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ success: false, error: 'Failed to join room' });
    }
  });

  socket.on('room:leave', async () => {
    handleRoomLeave(io, socket);
  });

  socket.on('room:set-magnet', async (data) => {
    try {
      const room = roomState.getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('error', 'Not in a room');
        return;
      }

      // Only host can set magnet
      if (room.hostId !== user.userId) {
        socket.emit('error', 'Only host can set magnet');
        return;
      }

      const { magnetUri } = data;
      roomState.setMagnet(room.code, magnetUri);

      // Update database
      await db
        .update(schema.rooms)
        .set({ magnetUri, selectedFileIndex: null })
        .where(eq(schema.rooms.code, room.code));

      // Broadcast to room
      io.to(room.code).emit('room:magnet-changed', {
        magnetUri,
        selectedFileIndex: null,
      });
    } catch (error) {
      console.error('Error setting magnet:', error);
      socket.emit('error', 'Failed to set magnet');
    }
  });

  socket.on('room:select-file', async (data) => {
    try {
      const room = roomState.getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('error', 'Not in a room');
        return;
      }

      // Only host can select file
      if (room.hostId !== user.userId) {
        socket.emit('error', 'Only host can select file');
        return;
      }

      const { fileIndex } = data;
      roomState.setFileIndex(room.code, fileIndex);

      // Update database
      await db
        .update(schema.rooms)
        .set({ selectedFileIndex: fileIndex })
        .where(eq(schema.rooms.code, room.code));

      // Broadcast to room
      io.to(room.code).emit('room:file-selected', fileIndex);
    } catch (error) {
      console.error('Error selecting file:', error);
      socket.emit('error', 'Failed to select file');
    }
  });

  socket.on('disconnect', () => {
    handleRoomLeave(io, socket);
  });
}

function handleRoomLeave(io: TypedServer, socket: TypedSocket) {
  const room = roomState.getRoomBySocket(socket.id);
  if (!room) {
    return;
  }

  const result = roomState.removeParticipant(room.code, socket.id);
  if (!result) {
    return;
  }

  socket.leave(room.code);

  // Broadcast user left
  io.to(room.code).emit('room:user-left', result.userId);

  // If host left and there's a new host, broadcast host change
  if (result.wasHost && result.newHostId) {
    io.to(room.code).emit('room:host-changed', result.newHostId);
  }
}
