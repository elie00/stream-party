import { useState } from 'react';
import type { DirectMessageChannel } from '@stream-party/shared';
import { DMUserSearch } from './DMUserSearch';

interface DMListProps {
  channels: DirectMessageChannel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  currentUserId: string | null;
  onSelectChannel: (channel: DirectMessageChannel) => void;
  onOpenNewDM: (targetUserId: string) => void;
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(date).toLocaleDateString();
}

export function DMList({
  channels,
  activeChannelId,
  unreadCounts,
  currentUserId,
  onSelectChannel,
  onOpenNewDM,
}: DMListProps) {
  const [showSearch, setShowSearch] = useState(false);

  const getOtherParticipant = (channel: DirectMessageChannel) => {
    return channel.participants.find((p) => p.userId !== currentUserId) || channel.participants[0];
  };

  const handleSelectUser = (userId: string) => {
    onOpenNewDM(userId);
    setShowSearch(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#333]">
        <h2 className="text-white font-semibold text-sm">Messages directs</h2>
        <button
          onClick={() => setShowSearch(true)}
          className="p-1.5 rounded-lg bg-[#252525] text-[#a0a0a0] hover:text-white hover:bg-[#333] transition-colors"
          title="Nouveau message"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <svg className="w-12 h-12 text-[#333] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-[#606060] text-sm text-center">Aucune conversation</p>
            <button
              onClick={() => setShowSearch(true)}
              className="mt-3 text-[#7c3aed] text-sm hover:underline"
            >
              Démarrer une conversation
            </button>
          </div>
        )}

        {channels.map((channel) => {
          const other = getOtherParticipant(channel);
          const unread = unreadCounts[channel.id] || 0;
          const isActive = channel.id === activeChannelId;

          return (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-[#252525] border-l-2 border-[#7c3aed]'
                  : 'hover:bg-[#222] border-l-2 border-transparent'
              }`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {other.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${unread > 0 ? 'text-white font-semibold' : 'text-[#d0d0d0]'}`}>
                    {other.displayName}
                  </span>
                  {channel.lastMessage && (
                    <span className="text-[10px] text-[#606060] flex-shrink-0 ml-2">
                      {formatRelativeTime(channel.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                {channel.lastMessage && (
                  <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-[#a0a0a0]' : 'text-[#606060]'}`}>
                    {channel.lastMessage.senderId === currentUserId ? 'Vous: ' : ''}
                    {channel.lastMessage.content}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {unread > 0 && (
                <span className="bg-[#7c3aed] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User search overlay */}
      {showSearch && (
        <DMUserSearch onSelectUser={handleSelectUser} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
