import type { MessageReaction } from '@stream-party/shared';

interface MessageReactionsProps {
  reactions: MessageReaction[];
  currentUserId: string;
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (reactionId: string) => void;
}

// Group reactions by emoji
function groupReactions(reactions: MessageReaction[]): Map<string, { count: number; userReacted: boolean; reactionId?: string }> {
  const grouped = new Map<string, { count: number; userReacted: boolean; reactionId?: string }>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(reaction.emoji, {
        count: 1,
        userReacted: false,
      });
    }
  }

  return grouped;
}

export function MessageReactions({
  reactions,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
}: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) {
    return null;
  }

  // Group reactions by emoji and track if current user reacted
  const grouped = new Map<string, { count: number; userReacted: boolean; reactionId?: string }>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji);
    if (existing) {
      existing.count++;
      if (reaction.userId === currentUserId) {
        existing.userReacted = true;
        existing.reactionId = reaction.id;
      }
    } else {
      grouped.set(reaction.emoji, {
        count: 1,
        userReacted: reaction.userId === currentUserId,
        reactionId: reaction.userId === currentUserId ? reaction.id : undefined,
      });
    }
  }

  const handleClick = (emoji: string, data: { userReacted: boolean; reactionId?: string }) => {
    if (data.userReacted && data.reactionId) {
      onRemoveReaction(data.reactionId);
    } else {
      onAddReaction(emoji);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Array.from(grouped.entries()).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => handleClick(emoji, data)}
          className={`
            flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs
            transition-colors duration-150
            ${data.userReacted
              ? 'bg-[#7c3aed]/30 border border-[#7c3aed]/50 hover:bg-[#7c3aed]/40'
              : 'bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a]'
            }
          `}
        >
          <span>{emoji}</span>
          <span className={data.userReacted ? 'text-[#a78bfa]' : 'text-[#888]'}>
            {data.count}
          </span>
        </button>
      ))}
    </div>
  );
}
