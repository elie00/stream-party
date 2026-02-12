/**
 * Push Notification Service
 * Handles browser push notifications
 */

export interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationEvent {
  action?: string;
  notification: Notification;
}

class PushNotificationService {
  private permission: NotificationPermission = 'default';
  private onClickCallbacks: ((event: NotificationEvent) => void)[] = [];

  constructor() {
    // Check initial permission state
    if (this.isSupported()) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Check if permission is granted
   */
  isGranted(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Check if permission is denied
   */
  isDenied(): boolean {
    return this.permission === 'denied';
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    if (this.isGranted()) {
      return true;
    }

    if (this.isDenied()) {
      console.warn('Notification permission was denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Show a native notification
   */
  async show(title: string, options: NotificationOptions = {}): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn('Notifications are not supported');
      return null;
    }

    if (!this.isGranted()) {
      const granted = await this.requestPermission();
      if (!granted) {
        return null;
      }
    }

    try {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      // Handle click
      notification.onclick = (event) => {
        event.preventDefault();
        
        // Focus the window
        window.focus();
        
        // Close the notification
        notification.close();

        // Call registered callbacks
        const notificationEvent: NotificationEvent = {
          notification,
          action: undefined,
        };
        
        this.onClickCallbacks.forEach(callback => {
          try {
            callback(notificationEvent);
          } catch (error) {
            console.error('Notification click callback error:', error);
          }
        });
      };

      // Handle close
      notification.onclose = () => {
        // Cleanup if needed
      };

      // Handle error
      notification.onerror = (error) => {
        console.error('Notification error:', error);
      };

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Show a notification for a mention
   */
  async showMentionNotification(
    mentionerName: string,
    message: string,
    roomId: string,
    roomName: string
  ): Promise<Notification | null> {
    return this.show(`${mentionerName} vous a mentionné`, {
      body: message.length > 100 ? message.slice(0, 100) + '...' : message,
      tag: `mention-${roomId}`,
      data: {
        type: 'mention',
        roomId,
        roomName,
      },
      requireInteraction: false,
    });
  }

  /**
   * Show a notification for a reaction
   */
  async showReactionNotification(
    reactorName: string,
    emoji: string,
    roomId: string
  ): Promise<Notification | null> {
    return this.show(`${reactorName} a réagi`, {
      body: `${emoji} à votre message`,
      tag: `reaction-${roomId}`,
      data: {
        type: 'reaction',
        roomId,
        emoji,
      },
      silent: true,
    });
  }

  /**
   * Show a notification for a new user joining
   */
  async showJoinNotification(
    userName: string,
    roomName: string,
    roomId: string
  ): Promise<Notification | null> {
    return this.show(`${userName} a rejoint`, {
      body: `Un nouveau participant dans ${roomName}`,
      tag: `join-${roomId}`,
      data: {
        type: 'join',
        roomId,
        userName,
      },
      silent: true,
    });
  }

  /**
   * Register a callback for notification clicks
   */
  onClick(callback: (event: NotificationEvent) => void): () => void {
    this.onClickCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.onClickCallbacks.indexOf(callback);
      if (index > -1) {
        this.onClickCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Close all notifications with a specific tag
   */
  closeByTag(tag: string): void {
    if (!this.isSupported()) return;

    // Note: This requires Service Worker registration for full functionality
    // For now, we just close notifications we have references to
    // In a full implementation, you'd use ServiceWorkerRegistration.getNotifications()
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
