import { useState, useRef, useEffect, useCallback } from 'react';
import { useModerationStore } from '../../stores/moderationStore';
import { useServerStore, useServerRole } from '../../stores/serverStore';
import type { ModAction } from '@stream-party/shared';

interface UserContextMenuProps {
  targetUserId: string;
  targetDisplayName: string;
  x: number;
  y: number;
  onClose: () => void;
}

const MUTE_DURATIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 },
];

export function UserContextMenu({
  targetUserId,
  targetDisplayName,
  x,
  y,
  onClose,
}: UserContextMenuProps) {
  const [action, setAction] = useState<ModAction | null>(null);
  const [reason, setReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(15);
  const menuRef = useRef<HTMLDivElement>(null);
  const role = useServerRole();
  const activeServer = useServerStore((s) => s.activeServer);
  const { warnUser, muteUser, kickUser, banUser } = useModerationStore();

  const serverId = activeServer?.id;

  const canWarn = role !== null && ['owner', 'admin', 'moderator'].includes(role);
  const canMute = role !== null && ['owner', 'admin', 'moderator'].includes(role);
  const canKick = role !== null && ['owner', 'admin', 'moderator'].includes(role);
  const canBan = role !== null && ['owner', 'admin'].includes(role);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleExecute = useCallback(() => {
    if (!serverId || !action || !reason.trim()) return;

    switch (action) {
      case 'warn':
        warnUser(serverId, targetUserId, reason.trim());
        break;
      case 'mute':
        muteUser(serverId, targetUserId, reason.trim(), muteDuration);
        break;
      case 'kick':
        kickUser(serverId, targetUserId, reason.trim());
        break;
      case 'ban':
        banUser(serverId, targetUserId, reason.trim());
        break;
    }

    onClose();
  }, [serverId, action, reason, muteDuration, targetUserId, warnUser, muteUser, kickUser, banUser, onClose]);

  // No permissions at all
  if (!canWarn && !canMute && !canKick && !canBan) return null;

  // Clamp position so menu stays visible
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 50,
  };

  return (
    <div ref={menuRef} style={style} className="min-w-[220px] bg-[#1e1e1e] border border-[#444] rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#333]">
        <p className="text-xs text-[#808080]">Moderate</p>
        <p className="text-sm text-white font-medium truncate">{targetDisplayName}</p>
      </div>

      {/* Action selection */}
      {!action && (
        <div className="py-1">
          {canWarn && (
            <MenuButton
              label="Warn"
              colorClass="text-yellow-400"
              onClick={() => setAction('warn')}
            />
          )}
          {canMute && (
            <MenuButton
              label="Mute"
              colorClass="text-orange-400"
              onClick={() => setAction('mute')}
            />
          )}
          {canKick && (
            <MenuButton
              label="Kick"
              colorClass="text-red-400"
              onClick={() => setAction('kick')}
            />
          )}
          {canBan && (
            <MenuButton
              label="Ban"
              colorClass="text-red-300"
              onClick={() => setAction('ban')}
            />
          )}
        </div>
      )}

      {/* Action form */}
      {action && (
        <div className="p-3 space-y-2">
          <p className="text-xs text-[#808080]">
            {action.charAt(0).toUpperCase() + action.slice(1)} {targetDisplayName}
          </p>

          {/* Mute duration picker */}
          {action === 'mute' && (
            <div>
              <label className="text-xs text-[#808080] block mb-1">Duration</label>
              <div className="flex gap-1 flex-wrap">
                {MUTE_DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setMuteDuration(d.value)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      muteDuration === d.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#333] text-[#a0a0a0] hover:bg-[#3a3a3a]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason input */}
          <div>
            <label className="text-xs text-[#808080] block mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecute();
              }}
              placeholder="Enter reason..."
              className="w-full bg-[#1a1a1a] border border-[#444] rounded px-2 py-1.5 text-sm text-white placeholder-[#606060] focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Form buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={!reason.trim()}
              className={`flex-1 px-3 py-1.5 text-xs text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                action === 'ban'
                  ? 'bg-red-700 hover:bg-red-600'
                  : action === 'kick'
                  ? 'bg-red-600 hover:bg-red-500'
                  : action === 'mute'
                  ? 'bg-orange-600 hover:bg-orange-500'
                  : 'bg-yellow-600 hover:bg-yellow-500'
              }`}
            >
              Confirm {action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
            <button
              onClick={() => {
                setAction(null);
                setReason('');
              }}
              className="px-3 py-1.5 text-xs bg-[#333] text-[#a0a0a0] rounded hover:bg-[#3a3a3a] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  label,
  colorClass,
  onClick,
}: {
  label: string;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2a2a] transition-colors ${colorClass}`}
    >
      {label}
    </button>
  );
}
