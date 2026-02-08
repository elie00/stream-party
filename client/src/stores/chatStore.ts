import { create } from 'zustand';
import type { ChatMessage } from '@stream-party/shared';

interface ChatState {
  messages: ChatMessage[];
  typingUsers: Map<string, string>; // userId -> displayName
  hasMore: boolean;
  oldestCursor: string | null;
  addMessage: (message: ChatMessage) => void;
  setHistory: (messages: ChatMessage[], prepend?: boolean) => void;
  setTyping: (userId: string, displayName: string, isTyping: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  typingUsers: new Map(),
  hasMore: true,
  oldestCursor: null,

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setHistory: (messages, prepend = false) => {
    set((state) => {
      if (prepend) {
        // Prepending older messages to the beginning
        const newOldest = messages.length > 0 ? messages[0].id : state.oldestCursor;
        return {
          messages: [...messages, ...state.messages],
          hasMore: messages.length >= 50,
          oldestCursor: newOldest,
        };
      }
      // Initial load
      const oldest = messages.length > 0 ? messages[0].id : null;
      return {
        messages,
        hasMore: messages.length >= 50,
        oldestCursor: oldest,
      };
    });
  },

  setTyping: (userId, displayName, isTyping) => {
    set((state) => {
      const newMap = new Map(state.typingUsers);
      if (isTyping) {
        newMap.set(userId, displayName);
      } else {
        newMap.delete(userId);
      }
      return { typingUsers: newMap };
    });
  },

  clearMessages: () => {
    set({
      messages: [],
      typingUsers: new Map(),
      hasMore: true,
      oldestCursor: null,
    });
  },
}));
