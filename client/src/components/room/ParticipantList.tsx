import type { RoomParticipant } from '@stream-party/shared';
import { Avatar } from '../ui/Avatar';

interface ParticipantListProps {
  participants: RoomParticipant[];
  hostId: string;
  className?: string;
}

export function ParticipantList({ participants, hostId, className = '' }: ParticipantListProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-[#a0a0a0]">
        {participants.length} participant{participants.length !== 1 ? 's' : ''}
      </span>

      {/* Stacked avatars */}
      <div className="flex -space-x-2">
        {participants.slice(0, 5).map((p) => (
          <div
            key={p.userId}
            className="relative"
            title={`${p.displayName}${p.userId === hostId ? ' (Host)' : ''}${p.inCall ? ' - In call' : ''}`}
          >
            <Avatar
              name={p.displayName}
              size="md"
              className={`border-2 border-[#1a1a1a] ${p.inCall ? 'ring-2 ring-green-500' : ''}`}
            />
            {p.userId === hostId && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-500 rounded-full border border-[#1a1a1a] flex items-center justify-center">
                <svg className="w-2 h-2 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            )}
          </div>
        ))}
        {participants.length > 5 && (
          <div className="w-8 h-8 rounded-full bg-[#333] border-2 border-[#1a1a1a] flex items-center justify-center text-xs text-[#a0a0a0]">
            +{participants.length - 5}
          </div>
        )}
      </div>

      {/* Expanded list (tooltip-style on hover could be added later) */}
    </div>
  );
}

/* Detailed list version for sidebar/dropdown use */
interface ParticipantDetailListProps {
  participants: RoomParticipant[];
  hostId: string;
  className?: string;
}

export function ParticipantDetailList({ participants, hostId, className = '' }: ParticipantDetailListProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {participants.map((p) => (
        <div
          key={p.userId}
          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#252525]"
        >
          <div className="relative">
            <Avatar name={p.displayName} size="md" />
            {p.inCall && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#252525]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">
                {p.displayName}
              </span>
              {p.userId === hostId && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                  Host
                </span>
              )}
            </div>
            {p.inCall && (
              <span className="text-[10px] text-green-400">In call</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
