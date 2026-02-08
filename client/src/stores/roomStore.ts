import { create } from 'zustand';
import type { RoomState, RoomParticipant, SyncState } from '@stream-party/shared';
import { useAuthStore } from './authStore';

interface RoomStoreState {
  room: RoomState | null;
  syncState: SyncState | null;
  setRoom: (room: RoomState) => void;
  clearRoom: () => void;
  setSyncState: (state: SyncState) => void;
  addParticipant: (participant: RoomParticipant) => void;
  removeParticipant: (userId: string) => void;
  setHost: (hostId: string) => void;
  setMagnet: (magnetUri: string, selectedFileIndex: number | null) => void;
  setFileIndex: (fileIndex: number) => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  room: null,
  syncState: null,
  setRoom: (room) => {
    set({ room });
  },
  clearRoom: () => {
    set({ room: null, syncState: null });
  },
  setSyncState: (state) => {
    set({ syncState: state });
  },
  addParticipant: (participant) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          participants: [...state.room.participants, participant],
        },
      };
    });
  },
  removeParticipant: (userId) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          participants: state.room.participants.filter((p) => p.userId !== userId),
        },
      };
    });
  },
  setHost: (hostId) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          hostId,
          participants: state.room.participants.map((p) => ({
            ...p,
            isHost: p.userId === hostId,
          })),
        },
      };
    });
  },
  setMagnet: (magnetUri, selectedFileIndex) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          magnetUri,
          selectedFileIndex,
        },
      };
    });
  },
  setFileIndex: (fileIndex) => {
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          selectedFileIndex: fileIndex,
        },
      };
    });
  },
}));

// Computed selector for isHost
export const useIsHost = () => {
  const room = useRoomStore((state) => state.room);
  const userId = useAuthStore((state) => state.userId);
  return room?.hostId === userId;
};
