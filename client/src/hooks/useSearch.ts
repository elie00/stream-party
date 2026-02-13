import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchResult, SearchParams } from '@stream-party/shared';
import { getSocket } from '../services/socket';

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  userResults: { id: string; displayName: string }[];
  loading: boolean;
  error: string | null;
  searchMessages: (params: SearchParams) => void;
  searchUsers: (query: string, serverId?: string) => void;
  clearResults: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userResults, setUserResults] = useState<{ id: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleResults = (data: { results: SearchResult[] }) => {
      setResults(data.results);
      setLoading(false);
    };

    const handleUserResults = (data: { users: { id: string; displayName: string }[] }) => {
      setUserResults(data.users);
      setLoading(false);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
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

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setUserResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const socket = getSocket();
      if (socket.connected) {
        setLoading(true);
        setError(null);
        socket.emit('search:messages', { query });
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const searchMessages = useCallback((params: SearchParams) => {
    const socket = getSocket();
    if (!socket.connected || !params.query || params.query.length < 2) return;
    setLoading(true);
    setError(null);
    socket.emit('search:messages', params);
  }, []);

  const searchUsers = useCallback((q: string, serverId?: string) => {
    const socket = getSocket();
    if (!socket.connected || !q || q.length < 2) return;
    setLoading(true);
    setError(null);
    socket.emit('search:users', { query: q, serverId });
  }, []);

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setUserResults([]);
    setError(null);
  }, []);

  return { query, setQuery, results, userResults, loading, error, searchMessages, searchUsers, clearResults };
}
