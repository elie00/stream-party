/**
 * Screen Share Indicator Component
 * Shows when someone is sharing their screen
 */
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';

interface ScreenShareIndicatorProps {
  isLocalSharing: boolean;
  sharingUserId?: string;
}

export function ScreenShareIndicator({ isLocalSharing, sharingUserId }: ScreenShareIndicatorProps) {
  const room = useRoomStore((state) => state.room);
  const currentUserId = useAuthStore((state) => state.userId);

  if (!isLocalSharing && !sharingUserId) {
    return null;
  }

  // Get the display name of the person sharing
  const getSharingName = () => {
    if (isLocalSharing) {
      return 'You are';
    }

    const participant = room?.participants.find((p) => p.userId === sharingUserId);
    if (participant) {
      return `${participant.displayName} is`;
    }

    return 'Someone is';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg animate-pulse">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      <span className="text-sm font-medium">
        {getSharingName()} sharing screen
      </span>
      {isLocalSharing && (
        <button
          onClick={() => {
            // This will be handled by the parent component
          }}
          className="ml-2 px-2 py-1 text-xs bg-green-700 hover:bg-green-800 rounded transition-colors"
        >
          Stop
        </button>
      )}
    </div>
  );
}
