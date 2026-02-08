import { SyncState, RoomParticipant, RoomState } from '@stream-party/shared';

interface Participant {
  userId: string;
  displayName: string;
  socketId: string;
  joinedAt: Date;
  inCall: boolean;
}

interface ActiveRoom {
  code: string;
  name: string;
  hostId: string;
  dbRoomId: string;
  magnetUri: string | null;
  selectedFileIndex: number | null;
  participants: Map<string, Participant>;
  lastSyncState: SyncState | null;
}

// Map<roomCode, ActiveRoom>
const activeRooms = new Map<string, ActiveRoom>();

// Map<socketId, roomCode> for quick lookup
const socketToRoom = new Map<string, string>();

export function getRoom(code: string): ActiveRoom | undefined {
  return activeRooms.get(code);
}

export function createRoom(code: string, name: string, hostId: string, dbRoomId: string): ActiveRoom {
  const room: ActiveRoom = {
    code,
    name,
    hostId,
    dbRoomId,
    magnetUri: null,
    selectedFileIndex: null,
    participants: new Map(),
    lastSyncState: null,
  };

  activeRooms.set(code, room);
  return room;
}

export function addParticipant(
  code: string,
  socketId: string,
  userId: string,
  displayName: string
): void {
  const room = activeRooms.get(code);
  if (!room) {
    throw new Error(`Room ${code} not found`);
  }

  room.participants.set(socketId, {
    userId,
    displayName,
    socketId,
    joinedAt: new Date(),
    inCall: false,
  });

  socketToRoom.set(socketId, code);
}

export function removeParticipant(
  code: string,
  socketId: string
): { userId: string; wasHost: boolean; newHostId?: string } | null {
  const room = activeRooms.get(code);
  if (!room) {
    return null;
  }

  const participant = room.participants.get(socketId);
  if (!participant) {
    return null;
  }

  const wasHost = participant.userId === room.hostId;
  const userId = participant.userId;

  room.participants.delete(socketId);
  socketToRoom.delete(socketId);

  // If room is empty, remove it
  if (room.participants.size === 0) {
    activeRooms.delete(code);
    return { userId, wasHost, newHostId: undefined };
  }

  // If host left, promote first participant
  let newHostId: string | undefined;
  if (wasHost) {
    const firstParticipant = room.participants.values().next().value;
    if (firstParticipant) {
      room.hostId = firstParticipant.userId;
      newHostId = firstParticipant.userId;
    }
  }

  return { userId, wasHost, newHostId };
}

export function getParticipantBySocket(code: string, socketId: string): Participant | undefined {
  const room = activeRooms.get(code);
  if (!room) {
    return undefined;
  }

  return room.participants.get(socketId);
}

export function getRoomBySocket(socketId: string): ActiveRoom | undefined {
  const roomCode = socketToRoom.get(socketId);
  if (!roomCode) {
    return undefined;
  }

  return activeRooms.get(roomCode);
}

export function setMagnet(code: string, magnetUri: string): void {
  const room = activeRooms.get(code);
  if (!room) {
    throw new Error(`Room ${code} not found`);
  }

  room.magnetUri = magnetUri;
  room.selectedFileIndex = null; // Reset file selection when magnet changes
}

export function setFileIndex(code: string, fileIndex: number): void {
  const room = activeRooms.get(code);
  if (!room) {
    throw new Error(`Room ${code} not found`);
  }

  room.selectedFileIndex = fileIndex;
}

export function updateSyncState(code: string, state: SyncState): void {
  const room = activeRooms.get(code);
  if (!room) {
    throw new Error(`Room ${code} not found`);
  }

  room.lastSyncState = state;
}

export function getRoomState(code: string): RoomState | null {
  const room = activeRooms.get(code);
  if (!room) {
    return null;
  }

  const participants: RoomParticipant[] = Array.from(room.participants.values()).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    joinedAt: p.joinedAt,
    isHost: p.userId === room.hostId,
    inCall: p.inCall,
  }));

  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    magnetUri: room.magnetUri,
    selectedFileIndex: room.selectedFileIndex,
    participants,
  };
}

export function setParticipantInCall(code: string, socketId: string, inCall: boolean): void {
  const room = activeRooms.get(code);
  if (!room) {
    throw new Error(`Room ${code} not found`);
  }

  const participant = room.participants.get(socketId);
  if (participant) {
    participant.inCall = inCall;
  }
}
