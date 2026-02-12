/**
 * Room header component with room info, call controls, and actions
 * Updated to use SFU-based call controls with screen sharing support
 */
import type { RoomParticipant } from '@stream-party/shared';
import { ParticipantList } from './ParticipantList';
import { SfuCallControls } from '../call/SfuCallControls';
import { Button } from '../ui/Button';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  participantsCount: number;
  participants: RoomParticipant[];
  hostId: string;
  inCall: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onShare: () => void;
  onToggleChat: () => void;
  isChatOpen?: boolean;
}

export function RoomHeader({
  roomName,
  roomCode,
  participantsCount,
  participants,
  hostId,
  inCall,
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  onJoinCall,
  onLeaveCall,
  onToggleAudio,
  onToggleVideo,
  onStartScreenShare,
  onStopScreenShare,
  onShare,
  onToggleChat,
}: RoomHeaderProps) {
  return (
    <div className="bg-[#1a1a1a] border-b border-[#333] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg md:text-xl font-semibold truncate">{roomName}</h1>
        <span className="text-xs md:text-sm text-[#a0a0a0] font-mono hidden sm:inline">
          {roomCode}
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {/* SFU Call Controls with Screen Sharing */}
        <SfuCallControls
          inCall={inCall}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isScreenSharing={isScreenSharing}
          onJoinCall={onJoinCall}
          onLeaveCall={onLeaveCall}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onStartScreenShare={onStartScreenShare}
          onStopScreenShare={onStopScreenShare}
        />

        {/* Participant Avatars */}
        <div className="hidden md:block">
          <ParticipantList participants={participants} hostId={hostId} />
        </div>

        {/* Mobile participant count */}
        <span className="md:hidden text-xs text-[#a0a0a0]">
          {participantsCount}
          <svg
            className="w-4 h-4 inline ml-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>

        {/* Share Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onShare}
          className="hidden sm:inline-flex"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </Button>

        {/* Mobile share button (icon only) */}
        <button
          onClick={onShare}
          className="sm:hidden p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          aria-label="Share room"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>

        {/* Mobile chat toggle */}
        <button
          onClick={onToggleChat}
          className="lg:hidden p-2 bg-[#252525] hover:bg-[#333] text-white rounded-lg transition-colors relative"
          aria-label="Toggle chat"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
