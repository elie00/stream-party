/**
 * Push-to-Talk Indicator Component
 * Shows visual feedback when push-to-talk is active
 */
import React from 'react';
import { cn } from '../../utils/cn';

interface PushToTalkIndicatorProps {
  isActive: boolean;
  isMuted: boolean;
  pttKey?: string;
  className?: string;
}

export const PushToTalkIndicator: React.FC<PushToTalkIndicatorProps> = ({
  isActive,
  isMuted,
  pttKey = 'Espace',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
        isActive
          ? 'bg-green-500/20 border border-green-500/50'
          : isMuted
          ? 'bg-red-500/20 border border-red-500/50'
          : 'bg-gray-700/50 border border-gray-600/50',
        className
      )}
    >
      {/* Microphone Icon */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          isActive
            ? 'bg-green-500 text-white'
            : isMuted
            ? 'bg-red-500 text-white'
            : 'bg-gray-600 text-gray-300'
        )}
      >
        {isActive ? (
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
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        ) : (
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
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        )}
      </div>

      {/* Status Text */}
      <div className="flex flex-col">
        <span
          className={cn(
            'text-sm font-medium',
            isActive ? 'text-green-400' : isMuted ? 'text-red-400' : 'text-gray-300'
          )}
        >
          {isActive ? 'Parlant...' : isMuted ? 'Muet' : 'Micro actif'}
        </span>
        <span className="text-xs text-gray-500">
          {isActive ? `Relâchez ${pttKey} pour arrêter` : `Appuyez sur ${pttKey} pour parler`}
        </span>
      </div>

      {/* Pulsing indicator when active */}
      {isActive && (
        <div className="ml-auto">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
};
