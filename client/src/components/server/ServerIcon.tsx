import { cn } from '../../utils/cn';
import type { Server } from '@stream-party/shared';

interface ServerIconProps {
  server: Server;
  isActive?: boolean;
  hasNotification?: boolean;
  onClick?: () => void;
}

export function ServerIcon({ server, isActive, hasNotification, onClick }: ServerIconProps) {
  const initials = server.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200',
        'hover:rounded-xl hover:bg-brand-600',
        isActive
          ? 'rounded-xl bg-brand-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:text-white'
      )}
      title={server.name}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 w-1 h-10 bg-white rounded-r-full -translate-x-1" />
      )}

      {/* Server icon or initials */}
      {server.icon ? (
        <img
          src={server.icon}
          alt={server.name}
          className="w-full h-full object-cover rounded-inherit"
        />
      ) : (
        <span className="text-sm font-semibold">{initials}</span>
      )}

      {/* Notification indicator */}
      {hasNotification && !isActive && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-4 border-gray-900" />
      )}

      {/* Hover tooltip */}
      <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {server.name}
      </div>
    </button>
  );
}
