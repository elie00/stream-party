import { useState, useRef, useCallback, useEffect } from 'react';
import { MAX_CHAT_MESSAGE_LENGTH } from '@stream-party/shared';

interface ChatInputProps {
  onSend: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function ChatInput({ onSend, onTypingStart, onTypingStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 300ms of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop();
    }, 300);
  }, [onTypingStart, onTypingStop]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setValue('');

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
  }, [value, onSend, onTypingStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= MAX_CHAT_MESSAGE_LENGTH) {
        setValue(newValue);
        if (newValue.trim()) {
          handleTyping();
        }
      }
    },
    [handleTyping],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const showCharCount = value.length > 400;

  return (
    <div className="px-3 py-2.5 border-t border-[#333]">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          className="flex-1 bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim()}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#333] disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
      {showCharCount && (
        <div className="text-right mt-1">
          <span
            className={`text-[10px] ${
              value.length >= MAX_CHAT_MESSAGE_LENGTH ? 'text-red-400' : 'text-[#606060]'
            }`}
          >
            {value.length}/{MAX_CHAT_MESSAGE_LENGTH}
          </span>
        </div>
      )}
    </div>
  );
}
