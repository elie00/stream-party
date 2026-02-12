import { useState, useRef, useEffect } from 'react';
import { REACTION_EMOJIS } from '@stream-party/shared';

interface ReactionPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ onEmojiSelect, onClose }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
    onClose();
  };

  const togglePicker = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      onClose();
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={togglePicker}
        className="p-1 rounded hover:bg-[#3a3a3a] transition-colors text-[#888] hover:text-[#a78bfa]"
        title="Add reaction"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-[#2a2a2a] rounded-lg shadow-lg border border-[#3a3a3a] z-50">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3a3a3a] transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
