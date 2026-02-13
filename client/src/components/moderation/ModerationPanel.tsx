import { useState } from 'react';
import { useModeration } from '../../hooks/useModeration';
import { useServerStore } from '../../stores/serverStore';
import { useServerRole } from '../../stores/serverStore';
import { RoleManager } from './RoleManager';
import { ModerationLogs } from './ModerationLogs';

type TabId = 'logs' | 'muted' | 'banned' | 'automod';

const TABS: { id: TabId; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'muted', label: 'Muted Users' },
  { id: 'banned', label: 'Banned Users' },
  { id: 'automod', label: 'Auto-Moderation' },
];

interface ModerationPanelProps {
  onClose: () => void;
}

export function ModerationPanel({ onClose }: ModerationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const activeServer = useServerStore((s) => s.activeServer);
  const role = useServerRole();

  const serverId = activeServer?.id ?? null;
  const mod = useModeration(serverId);

  // Only admins and moderators can access
  const canAccess = role !== null && ['owner', 'admin', 'moderator'].includes(role);

  if (!canAccess) {
    return (
      <div className="w-96 bg-[#1a1a1a] border-l border-[#333] flex flex-col items-center justify-center p-8">
        <p className="text-[#808080]">You do not have permission to view moderation tools.</p>
      </div>
    );
  }

  return (
    <div className="w-96 bg-[#1a1a1a] border-l border-[#333] flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[#333] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-white">Moderation</h2>
        <button
          onClick={onClose}
          className="text-[#a0a0a0] hover:text-white transition-colors text-lg leading-none"
          aria-label="Close moderation panel"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333] flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500 bg-[#252525]'
                : 'text-[#808080] hover:text-[#c0c0c0] hover:bg-[#222]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {mod.error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-xs">
          {mod.error}
          <button
            onClick={() => mod.setError(null)}
            className="ml-2 text-red-400 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'logs' && (
          <ModerationLogs logs={mod.logs} isLoading={mod.isLoadingLogs} />
        )}

        {activeTab === 'muted' && (
          <MutedUsersList
            users={mod.mutedUsers}
            isLoading={mod.isLoadingMuted}
            onUnmute={(userId) => serverId && mod.unmuteUser(serverId, userId)}
          />
        )}

        {activeTab === 'banned' && (
          <BannedUsersList
            users={mod.bannedUsers}
            isLoading={mod.isLoadingBanned}
            onUnban={(userId) => serverId && mod.unbanUser(serverId, userId)}
          />
        )}

        {activeTab === 'automod' && (
          <AutoModSettings
            config={mod.autoModConfig}
            isLoading={mod.isLoadingConfig}
            onUpdate={(config) => serverId && mod.updateConfig(serverId, config)}
          />
        )}
      </div>
    </div>
  );
}

// --- Muted Users Sub-component ---
import type { MutedUserWithDetails } from '@stream-party/shared';

