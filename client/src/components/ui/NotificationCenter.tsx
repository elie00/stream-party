apimport { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotificationStore, NOTIFICATION_ICONS, NOTIFICATION_COLORS } from '../../stores/notificationStore';
import { Notification, NotificationType } from '@stream-party/shared';
import { socket } from '../../services/socket';

interface NotificationCenterProps {
  onNavigateToRoom?: (roomId: string) => void;
}

export function NotificationCenter({ onNavigateToRoom }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    setNotifications,
    setUnreadCount,
  } = useNotificationStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket event handlers
  useEffect(() => {
    // Get initial notifications
    socket.emit('notification:get', { limit: 50, offset: 0 });

    // Listen for new notifications
    socket.on('notification:new', ({ notification }) => {
      useNotificationStore.getState().addNotification(notification);
    });

    // Listen for notification list
    socket.on('notification:list', ({ notifications }) => {
      setNotifications(notifications);
    });

    // Listen for read status
    socket.on('notification:read', ({ notificationId }) => {
      markAsRead(notificationId);
    });

    // Listen for unread count
    socket.on('notification:unread-count', ({ count }) => {
      setUnreadCount(count);
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:list');
      socket.off('notification:read');
      socket.off('notification:unread-count');
    };
  }, [setNotifications, markAsRead, setUnreadCount]);

  const handleMarkAsRead = useCallback((notificationId: number) => {
    socket.emit('notification:mark-read', { notificationId });
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    socket.emit('notification:mark-all-read');
    markAllAsRead();
  }, [markAllAsRead]);

  const handleNotificationClick = useCallback((notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate if there's room data
    if (notification.data?.roomId && onNavigateToRoom) {
      onNavigateToRoom(notification.data.roomId as string);
    }

    setIsOpen(false);
  }, [handleMarkAsRead, onNavigateToRoom]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return notificationDate.toLocaleDateString('fr-FR');
  };

  const dropdownContent = isOpen && (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-[#1a1a1a] rounded-xl border border-[#333] shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
        <h3 className="text-white font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#a0a0a0]">
            <div className="text-4xl mb-2">🔔</div>
            <p>Aucune notification</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
              onMarkRead={() => handleMarkAsRead(notification.id)}
              formatTime={formatTime}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#a0a0a0] hover:text-white transition-colors rounded-lg hover:bg-[#333] focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown portal */}
      {typeof document !== 'undefined' && createPortal(
        dropdownContent,
        document.body
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onMarkRead: () => void;
  formatTime: (date: Date) => string;
}

function NotificationItem({ notification, onClick, onMarkRead, formatTime }: NotificationItemProps) {
  const icon = NOTIFICATION_ICONS[notification.type];
  const color = NOTIFICATION_COLORS[notification.type];

  return (
    <div
      className={`px-4 py-3 border-b border-[#333] cursor-pointer hover:bg-[#252525] transition-colors ${
        !notification.read ? 'bg-[#252525]/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm ${!notification.read ? 'text-white font-medium' : 'text-[#e0e0e0]'}`}>
              {notification.title}
            </p>
            {!notification.read && (
              <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
            )}
          </div>
          {notification.content && (
            <p className="text-xs text-[#a0a0a0] mt-1 line-clamp-2">
              {notification.content}
            </p>
          )}
          <p className="text-xs text-[#707070] mt-1">
            {formatTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default NotificationCenter;
