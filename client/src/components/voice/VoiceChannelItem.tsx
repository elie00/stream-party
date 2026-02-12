/**
 * Voice Channel Item Component
 * Displays a single voice channel with its participants
 */
import React from 'react';
import { cn } from '../../utils/cn';
import type { VoiceChannel, VoiceParticipant } from '../../hooks/useVoiceChannel';

interface VoiceChannelItemProps {
  channel: VoiceChannel;
  participants: VoiceParticipant[];
  currentUserId?: string;
  speakingUsers: Set<string>;
  isInChannel: boolean;
  onJoin: (channelId: string) => void;
  onLeave: () => void;
  className?: string;
}

export const VoiceChannelItem: React.FC<VoiceChannelItemProps> = ({
  channel,
  participants,
  currentUserId,
  speakingUsers,
  isInChannel,
  onJoin,
  onLeave,
  className,
}) => {
  const userInThisChannel = isInChannel && participants.some(p => p.userId === currentUserId);

  const handleClick = () => {
    if (userInThisChannel) {
      onLeave();
    } else {
      onJoin(channel.id);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200',
        userInThisChannel
          ? 'bg-indigo-500/10 border-indigo-500/50'
          : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50',
        className
      )}
    >
      {/* Channel Header */}
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {/* Speaker Icon */}
        <div
          className={cn(
            'w-8 h-8 rounded flex items-center justify-center',
            userInThisChannel ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'
          )}
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
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        </div>

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'text-sm font-medium truncate',
              userInThisChannel ? 'text-indigo-300' : 'text-gray-200'
            )}
          >
            {channel.name}
          </h3>
          <p className="text-xs text-gray-500">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Join/Leave Button */}
        <div
          className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            userInThisChannel
              ? 'bg-red-500/20 text-red-400'
              : 'bg-green-500/20 text-green-400'
          )}
        >
          {userInThisChannel ? 'Quitter' : 'Rejoindre'}
        </div>
      </button>

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {participants.map((participant) => (
            <div
              key={participant.socketId}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded',
                speakingUsers.has(participant.userId)
                  ? 'bg-green-500/10'
                  : 'bg-gray-900/30'
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  speakingUsers.has(participant.userId)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-600 text-gray-300'
                )}
              >
                {participant.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <span
                className={cn(
                  'text-sm truncate flex-1',
                  speakingUsers.has(participant.userId)
                    ? 'text-green-400'
                    : 'text-gray-400'
                )}
              >
                {participant.displayName}
                {participant.userId === currentUserId && ' (vous)'}
              </span>

              {/* Status Icons */}
              <div className="flex items-center gap-1">
                {participant.isMuted && !participant.isPushingToTalk && (
                  <span title="Muet">
                    <svg
                      className="w-4 h-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  </span>
                )}
                {participant.isDeafened && (
                  <span title="Sourdine">
                    <svg
                      className="w-4 h-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 12l4 4m0-4l-4 4"
                      />
                    </svg>
                  </span>
                )}
                {speakingUsers.has(participant.userId) && (
                  <span title="En train de parler">
                    <svg
                      className="w-4 h-4 text-green-400 animate-pulse"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
