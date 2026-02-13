/**
 * SearchFilters Component
 * Filtres avancés pour la recherche
 */
import { useState, useEffect } from 'react';
import { socket } from '../../services/socket';
import type { Server, Channel, SearchFilters } from '@stream-party/shared';
import { cn } from '../../utils/cn';

interface SearchFiltersProps {
  servers: Server[];
  onApply: (filters: SearchFilters) => void;
  className?: string;
}

export function SearchFilters({ servers, onApply, className }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [hasAttachment, setHasAttachment] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date_desc' | 'date_asc'>('relevance');
  const [channels, setChannels] = useState<Channel[]>([]);

  // Charger les channels quand un serveur est sélectionné
  useEffect(() => {
    if (selectedServer) {
      const server = servers.find(s => s.id === selectedServer);
      if (server) {
        setChannels(server.channels || []);
      }
    } else {
      setChannels([]);
    }
    setSelectedChannel('');
  }, [selectedServer, servers]);

  const handleApply = () => {
    const filters: SearchFilters = {
      query: '', // Sera ajouté par le parent
      sortBy,
    };

    if (selectedServer) {
      filters.servers = [selectedServer];
    }
    if (selectedChannel) {
      filters.inChannel = selectedChannel;
    }
    if (selectedUser) {
      filters.fromUser = selectedUser;
    }
    if (hasAttachment) {
      filters.hasAttachment = true;
    }
    if (dateFrom || dateTo) {
      filters.dateRange = {
        from: dateFrom ? new Date(dateFrom) : new Date(0),
        to: dateTo ? new Date(dateTo) : new Date(),
      };
    }

    onApply(filters);
    setIsOpen(false);
  };

  const handleReset = () => {
    setSelectedServer('');
    setSelectedChannel('');
    setSelectedUser('');
    setHasAttachment(false);
    setDateFrom('');
    setDateTo('');
    setSortBy('relevance');
    onApply({ query: '', sortBy: 'relevance' });
    setIsOpen(false);
  };

  const hasActiveFilters = 
    selectedServer || 
    selectedChannel || 
    selectedUser || 
    hasAttachment || 
    dateFrom || 
    dateTo ||
    sortBy !== 'relevance';

  return (
    <div className={cn('relative', className)}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          isOpen 
            ? 'bg-gray-700 border-indigo-500 text-white' 
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="text-sm">Filtres</span>
        {hasActiveFilters && (
          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
          <div className="space-y-4">
            {/* Server filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Serveur
              </label>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tous les serveurs</option>
                {servers.map(server => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Channel filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Salon
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                disabled={!selectedServer}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Tous les salons</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Utilisateur
              </label>
              <input
                type="text"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                placeholder="ID de l'utilisateur"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Depuis
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Jusqu'à
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* With attachment */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAttachment}
                onChange={(e) => setHasAttachment(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-300">Avec fichiers joints</span>
            </label>

            {/* Sort by */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Trier par
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('relevance')}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded transition-colors',
                    sortBy === 'relevance'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  )}
                >
                  Pertinence
                </button>
                <button
                  onClick={() => setSortBy('date_desc')}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded transition-colors',
                    sortBy === 'date_desc'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  )}
                >
                  Plus récent
                </button>
                <button
                  onClick={() => setSortBy('date_asc')}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded transition-colors',
                    sortBy === 'date_asc'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  )}
                >
                  Plus ancien
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-700">
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Réinitialiser
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchFilters;
