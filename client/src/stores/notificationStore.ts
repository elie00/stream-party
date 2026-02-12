import { create } from 'zustand';
import { Notification, NotificationType } from '@stream-party/shared';
import { pushNotificationService } from '../services/pushNotificationService';

interface NotificationState {
  // Notifications list
  notifications: Notification[];
  
  // Unread count
  unreadCount: number;
  
  // Permission status
  permissionGranted: boolean;
  
  // Loading state
  isLoading: boolean;
  
  // Actions
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: number) => void;
  markAllAsRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  removeNotification: (notificationId: number) => void;
  clearNotifications: () => void;
  requestPermission: () => Promise<boolean>;
  showPushNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  permissionGranted: pushNotificationService.isGranted(),
  isLoading: false,

  addNotification: (notification) => {
    set((state) => {
      // Avoid duplicates
      if (state.notifications.some(n => n.id === notification.id)) {
        return state;
      }
      
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
      };
    });

    // Show push notification if permission granted and notification is unread
    if (!notification.read) {
      get().showPushNotification(notification);
    }
  },

  markAsRead: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === notificationId);
      if (!notification || notification.read) {
        return state;
      }

      return {
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter(n => !n.read).length;
    set({ notifications, unreadCount });
  },

  setUnreadCount: (count) => {
    set({ unreadCount: count });
  },

  removeNotification: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find(n => n.id === notificationId);
      return {
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadCount: notification && !notification.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    });
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  requestPermission: async () => {
    const granted = await pushNotificationService.requestPermission();
    set({ permissionGranted: granted });
    return granted;
  },

  showPushNotification: (notification) => {
    const { permissionGranted } = get();
    if (!permissionGranted) return;

    // Don't show push notification if window is focused
    if (document.hasFocus()) return;

    const title = notification.title;
    const options = {
      body: notification.content,
      tag: `notification-${notification.id}`,
      data: notification.data,
    };

    pushNotificationService.show(title, options);
  },
}));

// Notification type icons
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  mention: '@',
  reply: '↩️',
  reaction: '👍',
  join: '👋',
  file: '📁',
  system: '🔔',
};

// Notification type labels
export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  mention: 'Mention',
  reply: 'Réponse',
  reaction: 'Réaction',
  join: 'Nouveau membre',
  file: 'Fichier',
  system: 'Système',
};

// Notification type colors
export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  mention: '#3b82f6', // blue-500
  reply: '#22c55e', // green-500
  reaction: '#eab308', // yellow-500
  join: '#8b5cf6', // purple-500
  file: '#f97316', // orange-500
  system: '#6b7280', // gray-500
};
