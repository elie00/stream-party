import { create } from 'zustand';
import type { ChatMessage, MessageReaction, MessageEmbed, MessageThread } from '@stream-party/shared';

interface ChatState {
  messages: ChatMessage[];
  typingUsers: Map<string, string>; // userId -> displayName
  hasMore: boolean;
  oldestCursor: string | null;
  
  // Editing state
  editingMessage: ChatMessage | null;
  replyingToMessage: ChatMessage | null;
  
  // Thread state
  activeThread: MessageThread | null;
  threadMessages: ChatMessage[];
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  setHistory: (messages: ChatMessage[], prepend?: boolean) => void;
  setTyping: (userId: string, displayName: string, isTyping: boolean) => void;
  addReaction: (messageId: string, reaction: MessageReaction) => void;
  removeReaction: (messageId: string, reactionId: string) => void;
  addEmbed: (messageId: string, embed: MessageEmbed) => void;
  clearMessages: () => void;
  
  // Edit/Delete actions
  setEditingMessage: (message: ChatMessage | null) => void;
  setReplyingToMessage: (message: ChatMessage | null) => void;
  updateMessage: (messageId: string, content: string, editedAt?: Date) => void;
  removeMessage: (messageId: string) => void;
  
  // Thread actions
  setActiveThread: (thread: MessageThread | null) => void;
  addReply: (reply: ChatMessage) => void;
  setThreadMessages: (messages: ChatMessage[]) => void;
  updateReplyCount: (messageId: string, count: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  typingUsers: new Map(),
  hasMore: true,
  oldestCursor: null,
  
  // Editing state
  editingMessage: null,
  replyingToMessage: null,
  
  // Thread state
  activeThread: null,
  threadMessages: [],

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

  addReaction: (messageId, reaction) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          // Check if reaction already exists
          if (reactions.some((r) => r.id === reaction.id)) {
            return msg;
          }
          return { ...msg, reactions: [...reactions, reaction] };
        }
        return msg;
      }),
    }));
  },

  removeReaction: (messageId, reactionId) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          return {
            ...msg,
            reactions: reactions.filter((r) => r.id !== reactionId),
          };
        }
        return msg;
      }),
    }));
  },

  addEmbed: (messageId, embed) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          const embeds = msg.embeds || [];
          // Check if embed already exists
          if (embeds.some((e) => e.id === embed.id)) {
            return msg;
          }
          return { ...msg, embeds: [...embeds, embed] };
        }
        return msg;
      }),
    }));
  },

  clearMessages: () => {
    set({
      messages: [],
      typingUsers: new Map(),
      hasMore: true,
      oldestCursor: null,
      editingMessage: null,
      replyingToMessage: null,
      activeThread: null,
      threadMessages: [],
    });
  },
  
  // Edit/Delete actions
  setEditingMessage: (message) => {
    set({ editingMessage: message });
  },
  
  setReplyingToMessage: (message) => {
    set({ replyingToMessage: message });
  },
  
  updateMessage: (messageId, content, editedAt) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          return { 
            ...msg, 
            content, 
            editedAt: editedAt || new Date(),
            isEditing: false 
          };
        }
        return msg;
      }),
      // Clear editing state if this was the message being edited
      editingMessage: state.editingMessage?.id === messageId ? null : state.editingMessage,
    }));
  },
  
  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          return { 
            ...msg, 
            content: '', 
            isDeleted: true,
            deletedAt: new Date(),
          };
        }
        return msg;
      }),
    }));
  },
  
  // Thread actions
  setActiveThread: (thread) => {
    set({ 
      activeThread: thread,
      threadMessages: thread?.replies || [],
    });
  },
  
  addReply: (reply) => {
    set((state) => ({
      threadMessages: [...state.threadMessages, reply],
      // Update reply count in active thread
      activeThread: state.activeThread 
        ? { 
            ...state.activeThread, 
            replyCount: (state.activeThread.replyCount || 0) + 1,
            replies: [...state.activeThread.replies, reply],
          }
        : null,
      // Update reply count in main messages
      messages: state.messages.map((msg) => {
        if (msg.id === reply.parentId) {
          return { ...msg, replyCount: (msg.replyCount || 0) + 1 };
        }
        return msg;
      }),
    }));
  },
  
  setThreadMessages: (messages) => {
    set({ threadMessages: messages });
  },
  
  updateReplyCount: (messageId, count) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === messageId) {
          return { ...msg, replyCount: count };
        }
        return msg;
      }),
      // Also update active thread if it matches
      activeThread: state.activeThread?.parentMessage.id === messageId
        ? { ...state.activeThread, replyCount: count }
        : state.activeThread,
    }));
  },
}));
