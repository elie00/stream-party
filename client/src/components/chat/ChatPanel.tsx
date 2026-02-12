import { useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../services/socket';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { messages, typingUsers, hasMore, oldestCursor } = useChatStore();
  const userId = useAuthStore((state) => state.userId);

  const handleSend = useCallback((content: string) => {
    const socket = getSocket();
    socket.emit('chat:message', { content });
  }, []);

  const handleTypingStart = useCallback(() => {
    const socket = getSocket();
    socket.emit('chat:typing-start');
  }, []);

  const handleTypingStop = useCallback(() => {
    const socket = getSocket();
    socket.emit('chat:typing-stop');
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || !oldestCursor) return;
    const socket = getSocket();
    socket.emit('chat:history', { cursor: oldestCursor, limit: 50 });
  }, [hasMore, oldestCursor]);

  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    socket.emit('reaction:add', { messageId, emoji });
  }, []);

  const handleRemoveReaction = useCallback((messageId: string, reactionId: string) => {
    const socket = getSocket();
    socket.emit('reaction:remove', { messageId, reactionId });
  }, []);

  return (
    <div className="w-80 bg-[#1a1a1a] border-l border-[#333] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#333] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Chat</h2>
          {messages.length > 0 && (
            <span className="text-xs text-[#808080] bg-[#252525] px-1.5 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[#a0a0a0] hover:text-white transition-colors text-lg leading-none"
          aria-label="Close chat"
        >
          &times;
        </button>
      </div>

      {/* Message list */}
      <MessageList
        messages={messages}
        currentUserId={userId}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onAddReaction={handleAddReaction}
        onRemoveReaction={handleRemoveReaction}
      />

      {/* Typing indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
      />
    </div>
  );
}
