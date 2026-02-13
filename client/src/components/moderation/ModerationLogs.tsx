import type { ModerationLogWithUsers, ModAction } from '@stream-party/shared';

const ACTION_STYLES: Record<ModAction, { bg: string; text: string; label: string }> = {
  warn: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: 'Warn' },
  mute: { bg: 'bg-orange-600/20', text: 'text-orange-400', label: 'Mute' },
  kick: { bg: 'bg-red-600/20', text: 'text-red-400', label: 'Kick' },
  ban: { bg: 'bg-red-900/30', text: 'text-red-300', label: 'Ban' },
};

interface ModerationLogsProps {
  logs: ModerationLogWithUsers[];
  isLoading: boolean;
}

export function ModerationLogs({ logs, isLoading }: ModerationLogsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-[#444] border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-[#808080]">No moderation logs</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {logs.map((log) => {
        const style = ACTION_STYLES[log.action];
        return (
          <div key={log.id} className="bg-[#252525] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {/* Action badge */}
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
              {/* Date */}
              <span className="text-xs text-[#606060] ml-auto">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            {/* Target and moderator */}
            <div className="text-sm text-[#c0c0c0]">
              <span className="text-white font-medium">{log.targetUser.displayName}</span>
              <span className="text-[#808080]"> by </span>
              <span className="text-[#a0a0a0]">{log.moderator.displayName}</span>
            </div>
            {/* Reason */}
            {log.reason && (
              <p className="text-xs text-[#808080] mt-1">
                Reason: {log.reason}
              </p>
            )}
            {/* Duration for mutes */}
            {log.action === 'mute' && log.duration && (
              <p className="text-xs text-[#606060] mt-0.5">
                Duration: {log.duration} min
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
