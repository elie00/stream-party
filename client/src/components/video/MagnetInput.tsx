import { useState } from 'react';
import { useToastStore } from '../ui/Toast';

interface MagnetInputProps {
  onSubmit: (magnetUri: string) => void;
  isLoading?: boolean;
}

export function MagnetInput({ onSubmit, isLoading = false }: MagnetInputProps) {
  const [value, setValue] = useState('');
  const addToast = useToastStore((state) => state.addToast);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      addToast('Please enter a magnet link', 'error');
      return;
    }
    if (!trimmed.startsWith('magnet:?')) {
      addToast('Invalid magnet link. Must start with "magnet:?"', 'error');
      return;
    }
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste a magnet link..."
        disabled={isLoading}
        className="flex-1 bg-[#222] border border-[#444] rounded-lg px-4 py-2 text-sm text-white placeholder-[#666] focus:border-[#7c3aed] focus:outline-none disabled:opacity-50 transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || !value.trim()}
        className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#444] disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
      >
        {isLoading ? 'Loading...' : 'Load'}
      </button>
    </div>
  );
}
