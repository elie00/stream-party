import { useState } from 'react';
import { cn } from '../../utils/cn';
import { useServerStore, useCanManageChannels } from '../../stores/serverStore';
import type { Channel } from '@stream-party/shared';
import { ChannelSettings } from './ChannelSettings';

interface ChannelListProps {
  onChannelSelect: (channel: Channel) => void;
  onCreateChannel: (type: 'text' | 'voice') => void;
  onDeleteChannel: (channel: Channel) => void;
}

export function ChannelList({ onChannelSelect, onCreateChannel, onDeleteChannel }: ChannelListProps) {
  const activeServer = useServerStore((state) => state.activeServer);
  const activeChannel = useServerStore((state) => state.activeChannel);
  const canManageChannels = useCanManageChannels();
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);

  if (!activeServer) return null;

  const textChannels = activeServer.channels.filter((c) => c.type === 'text');
  const voiceChannels = activeServer.channels.filter((c) => c.type === 'voice');

  return (
    <>
      <div className="flex flex-col w-60 bg-gray-800 h-full overflow-hidden">
        {/* Server header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-900 shadow-md">
          <h2 className="font-semibold text-white truncate">{activeServer.name}</h2>
          {canManageChannels && (
            <button
              onClick={() => onCreateChannel('text')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Créer un salon"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto pt-4 px-2">
          {/* Text channels */}
          <ChannelCategory
            title="Salons textuels"
            canManage={canManageChannels}
            onCreate={() => onCreateChannel('text')}
          >
            {textChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannel?.id === channel.id}
                canManage={canManageChannels}
                onClick={() => onChannelSelect(channel)}
                onDelete={() => onDeleteChannel(channel)}
                onSettings={() => setSettingsChannel(channel)}
              />
            ))}
          </ChannelCategory>

          {/* Voice channels */}
          <ChannelCategory
            title="Salons vocaux"
            canManage={canManageChannels}
            onCreate={() => onCreateChannel('voice')}
          >
            {voiceChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannel?.id === channel.id}
                canManage={canManageChannels}
                onClick={() => onChannelSelect(channel)}
                onDelete={() => onDeleteChannel(channel)}
                onSettings={() => setSettingsChannel(channel)}
              />
            ))}
          </ChannelCategory>
        </div>
      </div>

      {/* Channel Settings Modal */}
      {settingsChannel && activeServer && (
        <ChannelSettings
          channel={settingsChannel}
          server={activeServer}
          isOpen={!!settingsChannel}
          onClose={() => setSettingsChannel(null)}
        />
      )}
    </>
  );
}

interface ChannelCategoryProps {
  title: string;
  canManage: boolean;
  onCreate: () => void;
  children: React.ReactNode;
}

function ChannelCategory({ title, canManage, onCreate, children }: ChannelCategoryProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        {canManage && (
          <button
            onClick={onCreate}
            className="text-gray-400 hover:text-white transition-colors"
            title={`Créer un ${title.toLowerCase()}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  canManage: boolean;
  onClick: () => void;
  onDelete: () => void;
  onSettings: () => void;
}

function ChannelItem({ channel, isActive, canManage, onClick, onDelete, onSettings }: ChannelItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors',
        isActive
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Channel icon */}
        {channel.type === 'text' ? (
          <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
          </svg>
        )}
        
        {/* Channel name */}
        <span className="truncate">{channel.name}</span>
      </div>

      {/* Actions */}
      {canManage && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Paramètres du salon"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Supprimer le salon"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default ChannelList;
