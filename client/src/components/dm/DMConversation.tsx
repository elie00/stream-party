import { useRef, useEffect, useCallback } from 'react';
import type { DirectMessage, DirectMessageChannel } from '@stream-party/shared';

interface DMConversationProps {
  channel: DirectMessageChannel;
  messages: DirectMessage[];
  currentUserId: string | null;
  typingUsers: Map<string, boolean>;
  onSend: (content: string) => void;
  onTypingStart: (channelId: string) => void;
  onTypingStop: (channelId: string) => void;
  onLoadMore: (channelId: string, cursor: string) => void;
  onBack: () => void;
}

const AVATAR_COLORS = [
  '#e53e3e', '#dd6b20', '#d69e2e', '#38a169',
  '#319795', '#3182ce', '#5a67d8', '#805ad5',
  '#d53f8c', '#e53e3e', '#ed8936', '#48bb78',
];

function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function DMConversation({
  channel,
  messages,
  currentUserId,
  typingUsers,
  onSend,
  onTypingStart,
  onTypingStop,
  onLoadMore,
  onBack,
}: DMConversationProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const otherParticipant = channel.participants.find((p) => p.userId !== currentUserId) || channel.participants[0];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart(channel.id);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop(channel.id);
    }, 300);
  }, [channel.id, onTypingStart, onTypingStop]);

  const handleSend = useCallback(() => {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    onSend(value);
    if (inputRef.current) inputRef.current.value = '';
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop(channel.id);
    }
  }, [onSend, channel.id, onTypingStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop === 0 && messages.length > 0) {
      onLoadMore(channel.id, messages[0].id);
    }
  }, [channel.id, messages, onLoadMore]);

  // Get typing user names
  const typingNames = channel.participants
    .filter((p) => p.userId !== currentUserId && typingUsers.get(p.userId))
    .map((p) => p.displayName);

  // Group messages by date
  let lastDate = '';

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#333] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-[#333] text-[#a0a0a0] hover:text-white transition-colors md:hidden"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ backgroundColor: getColor(otherParticipant.userId) }}>
          {otherParticipant.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">{otherParticipant.displayName}</h3>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        onScroll={handleScroll}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4"
              style={{ backgroundColor: getColor(otherParticipant.userId) }}
            >
              {otherParticipant.displayName.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-white font-semibold text-lg">{otherParticipant.displayName}</h3>
            <p className="text-[#606060] text-sm mt-1">
              Début de votre conversation avec {otherParticipant.displayName}
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUserId;
          const msgDate = formatDateSeparator(msg.createdAt);
          const showDateSeparator = msgDate !== lastDate;
          lastDate = msgDate;

          // Check if previous message is from same sender (for grouping)
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const isGrouped = prevMsg?.senderId === msg.senderId && !showDateSeparator;

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#333]" />
                  <span className="text-[10px] text-[#606060] font-medium">{msgDate}</span>
                  <div className="flex-1 h-px bg-[#333]" />
                </div>
              )}

              <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
                {/* Avatar (only for first in group) */}
                {!isOwn && !isGrouped && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getColor(msg.senderId) }}
                  >
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                )}
                {!isOwn && isGrouped && <div className="w-7 flex-shrink-0" />}

                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isOwn && !isGrouped && (
                    <span className="text-xs font-medium mb-0.5 px-1" style={{ color: getColor(msg.senderId) }}>
                      {msg.senderName}
                    </span>
                  )}
                  <div className="flex items-end gap-1">
                    <div
                      className={`rounded-xl px-3 py-1.5 text-sm break-words ${
                        isOwn
                          ? 'bg-[#7c3aed] text-white rounded-br-sm'
                          : 'bg-[#252525] text-white rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {!isGrouped && (
                    <span className="text-[10px] text-[#606060] mt-0.5 px-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-[#606060] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-[#606060]">
              {typingNames.join(', ')} {typingNames.length === 1 ? 'écrit' : 'écrivent'}...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-[#333] flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder={`Message à ${otherParticipant.displayName}`}
            maxLength={500}
            className="flex-1 bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
          />
          <button
            onClick={handleSend}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white p-2 rounded-lg transition-colors flex-shrink-0"
            aria-label="Envoyer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
