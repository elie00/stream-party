/**
 * ModPanel Component
 * Main moderation panel for server management
 */
import React, { useState, useEffect } from 'react';
import { socket } from '../../services/socket';
import {
  ModerationLogWithUsers,
  MutedUserWithDetails,
  BannedUserWithDetails,
  AutoModConfig,
} from '@stream-party/shared';
import { ModerationLogs } from './ModerationLogs';
import { UserModActions } from './UserModActions';

interface ModPanelProps {
  serverId: string;
  currentUserId: string;
  onClose?: () => void;
}

type TabType = 'logs' | 'muted' | 'banned' | 'automod';

export const ModPanel: React.FC<ModPanelProps> = ({
  serverId,
  currentUserId,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<ModerationLogWithUsers[]>([]);
  const [mutedUsers, setMutedUsers] = useState<MutedUserWithDetails[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUserWithDetails[]>([]);
  const [config, setConfig] = useState<AutoModConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data based on active tab
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    switch (activeTab) {
      case 'logs':
        socket.emit('mod:get-logs', { serverId });
        break;
      case 'muted':
        socket.emit('mod:get-muted', { serverId });
        break;
      case 'banned':
        socket.emit('mod:get-banned', { serverId });
        break;
      case 'automod':
        socket.emit('mod:get-config', { serverId });
        break;
    }
  }, [activeTab, serverId]);

  // Listen for responses
  useEffect(() => {
    const handleLogs = (data: { logs: ModerationLogWithUsers[] }) => {
      setLogs(data.logs);
      setIsLoading(false);
    };

    const handleMutedUsers = (data: { mutedUsers: MutedUserWithDetails[] }) => {
      setMutedUsers(data.mutedUsers);
      setIsLoading(false);
    };

    const handleBannedUsers = (data: { bannedUsers: BannedUserWithDetails[] }) => {
      setBannedUsers(data.bannedUsers);
      setIsLoading(false);
    };

    const handleConfig = (data: { config: AutoModConfig }) => {
      setConfig(data.config);
      setIsLoading(false);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setIsLoading(false);
    };

    socket.on('mod:logs', handleLogs);
    socket.on('mod:muted-users', handleMutedUsers);
    socket.on('mod:banned-users', handleBannedUsers);
    socket.on('mod:config', handleConfig);
    socket.on('mod:error', handleError);

    return () => {
      socket.off('mod:logs', handleLogs);
      socket.off('mod:muted-users', handleMutedUsers);
      socket.off('mod:banned-users', handleBannedUsers);
      socket.off('mod:config', handleConfig);
      socket.off('mod:error', handleError);
    };
  }, []);

  // Handle unmute
  const handleUnmute = (userId: string) => {
    socket.emit('mod:unmute', { serverId, targetId: userId });
  };

  // Handle unban
  const handleUnban = (userId: string) => {
    socket.emit('mod:unban', { serverId, targetId: userId });
  };

  // Handle config update
  const handleConfigUpdate = (updates: Partial<AutoModConfig>) => {
    if (config) {
      socket.emit('mod:update-config', {
        serverId,
        config: { ...config, ...updates },
      });
    }
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get action badge color
  const getActionColor = (action: string) => {
    switch (action) {
      case 'warn':
        return 'bg-yellow-600';
      case 'mute':
        return 'bg-orange-600';
      case 'kick':
        return 'bg-red-600';
      case 'ban':
        return 'bg-red-800';
      default:
        return 'bg-gray-600';
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'logs', label: 'Historique' },
    { id: 'muted', label: 'Muets' },
    { id: 'banned', label: 'Bannis' },
    { id: 'automod', label: 'Auto-Mod' },
  ];

  return (
    <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Panneau de Modération</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-6 py-3 bg-red-900/50 border-b border-red-800">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Logs Tab */}
            {activeTab === 'logs' && <ModerationLogs logs={logs} />}

            {/* Muted Users Tab */}
            {activeTab === 'muted' && (
              <div className="space-y-3">
                {mutedUsers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">
                    Aucun utilisateur muet
                  </p>
                ) : (
                  mutedUsers.map((muted) => (
                    <div
                      key={muted.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{muted.user.displayName}</p>
                        <p className="text-sm text-gray-400">
                          Mu par {muted.mutedByUser.displayName}
                          {muted.reason && ` - ${muted.reason}`}
                        </p>
                        {muted.expiresAt && (
                          <p className="text-xs text-gray-500">
                            Expire le {formatDate(muted.expiresAt)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnmute(muted.userId)}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        Démueter
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Banned Users Tab */}
            {activeTab === 'banned' && (
              <div className="space-y-3">
                {bannedUsers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">
                    Aucun utilisateur banni
                  </p>
                ) : (
                  bannedUsers.map((banned) => (
                    <div
                      key={banned.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-white">{banned.user.displayName}</p>
                        <p className="text-sm text-gray-400">
                          Banni par {banned.bannedByUser.displayName}
                          {banned.reason && ` - ${banned.reason}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Le {formatDate(banned.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnban(banned.userId)}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        Débannir
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Auto-Mod Config Tab */}
            {activeTab === 'automod' && config && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Spam Protection */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white">
                        Protection Spam
                      </label>
                      <button
                        onClick={() => handleConfigUpdate({ enableSpamProtection: !config.enableSpamProtection })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          config.enableSpamProtection ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            config.enableSpamProtection ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Détecte et bloque les messages répétitifs
                    </p>
                  </div>

                  {/* Link Filter */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white">
                        Filtre de Liens
                      </label>
                      <button
                        onClick={() => handleConfigUpdate({ enableLinkFilter: !config.enableLinkFilter })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          config.enableLinkFilter ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            config.enableLinkFilter ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Bloque les liens dans les messages
                    </p>
                  </div>

                  {/* Word Filter */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white">
                        Filtre de Mots
                      </label>
                      <button
                        onClick={() => handleConfigUpdate({ enableWordFilter: !config.enableWordFilter })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          config.enableWordFilter ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            config.enableWordFilter ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Bloque les mots interdits
                    </p>
                  </div>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <label className="block text-sm font-medium text-white mb-2">
                      Seuil de Spam (messages/10s)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={config.spamThreshold}
                      onChange={(e) => handleConfigUpdate({ spamThreshold: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>

                  <div className="p-4 bg-gray-800 rounded-lg">
                    <label className="block text-sm font-medium text-white mb-2">
                      Durée de Muet (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={config.muteDuration}
                      onChange={(e) => handleConfigUpdate({ muteDuration: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                </div>

                {/* Banned Words */}
                <div className="p-4 bg-gray-800 rounded-lg">
                  <label className="block text-sm font-medium text-white mb-2">
                    Mots Interdits (un par ligne)
                  </label>
                  <textarea
                    value={config.bannedWords.join('\n')}
                    onChange={(e) => handleConfigUpdate({ bannedWords: e.target.value.split('\n').filter(Boolean) })}
                    placeholder="mot1&#10;mot2&#10;mot3"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white h-32 resize-none"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ModPanel;
