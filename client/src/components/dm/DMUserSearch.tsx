import { useState, useCallback, useRef, useEffect } from 'react';
import { getSocket } from '../../services/socket';

interface DMUserSearchProps {
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

interface SearchUser {
  id: string;
  displayName: string;
}

export function DMUserSearch({ onSelectUser, onClose }: DMUserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const socket = getSocket();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (data: { users: SearchUser[] }) => {
      setResults(data.users);
      setLoading(false);
    };

    socket.on('search:users-results' as any, handler);
    return () => {
      socket.off('search:users-results' as any, handler);
    };
  }, [socket]);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim().length >= 2) {
        setLoading(true);
        socket.emit('search:users' as any, { query: value.trim() });
      } else {
        setResults([]);
      }
    },
    [socket],
  );

  return (
    <div className="absolute inset-0 bg-[#1a1a1a] z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-[#333]">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[#333] text-[#a0a0a0] hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-white font-medium text-sm">Nouveau message</h3>
      </div>

      {/* Search input */}
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="w-5 h-5 animate-spin text-[#7c3aed]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-center text-[#606060] text-sm py-8">Aucun utilisateur trouvé</p>
        )}

        {!loading && query.length < 2 && (
          <p className="text-center text-[#606060] text-sm py-8">
            Tapez au moins 2 caractères pour rechercher
          </p>
        )}

        {results.map((user) => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white text-sm">{user.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