function MutedUsersList({
  users,
  isLoading,
  onUnmute,
}: {
  users: MutedUserWithDetails[];
  isLoading: boolean;
  onUnmute: (userId: string) => void;
}) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (users.length === 0) {
    return <EmptyState message="No muted users" />;
  }

  return (
    <div className="p-3 space-y-2">
      {users.map((u) => (
        <div
          key={u.id}
          className="bg-[#252525] rounded-lg p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-white font-medium">{u.user.displayName}</p>
            {u.reason && <p className="text-xs text-[#808080] mt-0.5">{u.reason}</p>}
            <p className="text-xs text-[#606060] mt-0.5">
              Muted by {u.mutedByUser.displayName}
              {u.expiresAt && (
                <> &middot; Expires {new Date(u.expiresAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <button
            onClick={() => onUnmute(u.userId)}
            className="px-2 py-1 text-xs bg-orange-600/20 text-orange-400 rounded hover:bg-orange-600/30 transition-colors"
          >
            Unmute
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Banned Users Sub-component ---
import type { BannedUserWithDetails, AutoModConfig } from '@stream-party/shared';

function BannedUsersList({
  users,
  isLoading,
  onUnban,
}: {
  users: BannedUserWithDetails[];
  isLoading: boolean;
  onUnban: (userId: string) => void;
}) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (users.length === 0) {
    return <EmptyState message="No banned users" />;
  }

  return (
    <div className="p-3 space-y-2">
      {users.map((u) => (
        <div
          key={u.id}
          className="bg-[#252525] rounded-lg p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-sm text-white font-medium">{u.user.displayName}</p>
            {u.reason && <p className="text-xs text-[#808080] mt-0.5">{u.reason}</p>}
            <p className="text-xs text-[#606060] mt-0.5">
              Banned by {u.bannedByUser.displayName} &middot;{' '}
              {new Date(u.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => onUnban(u.userId)}
            className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
          >
            Unban
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Auto-Mod Settings Sub-component ---
function AutoModSettings({
  config,
  isLoading,
  onUpdate,
}: {
  config: AutoModConfig | null;
  isLoading: boolean;
  onUpdate: (config: Partial<AutoModConfig>) => void;
}) {
  const [bannedWordInput, setBannedWordInput] = useState('');

  if (isLoading || !config) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-3 space-y-4">
      {/* Spam Protection */}
      <ToggleSetting
        label="Spam Protection"
        description={`Threshold: ${config.spamThreshold} messages`}
        checked={config.enableSpamProtection}
        onChange={(v) => onUpdate({ enableSpamProtection: v })}
      />

      {/* Link Filter */}
      <ToggleSetting
        label="Link Filter"
        description="Block messages containing links"
        checked={config.enableLinkFilter}
        onChange={(v) => onUpdate({ enableLinkFilter: v })}
      />

      {/* Word Filter */}
      <ToggleSetting
        label="Word Filter"
        description="Block messages containing banned words"
        checked={config.enableWordFilter}
        onChange={(v) => onUpdate({ enableWordFilter: v })}
      />

      {/* Mute Duration */}
      <div className="bg-[#252525] rounded-lg p-3">
        <label className="text-sm text-white font-medium block mb-1">
          Auto-Mute Duration (minutes)
        </label>
        <input
          type="number"
          min={1}
          max={1440}
          value={config.muteDuration}
          onChange={(e) => onUpdate({ muteDuration: parseInt(e.target.value, 10) || 5 })}
          className="w-full bg-[#1a1a1a] border border-[#444] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Banned Words */}
      <div className="bg-[#252525] rounded-lg p-3">
        <label className="text-sm text-white font-medium block mb-2">Banned Words</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={bannedWordInput}
            onChange={(e) => setBannedWordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && bannedWordInput.trim()) {
                const word = bannedWordInput.trim().toLowerCase();
                if (!config.bannedWords.includes(word)) {
                  onUpdate({ bannedWords: [...config.bannedWords, word] });
                }
                setBannedWordInput('');
              }
            }}
            placeholder="Add word..."
            className="flex-1 bg-[#1a1a1a] border border-[#444] rounded px-2 py-1 text-sm text-white placeholder-[#606060] focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => {
              const word = bannedWordInput.trim().toLowerCase();
              if (word && !config.bannedWords.includes(word)) {
                onUpdate({ bannedWords: [...config.bannedWords, word] });
              }
              setBannedWordInput('');
            }}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {config.bannedWords.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1 bg-[#333] text-[#c0c0c0] text-xs px-2 py-0.5 rounded"
            >
              {word}
              <button
                onClick={() =>
                  onUpdate({
                    bannedWords: config.bannedWords.filter((w) => w !== word),
                  })
                }
                className="text-[#808080] hover:text-red-400"
              >
                &times;
              </button>
            </span>
          ))}
          {config.bannedWords.length === 0 && (
            <span className="text-xs text-[#606060]">No banned words</span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Shared small components ---
function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-[#252525] rounded-lg p-3 flex items-center justify-between">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-[#808080]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-[#444]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-6 h-6 border-2 border-[#444] border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-sm text-[#808080]">{message}</p>
    </div>
  );
}
