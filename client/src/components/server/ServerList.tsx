import { ServerIcon } from './ServerIcon';
import { useServerStore } from '../../stores/serverStore';
import type { Server } from '@stream-party/shared';

interface ServerListProps {
  onServerSelect: (server: Server) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
}

export function ServerList({ onServerSelect, onCreateServer, onJoinServer }: ServerListProps) {
  const servers = useServerStore((state) => state.servers);
  const activeServer = useServerStore((state) => state.activeServer);

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-gray-900 w-[72px] h-full overflow-y-auto">
      {/* Home button */}
      <button
        onClick={() => onServerSelect(null as unknown as Server)}
        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-700 text-gray-300 hover:rounded-xl hover:bg-brand-600 hover:text-white transition-all duration-200"
        title="Accueil"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-gray-700 rounded-full my-1" />

      {/* Server list */}
      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          server={server}
          isActive={activeServer?.id === server.id}
          onClick={() => onServerSelect(server)}
        />
      ))}

      {/* Add server button */}
      <button
        onClick={onCreateServer}
        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-700 text-green-500 hover:rounded-xl hover:bg-green-500 hover:text-white transition-all duration-200 group"
        title="Créer un serveur"
      >
        <svg
          className="w-6 h-6"
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

      {/* Join server button */}
      <button
        onClick={onJoinServer}
        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-700 text-green-500 hover:rounded-xl hover:bg-green-500 hover:text-white transition-all duration-200 group"
        title="Rejoindre un serveur"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
      </button>
    </div>
  );
}
