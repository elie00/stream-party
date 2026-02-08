import { useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@stream-party/shared';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function MessageList({ messages, currentUserId, hasMore, onLoadMore }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Check if user is near the bottom of the scroll area
  const checkNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const threshold = 100;
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    const newCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    // If a new message was appended (not prepended via history load)
    if (newCount > prevCount && newCount - prevCount <= 5 && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && prevMessageCountRef.current === 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-thin"
      onScroll={checkNearBottom}
    >
      {/* Load older messages button */}
      {hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={onLoadMore}
            className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors px-3 py-1 rounded hover:bg-[#252525]"
          >
            Load older messages
          </button>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-[#606060] text-sm">
          No messages yet. Say hello!
        </div>
      )}

      {/* Messages */}
      <div className="py-2 space-y-1">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === currentUserId}
          />
        ))}
      </div>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
