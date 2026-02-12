import { create } from 'zustand';
import { PresenceStatus, UserPresence } from '@stream-party/shared';

interface PresenceState {
  // Current user's presence
  myStatus: PresenceStatus;
  myCustomStatus: string | null;
  
  // Other users' presence (userId -> presence)
  userPresences: Map<string, UserPresence>;
  
  // Actions
  setMyStatus: (status: PresenceStatus) => void;
  setMyCustomStatus: (customStatus: string | null) => void;
  updateUserPresence: (userId: string, presence: UserPresence) => void;
  updateBulkPresences: (presences: Record<string, UserPresence>) => void;
  getUserStatus: (userId: string) => PresenceStatus;
  getUserPresence: (userId: string) => UserPresence | undefined;
  clearPresences: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  myStatus: 'online',
  myCustomStatus: null,
  userPresences: new Map(),

  setMyStatus: (status) => {
    set({ myStatus: status });
  },

  setMyCustomStatus: (customStatus) => {
    set({ myCustomStatus: customStatus });
  },

  updateUserPresence: (userId, presence) => {
    set((state) => {
      const newPresences = new Map(state.userPresences);
      newPresences.set(userId, presence);
      return { userPresences: newPresences };
    });
  },

  updateBulkPresences: (presences) => {
    set((state) => {
      const newPresences = new Map(state.userPresences);
      Object.entries(presences).forEach(([userId, presence]) => {
        newPresences.set(userId, presence);
      });
      return { userPresences: newPresences };
    });
  },

  getUserStatus: (userId) => {
    const presence = get().userPresences.get(userId);
    return presence?.status ?? 'offline';
  },

  getUserPresence: (userId) => {
    return get().userPresences.get(userId);
  },

  clearPresences: () => {
    set({ userPresences: new Map() });
  },
}));

// Status colors for UI
export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: '#22c55e', // green-500
  idle: '#eab308', // yellow-500
  dnd: '#ef4444', // red-500
  offline: '#6b7280', // gray-500
};

// Status labels for UI
export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'En ligne',
  idle: 'Inactif',
  dnd: 'Ne pas déranger',
  offline: 'Hors ligne',
};

// Idle timeout in milliseconds (5 minutes)
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Activity events to track for idle detection
export const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const;
