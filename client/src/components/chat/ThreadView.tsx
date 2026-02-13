import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, MessageThread } from '@stream-party/shared';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../stores/chatStore';

interface ThreadViewProps {
  thread: MessageThread;
  currentUserId: string;
  onClose: () => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, reactionId: string) => void;
  onReply: (content: string, parentId: string) => void;
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffDiffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(date).toLocaleDateString();
}

export function ThreadView({
  thread,
  currentUserId,
  onClose,
  onAddReaction,
  onRemoveReaction,
  onReply,
}: ThreadViewProps) {
  const [replyContent, setReplyContent] = useState('');
  const { threadMessages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const parentMessage = thread.parentMessage;
  const replies = threadMessages.length > 0 ? threadMessages : thread.replies;

  const handleSubmitReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent.trim(), parentMessage.id);
      setReplyContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
  };

  // Auto-scroll to bottom on new replies
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1a] w-full max-w-lg h-[80vh] rounded-lg shadow-xl flex flex-col border border-[#333]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white">Thread</h3>
            <p className="text-xs text-[#a0a0a0]">
              {thread.replyCount} réponse{thread.replyCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thread content */}
        <div className="flex-1 overflow-y-auto">
          {/* Parent message */}
          <div className="p-3 border-b border-[#333] bg-[#252525]/50">
            <MessageBubble
              message={parentMessage}
              isOwn={parentMessage.userId === currentUserId}
              currentUserId={currentUserId}
              onAddReaction={onAddReaction}
              onRemoveReaction={onRemoveReaction}
              onEdit={() => {}}
              onDelete={() => {}}
              onReply={() => {}}
              onOpenThread={() => {}}
            />
          </div>

          {/* Replies */}
          <div className="py-2 space-y-1">
            {replies.map((reply) => (
              <MessageBubble
                key={reply.id}
                message={reply}
                isOwn={reply.userId === currentUserId}
                currentUserId={currentUserId}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                onEdit={() => {}}
                onDelete={() => {}}
                onReply={() => {}}
                onOpenThread={() => {}}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Reply input */}
        <div className="p-3 border-t border-[#333] flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Répondre au thread..."
              className="flex-1 bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
            />
            <button
              onClick={handleSubmitReply}
              disabled={!replyContent.trim()}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#333] disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
