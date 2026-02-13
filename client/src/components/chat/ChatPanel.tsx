import { useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../services/socket';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ThreadView } from './ThreadView';
import type { ChatMessage } from '@stream-party/shared';

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { 
    messages, 
    typingUsers, 
    hasMore, 
    oldestCursor,
    editingMessage,
    replyingToMessage,
    activeThread,
    setEditingMessage,
    setReplyingToMessage,
    updateMessage,
    removeMessage,
    setActiveThread,
    addReply,
  } = useChatStore();
  const userId = useAuthStore((state) => state.userId);
  const [showThread, setShowThread] = useState(false);

  const handleSend = useCallback((content: string, attachments?: string[]) => {
    const socket = getSocket();
    socket.emit('chat:message', { content, attachments });
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

  // Edit handlers
  const handleEdit = useCallback((message: ChatMessage) => {
    setEditingMessage(message);
  }, [setEditingMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, [setEditingMessage]);

  const handleSubmitEdit = useCallback((messageId: string, content: string) => {
    const socket = getSocket();
    socket.emit('message:edit', { messageId, content });
    setEditingMessage(null);
  }, [setEditingMessage]);

  // Delete handler
  const handleDelete = useCallback((messageId: string) => {
    const socket = getSocket();
    socket.emit('message:delete', { messageId });
  }, []);

  // Reply handler
  const handleReply = useCallback((message: ChatMessage) => {
    setReplyingToMessage({ 
      id: message.id, 
      userName: message.user.displayName 
    });
  }, [setReplyingToMessage]);

  const handleCancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, [setReplyingToMessage]);

  const handleSubmitReply = useCallback((content: string, parentId: string) => {
    const socket = getSocket();
    socket.emit('message:reply', { content, parentId });
    setReplyingToMessage(null);
  }, [setReplyingToMessage]);

  // Thread handlers
  const handleOpenThread = useCallback((message: ChatMessage) => {
    const socket = getSocket();
    socket.emit('thread:open', { parentMessageId: message.id });
  }, []);

  const handleCloseThread = useCallback(() => {
    setShowThread(false);
    setActiveThread(null);
  }, [setActiveThread]);

  // Listen for socket events
  const socket = getSocket();
  
  // Handle edited message
  socket.on('message:edited', (data: { messageId: string; content: string; editedAt: Date }) => {
    updateMessage(data.messageId, data.content, new Date(data.editedAt));
  });

  // Handle deleted message
  socket.on('message:deleted', (data: { messageId: string }) => {
    removeMessage(data.messageId);
  });

  // Handle thread opened
  socket.on('thread:opened', (data: { thread: { id: string; parentMessage: ChatMessage; replies: ChatMessage[]; replyCount: number } }) => {
    setActiveThread(data.thread as any);
    setShowThread(true);
  });

  // Handle new reply
  socket.on('thread:reply', (data: { reply: ChatMessage; replyCount: number }) => {
    addReply(data.reply);
  });

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
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReply={handleReply}
        onOpenThread={handleOpenThread}
      />

      {/* Typing indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        editingMessage={editingMessage ? { id: editingMessage.id, content: editingMessage.content } : null}
        replyingToMessage={replyingToMessage ? { id: replyingToMessage.id, userName: replyingToMessage.userName } : null}
        onCancelEdit={handleCancelEdit}
        onCancelReply={handleCancelReply}
        onSubmitEdit={handleSubmitEdit}
        onSubmitReply={handleSubmitReply}
      />

      {/* Thread View Modal */}
      {showThread && activeThread && (
        <ThreadView
          thread={activeThread}
          currentUserId={userId}
          onClose={handleCloseThread}
          onAddReaction={handleAddReaction}
          onRemoveReaction={handleRemoveReaction}
          onReply={handleSubmitReply}
        />
      )}
    </div>
  );
}
