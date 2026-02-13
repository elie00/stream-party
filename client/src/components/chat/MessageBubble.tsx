import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@stream-party/shared';
import { MessageReactions } from './MessageReactions';
import { MessageEmbed } from './MessageEmbed';
import { ReactionPicker } from './ReactionPicker';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, reactionId: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onReply: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
}

// Deterministic color based on userId hash
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

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(date).toLocaleDateString();
}

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  onEdit,
  onDelete,
  onReply,
  onOpenThread,
}: MessageBubbleProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const color = getColor(message.userId);
  const initial = message.user.displayName.charAt(0).toUpperCase();

  const isAuthor = message.userId === currentUserId;
  const hasReplies = (message.replyCount || 0) > 0;

  const handleAddReaction = (emoji: string) => {
    onAddReaction(message.id, emoji);
  };

  const handleRemoveReaction = (reactionId: string) => {
    onRemoveReaction(message.id, reactionId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  // Handle deleted message
  if (message.isDeleted) {
    return (
      <div className={`flex gap-2 px-3 py-1 opacity-50 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOwn && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
            style={{ backgroundColor: color }}
          >
            {initial}
          </div>
        )}
        <div className={`max-w-[80%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isOwn && (
            <span className="text-xs font-medium mb-0.5 px-1" style={{ color }}>
              {message.user.displayName}
            </span>
          )}
          <div className="text-sm text-[#606060] italic">
            Message supprimé
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex gap-2 px-3 py-1 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar */}
      {!isOwn && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-[80%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Display name (only for others) */}
        {!isOwn && (
          <span className="text-xs font-medium mb-0.5 px-1" style={{ color }}>
            {message.user.displayName}
          </span>
        )}

        {/* Bubble with reaction button */}
        <div className="relative flex items-end gap-1">
          <div
            className={`rounded-xl px-3 py-1.5 text-sm break-words ${
              isOwn
                ? 'bg-[#7c3aed] text-white rounded-br-sm'
                : 'bg-[#252525] text-white rounded-bl-sm'
            }`}
          >
            {message.content}
          </div>

          {/* Action buttons (visible on hover) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            {/* Reply button */}
            <button
              onClick={() => onReply(message)}
              className="p-1 rounded hover:bg-[#333] text-[#a0a0a0] hover:text-white"
              title="Répondre"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            
            {/* Reaction picker */}
            <ReactionPicker
              onEmojiSelect={handleAddReaction}
              onClose={() => {}}
            />
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <MessageReactions
            reactions={message.reactions}
            currentUserId={currentUserId}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
          />
        )}

        {/* Embeds */}
        {message.embeds && message.embeds.length > 0 && (
          <div className="mt-1 space-y-2">
            {message.embeds.map((embed) => (
              <MessageEmbed key={embed.id} embed={embed} />
            ))}
          </div>
        )}

        {/* Timestamp and edited indicator */}
        <div className="flex items-center gap-2 mt-0.5 px-1">
          <span className="text-[10px] text-[#606060]">
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.editedAt && (
            <span className="text-[10px] text-[#606060]">(modifié)</span>
          )}
          {/* Thread replies button */}
          {hasReplies && !message.parentId && (
            <button 
              onClick={() => onOpenThread(message)}
              className="text-[10px] text-[#7c3aed] hover:underline"
            >
              {message.replyCount} réponse{message.replyCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          {/* Reply option */}
          <button
            onClick={() => {
              onReply(message);
              setShowContextMenu(false);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#333] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Répondre
          </button>
          
          {/* Open thread option */}
          {hasReplies && !message.parentId && (
            <button
              onClick={() => {
                onOpenThread(message);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#333] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Voir les réponses
            </button>
          )}

          {/* Edit option - only for author */}
          {isAuthor && (
            <button
              onClick={() => {
                onEdit(message);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#333] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
          )}

          {/* Delete option - only for author */}
          {isAuthor && (
            <button
              onClick={() => {
                onDelete(message.id);
                setShowContextMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[#333] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer
            </button>
          )}

          {/* Copy content option */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(message.content);
              setShowContextMenu(false);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-[#333] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copier
          </button>
        </div>
      )}
    </div>
  );
}
