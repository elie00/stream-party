import { create } from 'zustand';
import type { Server, ServerWithDetails, Channel, ServerMemberWithUser, ServerRole } from '@stream-party/shared';
import { useAuthStore } from './authStore';

interface ServerStoreState {
  // List of servers the user is a member of
  servers: Server[];
  // Currently active server
  activeServer: ServerWithDetails | null;
  // Currently active channel
  activeChannel: Channel | null;
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  removeServer: (serverId: string) => void;
  setActiveServer: (server: ServerWithDetails | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  addChannel: (serverId: string, channel: Channel) => void;
  removeChannel: (serverId: string, channelId: string) => void;
  addMember: (serverId: string, member: ServerMemberWithUser) => void;
  removeMember: (serverId: string, userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearStore: () => void;
}

export const useServerStore = create<ServerStoreState>((set) => ({
  servers: [],
  activeServer: null,
  activeChannel: null,
  isLoading: false,
  error: null,

  setServers: (servers) => {
    set({ servers });
  },

  addServer: (server) => {
    set((state) => ({
      servers: [...state.servers, server],
    }));
  },

  removeServer: (serverId) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== serverId),
      activeServer: state.activeServer?.id === serverId ? null : state.activeServer,
      activeChannel: state.activeServer?.id === serverId ? null : state.activeChannel,
    }));
  },

  setActiveServer: (server) => {
    set((state) => ({
      activeServer: server,
      // Reset active channel when changing server
      activeChannel: server?.channels.find((c) => c.type === 'text') || server?.channels[0] || null,
    }));
  },

  setActiveChannel: (channel) => {
    set({ activeChannel: channel });
  },

  addChannel: (serverId, channel) => {
    set((state) => {
      if (!state.activeServer || state.activeServer.id !== serverId) return state;
      return {
        activeServer: {
          ...state.activeServer,
          channels: [...state.activeServer.channels, channel].sort((a, b) => a.position - b.position),
        },
      };
    });
  },

  removeChannel: (serverId, channelId) => {
    set((state) => {
      if (!state.activeServer || state.activeServer.id !== serverId) return state;
      const newChannels = state.activeServer.channels.filter((c) => c.id !== channelId);
      return {
        activeServer: {
          ...state.activeServer,
          channels: newChannels,
        },
        activeChannel: state.activeChannel?.id === channelId 
          ? newChannels.find((c) => c.type === 'text') || newChannels[0] || null
          : state.activeChannel,
      };
    });
  },

  addMember: (serverId, member) => {
    set((state) => {
      if (!state.activeServer || state.activeServer.id !== serverId) return state;
      return {
        activeServer: {
          ...state.activeServer,
          members: [...state.activeServer.members, member],
        },
      };
    });
  },

  removeMember: (serverId, userId) => {
    set((state) => {
      if (!state.activeServer || state.activeServer.id !== serverId) return state;
      return {
        activeServer: {
          ...state.activeServer,
          members: state.activeServer.members.filter((m) => m.userId !== userId),
        },
      };
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  clearStore: () => {
    set({
      servers: [],
      activeServer: null,
      activeChannel: null,
      isLoading: false,
      error: null,
    });
  },
}));

// Computed selectors
export const useIsServerOwner = () => {
  const activeServer = useServerStore((state) => state.activeServer);
  const userId = useAuthStore((state) => state.userId);
  return activeServer?.ownerId === userId;
};

export const useServerRole = () => {
  const activeServer = useServerStore((state) => state.activeServer);
  const userId = useAuthStore((state) => state.userId);
  
  if (!activeServer) return null;
  
  const member = activeServer.members.find((m) => m.userId === userId);
  return member?.role as ServerRole | null;
};

export const useCanManageChannels = () => {
  const role = useServerRole();
  return role !== null && ['owner', 'admin', 'moderator'].includes(role);
};

export const useCanManageServer = () => {
  const role = useServerRole();
  return role !== null && ['owner', 'admin'].includes(role);
};

export const useTextChannels = () => {
  const activeServer = useServerStore((state) => state.activeServer);
  return activeServer?.channels.filter((c) => c.type === 'text') || [];
};

export const useVoiceChannels = () => {
  const activeServer = useServerStore((state) => state.activeServer);
  return activeServer?.channels.filter((c) => c.type === 'voice') || [];
};
