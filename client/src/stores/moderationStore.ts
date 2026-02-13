import { create } from 'zustand';
import type {
  Role,
  ModerationLogWithUsers,
  MutedUserWithDetails,
  BannedUserWithDetails,
  AutoModConfig,
  Permission,
} from '@stream-party/shared';
import { getSocket } from '../services/socket';

interface ModerationState {
  roles: Role[];
  logs: ModerationLogWithUsers[];
  mutedUsers: MutedUserWithDetails[];
  bannedUsers: BannedUserWithDetails[];
  autoModConfig: AutoModConfig | null;
  isLoadingRoles: boolean;
  isLoadingLogs: boolean;
  isLoadingMuted: boolean;
  isLoadingBanned: boolean;
  isLoadingConfig: boolean;
  error: string | null;

  // Data setters
  setRoles: (roles: Role[]) => void;
  setLogs: (logs: ModerationLogWithUsers[]) => void;
  setMutedUsers: (users: MutedUserWithDetails[]) => void;
  setBannedUsers: (users: BannedUserWithDetails[]) => void;
  setAutoModConfig: (config: AutoModConfig) => void;
  setError: (error: string | null) => void;

  // Add/remove from lists
  addLog: (log: ModerationLogWithUsers) => void;
  addMutedUser: (user: MutedUserWithDetails) => void;
  removeMutedUser: (userId: string) => void;
  addBannedUser: (user: BannedUserWithDetails) => void;
  removeBannedUser: (userId: string) => void;

  // Socket action dispatchers
  fetchLogs: (serverId: string) => void;
  fetchMuted: (serverId: string) => void;
  fetchBanned: (serverId: string) => void;
  fetchConfig: (serverId: string) => void;

  warnUser: (serverId: string, targetId: string, reason: string) => void;
  muteUser: (serverId: string, targetId: string, reason: string, duration?: number) => void;
  unmuteUser: (serverId: string, targetId: string) => void;
  kickUser: (serverId: string, targetId: string, reason: string) => void;
  banUser: (serverId: string, targetId: string, reason: string) => void;
  unbanUser: (serverId: string, targetId: string) => void;

  updateConfig: (serverId: string, config: Partial<AutoModConfig>) => void;

  clearStore: () => void;
}

export const useModerationStore = create<ModerationState>((set) => ({
  roles: [],
  logs: [],
  mutedUsers: [],
  bannedUsers: [],
  autoModConfig: null,
  isLoadingRoles: false,
  isLoadingLogs: false,
  isLoadingMuted: false,
  isLoadingBanned: false,
  isLoadingConfig: false,
  error: null,

  setRoles: (roles) => set({ roles, isLoadingRoles: false }),
  setLogs: (logs) => set({ logs, isLoadingLogs: false }),
  setMutedUsers: (users) => set({ mutedUsers: users, isLoadingMuted: false }),
  setBannedUsers: (users) => set({ bannedUsers: users, isLoadingBanned: false }),
  setAutoModConfig: (config) => set({ autoModConfig: config, isLoadingConfig: false }),
  setError: (error) => set({ error }),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs],
    })),

  addMutedUser: (user) =>
    set((state) => {
      if (state.mutedUsers.some((u) => u.userId === user.userId)) return state;
      return { mutedUsers: [...state.mutedUsers, user] };
    }),

  removeMutedUser: (userId) =>
    set((state) => ({
      mutedUsers: state.mutedUsers.filter((u) => u.userId !== userId),
    })),

  addBannedUser: (user) =>
    set((state) => {
      if (state.bannedUsers.some((u) => u.userId === user.userId)) return state;
      return { bannedUsers: [...state.bannedUsers, user] };
    }),

  removeBannedUser: (userId) =>
    set((state) => ({
      bannedUsers: state.bannedUsers.filter((u) => u.userId !== userId),
    })),

  fetchLogs: (serverId) => {
    set({ isLoadingLogs: true });
    const socket = getSocket();
    socket.emit('mod:get-logs' as any, { serverId });
  },

  fetchMuted: (serverId) => {
    set({ isLoadingMuted: true });
    const socket = getSocket();
    socket.emit('mod:get-muted' as any, { serverId });
  },

  fetchBanned: (serverId) => {
    set({ isLoadingBanned: true });
    const socket = getSocket();
    socket.emit('mod:get-banned' as any, { serverId });
  },

  fetchConfig: (serverId) => {
    set({ isLoadingConfig: true });
    const socket = getSocket();
    socket.emit('mod:get-config' as any, { serverId });
  },

  warnUser: (serverId, targetId, reason) => {
    const socket = getSocket();
    socket.emit('mod:warn' as any, { serverId, targetId, reason });
  },

  muteUser: (serverId, targetId, reason, duration) => {
    const socket = getSocket();
    socket.emit('mod:mute' as any, { serverId, targetId, reason, duration });
  },

  unmuteUser: (serverId, targetId) => {
    const socket = getSocket();
    socket.emit('mod:unmute' as any, { serverId, targetId });
  },

  kickUser: (serverId, targetId, reason) => {
    const socket = getSocket();
    socket.emit('mod:kick' as any, { serverId, targetId, reason });
  },

  banUser: (serverId, targetId, reason) => {
    const socket = getSocket();
    socket.emit('mod:ban' as any, { serverId, targetId, reason });
  },

  unbanUser: (serverId, targetId) => {
    const socket = getSocket();
    socket.emit('mod:unban' as any, { serverId, targetId });
  },

  updateConfig: (serverId, config) => {
    const socket = getSocket();
    socket.emit('mod:update-config' as any, { serverId, config });
  },

  clearStore: () =>
    set({
      roles: [],
      logs: [],
      mutedUsers: [],
      bannedUsers: [],
      autoModConfig: null,
      isLoadingRoles: false,
      isLoadingLogs: false,
      isLoadingMuted: false,
      isLoadingBanned: false,
      isLoadingConfig: false,
      error: null,
    }),
}));
