/**
 * Voice Channel List Component
 * Displays all voice channels for a room
 */
import React, { useEffect, useState } from 'react';
import { useVoiceChannel, VoiceChannelWithParticipants } from '../../hooks/useVoiceChannel';
import { VoiceChannelItem } from './VoiceChannelItem';
import { PushToTalkIndicator } from './PushToTalkIndicator';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';

interface VoiceChannelListProps {
  className?: string;
  showPttIndicator?: boolean;
}

export const VoiceChannelList: React.FC<VoiceChannelListProps> = ({
  className,
  showPttIndicator = true,
}) => {
  const { userId } = useAuthStore();
  const {
    channels,
    currentChannel,
    isInVoice,
    isMuted,
    isPushingToTalk,
    speakingUsers,
    getChannels,
    createChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
  } = useVoiceChannel({
    onError: (message) => {
      console.error('Voice channel error:', message);
    },
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  // Load channels on mount
  useEffect(() => {
    getChannels();
  }, [getChannels]);

  const handleCreateChannel = () => {
    if (newChannelName.trim()) {
      createChannel(newChannelName.trim());
      setNewChannelName('');
      setShowCreateModal(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          Canaux vocaux
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
          title="Créer un canal"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Push-to-Talk Indicator */}
      {showPttIndicator && isInVoice && (
        <PushToTalkIndicator
          isActive={isPushingToTalk}
          isMuted={isMuted}
          pttKey="Espace"
        />
      )}

      {/* Channels List */}
      <div className="space-y-2">
        {channels.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            <p className="text-sm">Aucun canal vocal</p>
            <p className="text-xs mt-1">Créez un canal pour commencer</p>
          </div>
        ) : (
          channels.map(({ channel, participants }) => (
            <VoiceChannelItem
              key={channel.id}
              channel={channel}
              participants={participants}
              currentUserId={userId ?? undefined}
              speakingUsers={speakingUsers}
              isInChannel={isInVoice}
              onJoin={joinChannel}
              onLeave={leaveChannel}
            />
          ))
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Créer un canal vocal
            </h3>
            
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Nom du canal"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateChannel();
                } else if (e.key === 'Escape') {
                  setShowCreateModal(false);
                }
              }}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Controls (when in a channel) */}
      {isInVoice && (
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-700/50">
          <button
            onClick={leaveChannel}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
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
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
              />
            </svg>
            Quitter le canal
          </button>
        </div>
      )}
    </div>
  );
};
