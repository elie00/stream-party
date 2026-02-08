import type { ChatMessage } from '@stream-party/shared';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
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

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const color = getColor(message.userId);
  const initial = message.user.displayName.charAt(0).toUpperCase();

  return (
    <div className={`flex gap-2 px-3 py-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
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

        {/* Bubble */}
        <div
          className={`rounded-xl px-3 py-1.5 text-sm break-words ${
            isOwn
              ? 'bg-[#7c3aed] text-white rounded-br-sm'
              : 'bg-[#252525] text-white rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-[#606060] mt-0.5 px-1">
          {formatRelativeTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
