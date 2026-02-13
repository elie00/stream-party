import { create } from 'zustand';
import type { DirectMessageChannel, DirectMessage } from '@stream-party/shared';

interface DMState {
  channels: DirectMessageChannel[];
  activeChannel: DirectMessageChannel | null;
  messages: Record<string, DirectMessage[]>;
  typingUsers: Record<string, Map<string, boolean>>;
  unreadCounts: Record<string, number>;
  setChannels: (channels: DirectMessageChannel[]) => void;
  setActiveChannel: (channel: DirectMessageChannel | null) => void;
  addMessage: (channelId: string, message: DirectMessage) => void;
  setMessages: (channelId: string, messages: DirectMessage[]) => void;
  prependMessages: (channelId: string, messages: DirectMessage[]) => void;
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  updateChannelLastMessage: (channelId: string, message: DirectMessage) => void;
  reset: () => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  channels: [],
  activeChannel: null,
  messages: {},
  typingUsers: {},
  unreadCounts: {},

  setChannels: (channels) => set({ channels }),

  setActiveChannel: (channel) => {
    set({ activeChannel: channel });
    if (channel) {
      // Clear unread when opening a channel
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [channel.id]: 0 },
      }));
    }
  },

  addMessage: (channelId, message) => {
    set((state) => {
      const existing = state.messages[channelId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [channelId]: [...existing, message],
        },
      };
    });
  },

  setMessages: (channelId, messages) => {
    set((state) => ({
      messages: { ...state.messages, [channelId]: messages },
    }));
  },

  prependMessages: (channelId, messages) => {
    set((state) => {
      const existing = state.messages[channelId] || [];
      return {
        messages: {
          ...state.messages,
          [channelId]: [...messages, ...existing],
        },
      };
    });
  },

  setTyping: (channelId, userId, isTyping) => {
    set((state) => {
      const channelTyping = new Map(state.typingUsers[channelId] || new Map());
      if (isTyping) {
        channelTyping.set(userId, true);
      } else {
        channelTyping.delete(userId);
      }
      return {
        typingUsers: { ...state.typingUsers, [channelId]: channelTyping },
      };
    });
  },

  incrementUnread: (channelId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: (state.unreadCounts[channelId] || 0) + 1,
      },
    }));
  },

  clearUnread: (channelId) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
    }));
  },

  updateChannelLastMessage: (channelId, message) => {
    set((state) => ({
      channels: state.channels.map((ch) =>
        ch.id === channelId ? { ...ch, lastMessage: message } : ch,
      ),
    }));
  },

  reset: () =>
    set({
      channels: [],
      activeChannel: null,
      messages: {},
      typingUsers: {},
      unreadCounts: {},
    }),
}));
