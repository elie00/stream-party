import { describe, it, expect, beforeEach } from 'vitest';
import {
    createRoom,
    getRoom,
    addParticipant,
    removeParticipant,
    getRoomState,
    setMagnet,
    setFileIndex,
    getParticipantBySocket,
    getRoomBySocket,
    setParticipantInCall,
} from '../roomState';

describe('roomState', () => {
    const testRoomCode = 'ABC123';
    const testRoomName = 'Test Room';
    const testHostId = 'host-user-id';
    const testDbRoomId = 'db-room-uuid';

    beforeEach(() => {
        // Clean up by removing any existing test room
        const existingRoom = getRoom(testRoomCode);
        if (existingRoom) {
            // Remove all participants to clean up
            existingRoom.participants.forEach((_, socketId) => {
                removeParticipant(testRoomCode, socketId);
            });
        }
    });

    describe('createRoom', () => {
        it('should create a new room with correct initial state', () => {
            const room = createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);

            expect(room.code).toBe(testRoomCode);
            expect(room.name).toBe(testRoomName);
            expect(room.hostId).toBe(testHostId);
            expect(room.dbRoomId).toBe(testDbRoomId);
            expect(room.magnetUri).toBeNull();
            expect(room.selectedFileIndex).toBeNull();
            expect(room.participants.size).toBe(0);
            expect(room.lastSyncState).toBeNull();
        });

        it('should be retrievable via getRoom', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);

            const room = getRoom(testRoomCode);

            expect(room).toBeDefined();
            expect(room?.code).toBe(testRoomCode);
        });
    });

    describe('addParticipant', () => {
        it('should add a participant to the room', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);

            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');

            const room = getRoom(testRoomCode);
            expect(room?.participants.size).toBe(1);

            const participant = room?.participants.get('socket-1');
            expect(participant?.userId).toBe('user-1');
            expect(participant?.displayName).toBe('Alice');
            expect(participant?.inCall).toBe(false);
        });

        it('should throw error for non-existent room', () => {
            expect(() => addParticipant('FAKE99', 'socket-1', 'user-1', 'Alice'))
                .toThrow('Room FAKE99 not found');
        });

        it('should update socketToRoom mapping', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');

            const room = getRoomBySocket('socket-1');

            expect(room?.code).toBe(testRoomCode);
        });
    });

    describe('removeParticipant', () => {
        it('should remove a participant and return their info', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');
            addParticipant(testRoomCode, 'socket-2', 'user-2', 'Bob'); // Add second so room isn't deleted

            const result = removeParticipant(testRoomCode, 'socket-1');

            expect(result?.userId).toBe('user-1');
            expect(result?.wasHost).toBe(false);

            const room = getRoom(testRoomCode);
            expect(room?.participants.size).toBe(1); // Only Bob remains
        });

        it('should promote first participant when host leaves', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-host', testHostId, 'Host');
            addParticipant(testRoomCode, 'socket-2', 'user-2', 'Bob');
            addParticipant(testRoomCode, 'socket-3', 'user-3', 'Charlie');

            const result = removeParticipant(testRoomCode, 'socket-host');

            expect(result?.wasHost).toBe(true);
            expect(result?.newHostId).toBe('user-2'); // First remaining participant

            const room = getRoom(testRoomCode);
            expect(room?.hostId).toBe('user-2');
        });

        it('should delete room when last participant leaves', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');

            removeParticipant(testRoomCode, 'socket-1');

            const room = getRoom(testRoomCode);
            expect(room).toBeUndefined();
        });

        it('should return null for non-existent room', () => {
            const result = removeParticipant('FAKE99', 'socket-1');
            expect(result).toBeNull();
        });

        it('should return null for non-existent participant', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);

            const result = removeParticipant(testRoomCode, 'non-existent-socket');
            expect(result).toBeNull();
        });
    });

    describe('getRoomState', () => {
        it('should return correct room state with participants', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-host', testHostId, 'Host');
            addParticipant(testRoomCode, 'socket-2', 'user-2', 'Bob');

            const state = getRoomState(testRoomCode);

            expect(state?.code).toBe(testRoomCode);
            expect(state?.name).toBe(testRoomName);
            expect(state?.hostId).toBe(testHostId);
            expect(state?.participants).toHaveLength(2);

            const hostParticipant = state?.participants.find(p => p.userId === testHostId);
            expect(hostParticipant?.isHost).toBe(true);

            const otherParticipant = state?.participants.find(p => p.userId === 'user-2');
            expect(otherParticipant?.isHost).toBe(false);
        });

        it('should return null for non-existent room', () => {
            const state = getRoomState('FAKE99');
            expect(state).toBeNull();
        });
    });

    describe('setMagnet', () => {
        it('should update magnetUri and reset fileIndex', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            setFileIndex(testRoomCode, 2);

            setMagnet(testRoomCode, 'magnet:?xt=urn:btih:abc123');

            const room = getRoom(testRoomCode);
            expect(room?.magnetUri).toBe('magnet:?xt=urn:btih:abc123');
            expect(room?.selectedFileIndex).toBeNull(); // Reset
        });
    });

    describe('setFileIndex', () => {
        it('should update selectedFileIndex', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);

            setFileIndex(testRoomCode, 3);

            const room = getRoom(testRoomCode);
            expect(room?.selectedFileIndex).toBe(3);
        });
    });

    describe('helper functions', () => {
        it('getParticipantBySocket should return correct participant', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');

            const participant = getParticipantBySocket(testRoomCode, 'socket-1');

            expect(participant?.displayName).toBe('Alice');
        });

        it('setParticipantInCall should update inCall status', () => {
            createRoom(testRoomCode, testRoomName, testHostId, testDbRoomId);
            addParticipant(testRoomCode, 'socket-1', 'user-1', 'Alice');

            setParticipantInCall(testRoomCode, 'socket-1', true);

            const participant = getParticipantBySocket(testRoomCode, 'socket-1');
            expect(participant?.inCall).toBe(true);
        });
    });
});
