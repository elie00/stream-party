import { useEffect, useRef, useCallback } from 'react';
import { PresenceStatus, UserActivity } from '@stream-party/shared';
import { usePresenceStore, IDLE_TIMEOUT_MS, ACTIVITY_EVENTS } from '../stores/presenceStore';
import { getSocket } from '../services/socket';

interface UsePresenceOptions {
  autoIdle?: boolean;
  idleTimeout?: number;
}

export function usePresence(options: UsePresenceOptions = {}) {
  const { autoIdle = true, idleTimeout = IDLE_TIMEOUT_MS } = options;
  const { myStatus, myCustomStatus, myStatusEmoji, myActivity, setMyStatus, setMyCustomStatus, setMyActivity } = usePresenceStore();
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Send status to server
  const sendStatusToServer = useCallback((status: PresenceStatus) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('presence:status', { status });
    }
  }, []);

  // Send custom status to server
  const sendCustomStatusToServer = useCallback((customStatus: string | null, statusEmoji?: string | null) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('presence:custom', { customStatus, statusEmoji });
    }
  }, []);

  // Send activity to server
  const sendActivityToServer = useCallback((activity: UserActivity | null) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('presence:activity', { activity });
    }
  }, []);

  // Set status and sync with server
  const setStatus = useCallback((status: PresenceStatus) => {
    // Don't allow setting to idle manually - it's auto-detected
    if (status === 'idle') return;
    
    setMyStatus(status);
    sendStatusToServer(status);
    
    // Reset idle timer if coming back from idle
    if (myStatus === 'idle' && status === 'online') {
      lastActivityRef.current = Date.now();
    }
  }, [myStatus, setMyStatus, sendStatusToServer]);

  // Set custom status and sync with server
  const setCustomStatus = useCallback((customStatus: string | null, statusEmoji?: string | null) => {
    setMyCustomStatus(customStatus, statusEmoji ?? undefined);
    sendCustomStatusToServer(customStatus, statusEmoji ?? undefined);
  }, [setMyCustomStatus, sendCustomStatusToServer]);

  // Set activity and sync with server
  const setActivity = useCallback((activity: UserActivity | null) => {
    setMyActivity(activity);
    sendActivityToServer(activity);
  }, [setMyActivity, sendActivityToServer]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // If user was idle, set back to online
    if (myStatus === 'idle') {
      setMyStatus('online');
      sendStatusToServer('online');
    }

    // Clear existing timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // Set new idle timer
    if (autoIdle && myStatus === 'online') {
      idleTimerRef.current = setTimeout(() => {
        setMyStatus('idle');
        sendStatusToServer('idle');
      }, idleTimeout);
    }
  }, [myStatus, autoIdle, idleTimeout, setMyStatus, sendStatusToServer]);

  // Handle visibility change (tab switching)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // User switched away from tab
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    } else {
      // User came back to tab
      handleActivity();
    }
  }, [handleActivity]);

  // Request presence for users
  const requestPresence = useCallback((userIds: string[]) => {
    const socket = getSocket();
    if (socket.connected && userIds.length > 0) {
      socket.emit('presence:request', { userIds });
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!autoIdle) return;

    // Add activity event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start initial idle timer
    idleTimerRef.current = setTimeout(() => {
      if (myStatus === 'online') {
        setMyStatus('idle');
        sendStatusToServer('idle');
      }
    }, idleTimeout);

    return () => {
      // Cleanup
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [autoIdle, idleTimeout, myStatus, handleActivity, handleVisibilityChange, setMyStatus, sendStatusToServer]);

  // Setup socket event listeners
  useEffect(() => {
    const socket = getSocket();
    
    const handlePresenceUpdate = (data: { userId: string; presence: { userId: string; status: PresenceStatus; customStatus?: string | null; lastSeenAt: Date } }) => {
      usePresenceStore.getState().updateUserPresence(data.userId, data.presence);
    };

    const handlePresenceBulk = (data: { presences: Record<string, { userId: string; status: PresenceStatus; customStatus?: string | null; lastSeenAt: Date }> }) => {
      usePresenceStore.getState().updateBulkPresences(data.presences);
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:bulk', handlePresenceBulk);

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:bulk', handlePresenceBulk);
    };
  }, []);

  // Set online on mount and offline on unmount
  useEffect(() => {
    setStatus('online');

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [setStatus]);

  return {
    status: myStatus,
    customStatus: usePresenceStore.getState().myCustomStatus,
    statusEmoji: usePresenceStore.getState().myStatusEmoji,
    activity: usePresenceStore.getState().myActivity,
    setStatus,
    setCustomStatus,
    setActivity,
    requestPresence,
  };
}
