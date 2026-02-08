interface TypingIndicatorProps {
  typingUsers: Map<string, string>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.size === 0) return null;

  const names = Array.from(typingUsers.values());
  let text: string;

  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div className="px-4 py-1.5 text-xs text-[#808080] flex items-center gap-1">
      <span>{text}</span>
      <span className="typing-dots flex gap-0.5">
        <span
          className="inline-block w-1 h-1 rounded-full bg-[#808080] animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <span
          className="inline-block w-1 h-1 rounded-full bg-[#808080] animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '1s' }}
        />
        <span
          className="inline-block w-1 h-1 rounded-full bg-[#808080] animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '1s' }}
        />
      </span>
    </div>
  );
}
