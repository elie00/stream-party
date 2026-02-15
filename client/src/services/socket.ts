import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@stream-party/shared';
import { useRoomStore } from '../stores/roomStore';
import { useChatStore } from '../stores/chatStore';
import { useToastStore } from '../components/ui/Toast';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let reconnectListenersAttached = false;

export function getSocket(): TypedSocket {
  if (!socket) {
    const authData = JSON.parse(localStorage.getItem('stream-party-auth') || '{}');
    socket = io('/', {
      auth: { token: authData?.state?.token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // Attach reconnection listeners once per socket instance
    if (!reconnectListenersAttached) {
      attachReconnectListeners(socket);
      attachChatListeners(socket);
      reconnectListenersAttached = true;
    }
  }
  return socket;
}

function attachReconnectListeners(s: TypedSocket) {
  s.on('connect', () => {
    // If we were in a room, re-join it
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      const addToast = useToastStore.getState().addToast;
      addToast('Reconnected!', 'success');

      s.emit('room:join', { code: roomStore.room.code }, (res) => {
        if (!res.success) {
          addToast(res.error || 'Failed to rejoin room after reconnect', 'error');
        }
      });
    }
  });

  s.on('disconnect', () => {
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      const addToast = useToastStore.getState().addToast;
      addToast('Connection lost, reconnecting...', 'error');
    }
  });

  s.on('connect_error', () => {
    // Only show once, not on every retry
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      // connect_error fires repeatedly; the disconnect toast already covers this
    }
  });
}

function attachChatListeners(s: TypedSocket) {
  // Listen for reaction events
  s.on('reaction:added', (data) => {
    const chatStore = useChatStore.getState();
    chatStore.addReaction(data.messageId, data.reaction);
  });

  s.on('reaction:removed', (data) => {
    const chatStore = useChatStore.getState();
    chatStore.removeReaction(data.messageId, data.reactionId);
  });

  // Listen for embed events
  s.on('embed:generated', (data) => {
    const chatStore = useChatStore.getState();
    chatStore.addEmbed(data.messageId, data.embed);
  });
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectListenersAttached = false;
  }
}

/**
 * Proxy that lazily delegates to the real socket singleton.
 * Allows `import { socket } from './socket'` to work as if
 * `socket` were a directly-exported Socket.IO instance.
 */
export const socketProxy = new Proxy({} as TypedSocket, {
  get(_target, prop, receiver) {
    const s = getSocket();
    const value = Reflect.get(s, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(s);
    }
    return value;
  },
});

export { socketProxy as socket };
