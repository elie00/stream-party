import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useDMStore } from '../stores/dmStore';
import { useAuthStore } from '../stores/authStore';
import type { DirectMessageChannel, DirectMessage } from '@stream-party/shared';

export function useDM() {
  const socket = getSocket();
  const {
    channels,
    activeChannel,
    messages,
    typingUsers,
    unreadCounts,
    setChannels,
    setActiveChannel,
    addMessage,
    setMessages,
    prependMessages,
    setTyping,
    incrementUnread,
    clearUnread,
    updateChannelLastMessage,
  } = useDMStore();
  const userId = useAuthStore((s) => s.userId);
  const listenersAttached = useRef(false);

  // Attach socket listeners
  useEffect(() => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;

    socket.on('dm:channels', (data: { channels: DirectMessageChannel[] }) => {
      setChannels(data.channels);
    });

    socket.on('dm:channel-opened', (data: { channel: DirectMessageChannel }) => {
      setActiveChannel(data.channel);
      // Add to channels list if not already there
      const store = useDMStore.getState();
      if (!store.channels.some((ch) => ch.id === data.channel.id)) {
        setChannels([data.channel, ...store.channels]);
      }
    });

    socket.on('dm:message', (data: { message: DirectMessage }) => {
      const store = useDMStore.getState();
      addMessage(data.message.channelId, data.message);
      updateChannelLastMessage(data.message.channelId, data.message);

      // Increment unread if not the active channel
      if (store.activeChannel?.id !== data.message.channelId) {
        incrementUnread(data.message.channelId);
      }
    });

    socket.on('dm:history', (data: { channelId: string; messages: DirectMessage[] }) => {
      const store = useDMStore.getState();
      const existing = store.messages[data.channelId];
      if (existing && existing.length > 0) {
        // Prepend older messages
        prependMessages(data.channelId, data.messages);
      } else {
        setMessages(data.channelId, data.messages);
      }
    });

    socket.on('dm:typing', (data: { channelId: string; userId: string; isTyping: boolean }) => {
      setTyping(data.channelId, data.userId, data.isTyping);
    });

    return () => {
      socket.off('dm:channels');
      socket.off('dm:channel-opened');
      socket.off('dm:message');
      socket.off('dm:history');
      socket.off('dm:typing');
      listenersAttached.current = false;
    };
  }, []);

  const loadChannels = useCallback(() => {
    socket.emit('dm:get-channels');
  }, [socket]);

  const openChannel = useCallback(
    (targetUserId: string) => {
      socket.emit('dm:open', { targetUserId });
    },
    [socket],
  );

  const sendMessage = useCallback(
    (content: string) => {
      const channel = useDMStore.getState().activeChannel;
      if (!channel) return;
      socket.emit('dm:send', { channelId: channel.id, content });
    },
    [socket],
  );

  const loadHistory = useCallback(
    (channelId: string, cursor?: string) => {
      socket.emit('dm:history', { channelId, cursor, limit: 50 });
    },
    [socket],
  );

  const startTyping = useCallback(
    (channelId: string) => {
      socket.emit('dm:typing-start', { channelId });
    },
    [socket],
  );

  const stopTyping = useCallback(
    (channelId: string) => {
      socket.emit('dm:typing-stop', { channelId });
    },
    [socket],
  );

  const selectChannel = useCallback(
    (channel: DirectMessageChannel) => {
      setActiveChannel(channel);
      clearUnread(channel.id);
      // Load history if not already loaded
      const store = useDMStore.getState();
      if (!store.messages[channel.id] || store.messages[channel.id].length === 0) {
        loadHistory(channel.id);
      }
    },
    [setActiveChannel, clearUnread, loadHistory],
  );

  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return {
    channels,
    activeChannel,
    messages: activeChannel ? messages[activeChannel.id] || [] : [],
    typingUsers: activeChannel
      ? typingUsers[activeChannel.id] || new Map()
      : new Map(),
    unreadCounts,
    totalUnread,
    userId,
    loadChannels,
    openChannel,
    sendMessage,
    loadHistory,
    startTyping,
    stopTyping,
    selectChannel,
    setActiveChannel,
  };
}
