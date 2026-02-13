/**
 * SearchBar Component
 * Full-text search bar for messages and users
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { socket } from '../../services/socket';
import { SearchResult } from '@stream-party/shared';

interface SearchBarProps {
  serverId?: string;
  channelId?: string;
  roomId?: string;
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  serverId,
  channelId,
  roomId,
  onResultSelect,
  placeholder = 'Rechercher...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<'messages' | 'users'>('messages');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const performSearch = useCallback((searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (searchType === 'messages') {
      if (roomId) {
        socket.emit('search:room-messages', { roomId, query: searchQuery });
      } else {
        socket.emit('search:messages', {
          query: searchQuery,
          serverId,
          channelId,
        });
      }
    } else {
      socket.emit('search:users', { query: searchQuery, serverId });
    }
  }, [searchType, serverId, channelId, roomId]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    } else {
      setResults([]);
    }
  };

  // Listen for search results
  useEffect(() => {
    const handleResults = (data: { results: SearchResult[] }) => {
      setResults(data.results);
      setIsLoading(false);
      setIsOpen(data.results.length > 0);
    };

    const handleUserResults = (data: { users: { id: string; displayName: string }[] }) => {
      const userResults: SearchResult[] = data.users.map((user) => ({
        type: 'user' as const,
        id: user.id,
        displayName: user.displayName,
        score: 1,
      }));
      setResults(userResults);
      setIsLoading(false);
      setIsOpen(userResults.length > 0);
    };

    const handleError = (data: { message: string }) => {
      console.error('Search error:', data.message);
      setIsLoading(false);
      setResults([]);
    };

    socket.on('search:results', handleResults);
    socket.on('search:users-results', handleUserResults);
    socket.on('search:error', handleError);

    return () => {
      socket.off('search:results', handleResults);
      socket.off('search:users-results', handleUserResults);
      socket.off('search:error', handleError);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    onResultSelect?.(result);
  };

  // Format date for display
  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search type toggle */}
        <div className="flex bg-gray-800 rounded-lg border border-gray-700">
          <button
            onClick={() => setSearchType('messages')}
            className={`px-3 py-2 text-sm rounded-l-lg ${
              searchType === 'messages'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setSearchType('users')}
            className={`px-3 py-2 text-sm rounded-r-lg ${
              searchType === 'users'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Utilisateurs
          </button>
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}-${index}`}
              onClick={() => handleResultClick(result)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 border-b border-gray-700 last:border-b-0"
            >
              {result.type === 'message' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-indigo-400">
                      {result.displayName}
                    </span>
                    {result.createdAt && (
                      <span className="text-xs text-gray-500">
                        {formatDate(result.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {result.content}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {result.displayName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-white">{result.displayName}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">
            Aucun résultat trouvé pour "{query}"
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
